"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ── Landmark groups ────────────────────────────────────────────────────────
const SILHOUETTE = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const MEASURE_PAIRS: [number, number, string][] = [
  [54, 284, "#C9A882"], [33, 263, "#C9A882"],
  [234, 454, "#8B6347"], [172, 397, "#4A3728"],
];
const WIRE_EYE_R  = [33, 160, 158, 133, 153, 144, 33];
const WIRE_EYE_L  = [362, 385, 387, 263, 380, 373, 362];
const WIRE_BROW_R = [46, 52, 55, 107];
const WIRE_BROW_L = [276, 282, 285, 336];
const WIRE_NOSE   = [168, 6, 197, 5, 4, 1];
const WIRE_LIPS   = [61, 37, 0, 267, 291, 321, 17, 84, 61];

// ── Measurement ────────────────────────────────────────────────────────────
interface M { foreW: number; eyeW: number; cheekW: number; jawW: number; faceLen: number }
interface Lm { x: number; y: number; z: number }

function d2px(a: Lm, b: Lm, W: number, H: number) {
  // CRITICAL: convert to pixel space before measuring to avoid 4:3 aspect distortion
  return Math.sqrt(((a.x - b.x) * W) ** 2 + ((a.y - b.y) * H) ** 2);
}

function measure(lm: Lm[], W: number, H: number): M {
  return {
    foreW:   d2px(lm[54],  lm[284], W, H),
    eyeW:    d2px(lm[33],  lm[263], W, H),
    cheekW:  d2px(lm[234], lm[454], W, H),
    jawW:    d2px(lm[172], lm[397], W, H),
    faceLen: d2px(lm[10],  lm[152], W, H),
  };
}

function avgBuffer(buf: M[]): M {
  const n = buf.length;
  return {
    foreW:   buf.reduce((s, m) => s + m.foreW,   0) / n,
    eyeW:    buf.reduce((s, m) => s + m.eyeW,    0) / n,
    cheekW:  buf.reduce((s, m) => s + m.cheekW,  0) / n,
    jawW:    buf.reduce((s, m) => s + m.jawW,    0) / n,
    faceLen: buf.reduce((s, m) => s + m.faceLen, 0) / n,
  };
}

function classifyFromAvg(avg: M): string {
  const { foreW, eyeW, cheekW, jawW, faceLen } = avg;
  const lenR  = faceLen / cheekW;
  const jawR  = jawW    / cheekW;
  const foreR = foreW   / cheekW;
  const eyeR  = eyeW    / cheekW;

  const scores: Record<string, number> = {
    Long: 0, Diamond: 0, Triangle: 0, Heart: 0, Round: 0, Square: 0, Oval: 0,
  };

  // Pixel-corrected thresholds (typical selfie on 640×480 front cam)
  // Oval face ≈ 1.28–1.50, Round ≈ 0.95–1.20, Long > 1.55
  scores.Long     += lenR > 1.55 ? 4 : lenR > 1.46 ? 2 : 0;
  scores.Diamond  += foreR < 0.82 ? 2 : 0;
  scores.Diamond  += jawR  < 0.78 ? 2 : 0;
  scores.Diamond  += eyeR  > 0.84 ? 1 : 0;
  scores.Diamond  += cheekW > foreW && cheekW > jawW ? 1 : 0;
  scores.Triangle += (jawR - foreR) > 0.15 ? 4 : (jawR - foreR) > 0.10 ? 2 : 0;
  scores.Heart    += (foreR - jawR) > 0.18 ? 4 : (foreR - jawR) > 0.12 ? 2 : 0;
  scores.Heart    += foreR > 0.88 ? 1 : 0;
  scores.Round    += lenR < 1.12 ? 3 : lenR < 1.20 ? 1 : 0;
  scores.Round    += jawR > 0.84 ? 2 : jawR > 0.78 ? 1 : 0;
  scores.Round    += foreR > 0.84 ? 1 : 0;
  scores.Square   += lenR >= 1.10 && lenR < 1.35 ? 2 : 0;
  scores.Square   += jawR > 0.82 ? 3 : jawR > 0.76 ? 1 : 0;
  scores.Square   += Math.abs(foreR - jawR) < 0.08 ? 2 : 0;
  scores.Oval     += lenR >= 1.22 && lenR <= 1.55 ? 3 : 0;
  scores.Oval     += jawR >= 0.70 && jawR <= 0.84 ? 2 : 0;
  scores.Oval     += foreR >= 0.78 && foreR <= 0.92 ? 2 : 0;
  scores.Oval     += Math.abs(foreR - jawR) < 0.12 ? 1 : 0;
  if (lenR > 1.46) scores.Oval = Math.max(0, scores.Oval - 3);

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Pose from 3D transformation matrix (column-major 4×4) ─────────────────
// Right-vector Z component (m[2]): pos = user turned left (display), neg = right
// Up-vector    Z component (m[6]): neg = looking up, pos = looking down
function poseFromMatrix(data: Float32Array): { yaw: number; pitch: number } {
  return { yaw: data[2], pitch: data[6] };
}

// Fallback from 2D landmarks when matrix unavailable
function poseFromLandmarks(lm: Lm[]): { yaw: number; pitch: number } {
  const faceW = lm[454].x - lm[234].x;
  const yaw   = faceW > 0 ? ((lm[1].x - lm[234].x) / faceW - 0.5) * 2 : 0;
  const faceH = lm[152].y - lm[10].y;
  const pitch = faceH > 0 ? ((lm[1].y - lm[10].y) / faceH - 0.45) * 2 : 0;
  return { yaw, pitch };
}

// ── Coverage ring ──────────────────────────────────────────────────────────
const N_SEGS         = 8;
const FRAMES_PER_SEG = 12;
const INIT_FRAMES    = 20;
const MIN_COVERED    = 5;
const TICK_COUNT     = 36; // Face ID-style tick marks

// Map (yaw,pitch) → ring segment 0–7
// 0=top/frontal, 2=right, 4=bottom, 6=left  (clockwise from top)
function getSegment(yaw: number, pitch: number): number {
  if (Math.sqrt(yaw * yaw + pitch * pitch) < 0.08) return 0;
  let angle = Math.atan2(yaw, -pitch);
  if (angle < 0) angle += 2 * Math.PI;
  return Math.floor((angle / (2 * Math.PI)) * N_SEGS) % N_SEGS;
}

function coverageHint(covered: boolean[], faceInView: boolean, tooClose: boolean): string {
  if (!faceInView) return "Move closer to the camera";
  if (tooClose)    return "Move back — you're too close";
  const L = covered[5] || covered[6] || covered[7];
  const R = covered[1] || covered[2] || covered[3];
  const D = covered[3] || covered[4] || covered[5];
  if (!L && !R)    return "Slowly turn your head left, then right";
  if (!L)          return "Turn your head left more";
  if (!R)          return "Turn your head right more";
  if (!D)          return "Tilt your chin down slightly";
  return "Keep moving — almost done";
}

// ── Canvas draw ────────────────────────────────────────────────────────────
function drawFace(ctx: CanvasRenderingContext2D, lm: Lm[], W: number, H: number) {
  const p = (i: number) => ({ x: lm[i].x * W, y: lm[i].y * H });

  ctx.beginPath();
  SILHOUETTE.forEach((idx, i) => {
    const { x, y } = p(idx);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = "rgba(201,168,130,0.85)";
  ctx.lineWidth = 1.5; ctx.stroke();

  const wire = "rgba(201,168,130,0.28)";
  [WIRE_EYE_R, WIRE_EYE_L, WIRE_BROW_R, WIRE_BROW_L, WIRE_NOSE, WIRE_LIPS].forEach((pts) => {
    ctx.beginPath();
    pts.forEach((idx, i) => { const { x, y } = p(idx); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = wire; ctx.lineWidth = 1.1; ctx.stroke();
  });

  MEASURE_PAIRS.forEach(([a, b, color]) => {
    const ax = lm[a].x * W, ay = lm[a].y * H;
    const bx = lm[b].x * W, by = lm[b].y * H;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = color + "44"; ctx.lineWidth = 0.7; ctx.stroke();
    [{ x: ax, y: ay }, { x: bx, y: by }].forEach(({ x, y }) => {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  });
}

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  onCapture: (imageDataUrl: string, faceShape: string) => void;
  onClose: () => void;
}

export default function FaceScanner({ onCapture, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarker  = useRef<any>(null);
  const stream      = useRef<MediaStream | null>(null);
  const raf         = useRef<number>(0);
  const captured    = useRef(false);
  const measureBuf  = useRef<M[]>([]);
  const frontalImg  = useRef<string | null>(null);
  const initAcc     = useRef(0);
  const segFrames   = useRef<number[]>(Array(N_SEGS).fill(0));
  const yawRef      = useRef(0);
  const pitchRef    = useRef(0);

  const [status,       setStatus]       = useState<"loading" | "scanning" | "done" | "error">("loading");
  const [phase,        setPhase]        = useState<"init" | "scan">("init");
  const [covered,      setCovered]      = useState<boolean[]>(Array(N_SEGS).fill(false));
  const [coveredCount, setCoveredCount] = useState(0);
  const [faceShape,    setFaceShape]    = useState<string | null>(null);
  const [faceInView,   setFaceInView]   = useState(false);
  const [tooClose,     setTooClose]     = useState(false);
  const [initPct,      setInitPct]      = useState(0);
  const [dotAngle,     setDotAngle]     = useState<number | null>(null);

  const doCapture = useCallback((shape: string) => {
    if (captured.current) return;
    captured.current = true;
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    const img = frontalImg.current;
    if (img) { setStatus("done"); setTimeout(() => onCapture(img, shape), 800); return; }
    const video = videoRef.current;
    if (!video) return;
    const cap = document.createElement("canvas");
    cap.width = video.videoWidth; cap.height = video.videoHeight;
    const ctx = cap.getContext("2d")!;
    ctx.translate(cap.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
    setStatus("done");
    setTimeout(() => onCapture(cap.toDataURL("image/jpeg", 0.88), shape), 800);
  }, [onCapture]);

  const detect = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const lmkr   = landmarker.current;
    if (!video || !canvas || !lmkr || video.readyState < 2) {
      raf.current = requestAnimationFrame(detect); return;
    }

    const W = video.videoWidth, H = video.videoHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    let results;
    try { results = lmkr.detectForVideo(video, performance.now()); }
    catch { raf.current = requestAnimationFrame(detect); return; }

    if (results.faceLandmarks.length > 0) {
      const lm = results.faceLandmarks[0];
      setFaceInView(true);
      drawFace(ctx, lm, W, H);

      // Face size check — cheekW > 52% of frame width = too close
      const cheekWnorm = Math.abs(lm[454].x - lm[234].x);
      const close = cheekWnorm > 0.52;
      setTooClose(close);

      // Accumulate pixel-space measurements
      measureBuf.current.push(measure(lm, W, H));
      if (measureBuf.current.length > 200) measureBuf.current.shift();

      // Pose: prefer transformation matrix (true 3D), fall back to landmarks
      let pose: { yaw: number; pitch: number };
      if (results.facialTransformationMatrixes?.length > 0) {
        pose = poseFromMatrix(results.facialTransformationMatrixes[0].data);
      } else {
        pose = poseFromLandmarks(lm);
      }
      const { yaw, pitch } = pose;
      yawRef.current   = yaw;
      pitchRef.current = pitch;

      // Compute dot angle for ring visualization
      setDotAngle(Math.atan2(yaw, -pitch) - Math.PI / 2);

      const isFrontal = Math.abs(yaw) < 0.10 && Math.abs(pitch) < 0.12;

      // Save best frontal frame for GPT-4o (90% quality, non-mirrored)
      if (isFrontal && !frontalImg.current && !close) {
        const cap = document.createElement("canvas");
        cap.width = W; cap.height = H;
        const c = cap.getContext("2d")!;
        c.translate(W, 0); c.scale(-1, 1); c.drawImage(video, 0, 0);
        frontalImg.current = cap.toDataURL("image/jpeg", 0.92);
      }

      if (measureBuf.current.length >= 25) {
        setFaceShape(classifyFromAvg(avgBuffer(measureBuf.current)));
      }

      // Phase 1: frontal hold
      if (initAcc.current < INIT_FRAMES) {
        initAcc.current = isFrontal && !close
          ? Math.min(initAcc.current + 1, INIT_FRAMES)
          : Math.max(0, initAcc.current - 0.5);
        setInitPct(initAcc.current / INIT_FRAMES);
        if (initAcc.current >= INIT_FRAMES) setPhase("scan");
      } else {
        // Phase 2: circular coverage
        if (!close) {
          const seg = getSegment(yaw, pitch);
          segFrames.current[seg] = Math.min(segFrames.current[seg] + 1, FRAMES_PER_SEG);
          if (segFrames.current[seg] >= FRAMES_PER_SEG) {
            setCovered(prev => {
              if (prev[seg]) return prev;
              const next = [...prev]; next[seg] = true;
              const count = next.filter(Boolean).length;
              setCoveredCount(count);
              if (count >= MIN_COVERED && measureBuf.current.length >= 30) {
                const shape = classifyFromAvg(avgBuffer(measureBuf.current));
                setFaceShape(shape);
                doCapture(shape);
              }
              return next;
            });
          }
        }
      }
    } else {
      setFaceInView(false);
      setTooClose(false);
      setDotAngle(null);
      initAcc.current = Math.max(0, initAcc.current - 1);
    }

    raf.current = requestAnimationFrame(detect);
  }, [doCapture]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (cancelled) return;
        const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;
        const lmkr = await FaceLandmarker.createFromOptions(resolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true, // true 3D pose angles
        });
        if (cancelled) { lmkr.close(); return; }
        landmarker.current = lmkr;
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { ms.getTracks().forEach((t) => t.stop()); return; }
        stream.current = ms;
        if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
        setStatus("scanning");
      } catch (err) {
        console.error("[FaceScanner]", err);
        if (!cancelled) setStatus("error");
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      landmarker.current?.close();
    };
  }, []);

  useEffect(() => {
    if (status !== "scanning") return;
    raf.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(raf.current);
  }, [status, detect]);

  // Face ID ring: 36 ticks in 4:3 viewBox, centered on face
  // viewBox "0 0 4 3" maps to camera aspect ratio exactly
  const RCX = 2.0, RCY = 1.22;
  const R_INNER = 0.76, R_OUTER_NORM = 0.85, R_OUTER_CARD = 0.94, R_DOT = 0.805;

  return (
    <div className="fixed inset-0 z-50 bg-brown-dark/90 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative bg-cream rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brown-light/30">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
              Face Scan
            </span>
            {faceShape && status === "scanning" && (
              <span className="font-sans text-xs text-brown-mid">· {faceShape}</span>
            )}
          </div>
          <button onClick={onClose} className="text-brown-mid hover:text-brown-dark transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} playsInline muted
            className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: "scaleX(-1)" }} />

          {/* Dark vignette for Face ID feel */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 55% 70% at 50% 42%, transparent 40%, rgba(0,0,0,0.55) 100%)" }} />

          {/* Face ID tick ring — SVG in 4:3 viewBox */}
          {status === "scanning" && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 4 3"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Dashed oval guide (face positioning) */}
              <ellipse cx={RCX} cy={RCY} rx={0.50} ry={0.65}
                fill="none"
                stroke={tooClose ? "rgba(255,140,0,0.4)" : "rgba(255,255,255,0.12)"}
                strokeWidth="0.015"
                strokeDasharray="0.06 0.03"
              />

              {/* 36 Face ID tick marks */}
              {Array.from({ length: TICK_COUNT }, (_, i) => {
                const angle     = (i / TICK_COUNT) * 2 * Math.PI - Math.PI / 2;
                const isCard    = i % 9 === 0;
                const r2        = isCard ? R_OUTER_CARD : R_OUTER_NORM;
                const seg       = Math.floor(i / (TICK_COUNT / N_SEGS));
                const x1 = RCX + R_INNER  * Math.cos(angle);
                const y1 = RCY + R_INNER  * Math.sin(angle);
                const x2 = RCX + r2       * Math.cos(angle);
                const y2 = RCY + r2       * Math.sin(angle);
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={covered[seg] ? "#C9A882" : "rgba(255,255,255,0.22)"}
                    strokeWidth={isCard ? "0.040" : "0.022"}
                    strokeLinecap="round"
                    style={{ transition: "stroke 0.5s ease" }}
                  />
                );
              })}

              {/* Segment marker dots at ring */}
              {Array.from({ length: N_SEGS }, (_, i) => {
                const angle = (i / N_SEGS) * 2 * Math.PI - Math.PI / 2;
                const mx = RCX + (R_OUTER_CARD + 0.04) * Math.cos(angle);
                const my = RCY + (R_OUTER_CARD + 0.04) * Math.sin(angle);
                return <circle key={i} cx={mx} cy={my} r={0.025}
                  fill={i < coveredCount ? "#8B6347" : "rgba(255,255,255,0.15)"}
                  style={{ transition: "fill 0.4s ease" }} />;
              })}

              {/* Current head-position dot on ring */}
              {dotAngle !== null && faceInView && (
                <motion.circle
                  cx={RCX + R_DOT * Math.cos(dotAngle)}
                  cy={RCY + R_DOT * Math.sin(dotAngle)}
                  r={0.055}
                  fill="#C9A882"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ filter: "drop-shadow(0 0 0.04px #C9A882)" }}
                />
              )}

              {/* Init phase fill arc */}
              {phase === "init" && faceInView && initPct > 0 && (
                <circle
                  cx={RCX} cy={RCY}
                  r={R_OUTER_CARD + 0.02}
                  fill="none"
                  stroke="#C9A882"
                  strokeWidth="0.025"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 - initPct * 100}
                  transform={`rotate(-90 ${RCX} ${RCY})`}
                  style={{ transition: "stroke-dashoffset 0.1s ease" }}
                />
              )}
            </svg>
          )}

          {/* Loading */}
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/90 gap-3">
              <div className="w-8 h-8 border-2 border-brown-light border-t-brown-dark rounded-full animate-spin" />
              <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid">Loading scanner</p>
            </div>
          )}

          {/* Done */}
          {status === "done" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 gap-2">
              <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                {faceShape}
              </p>
              <p className="font-sans text-[0.6rem] tracking-[0.35em] uppercase text-brown-mid">face shape detected</p>
            </motion.div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 p-6 text-center gap-3">
              <p className="font-sans text-sm text-brown-dark">Camera access denied or unavailable.</p>
              <button onClick={onClose} className="font-sans text-xs text-brown-mid underline underline-offset-2">
                Upload a photo instead
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        {status === "scanning" && (
          <div className="px-5 py-4 space-y-3">
            {/* 8 segment indicator dots */}
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: N_SEGS }, (_, i) => (
                <motion.div key={i}
                  animate={{
                    width: i === getSegment(yawRef.current, pitchRef.current) && phase === "scan" ? 20 : 8,
                    backgroundColor: covered[i] ? "#4A3728" : "#C9A882",
                    opacity: covered[i] ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-2 rounded-full"
                />
              ))}
            </div>

            {/* Instruction */}
            <AnimatePresence mode="wait">
              <motion.div key={`${phase}-${faceInView}-${tooClose}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                className="text-center"
              >
                <p className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  {tooClose
                    ? "Move back a little"
                    : !faceInView
                    ? "Position your face"
                    : phase === "init"
                    ? "Look straight ahead"
                    : "Move your head in a circle"
                  }
                </p>
                <p className="font-sans text-xs text-brown-mid mt-1">
                  {coverageHint(covered, faceInView, tooClose)}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Overall progress bar */}
            <div className="w-full bg-brown-light/20 rounded-full h-0.5 overflow-hidden">
              <motion.div
                className="bg-brown-dark h-0.5 rounded-full"
                animate={{ width: `${(coveredCount / N_SEGS) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {/* Manual capture */}
            {coveredCount >= MIN_COVERED && faceShape && (
              <button onClick={() => doCapture(faceShape)}
                className="w-full border border-brown-light text-brown-dark py-2 rounded-xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-light/20 transition-colors">
                Done · {faceShape} Face
              </button>
            )}
          </div>
        )}
      </motion.div>

      <p className="font-sans text-[0.6rem] text-cream/40 mt-4 tracking-wide text-center">
        Camera stays on your device — nothing uploaded during scanning
      </p>
    </div>
  );
}
