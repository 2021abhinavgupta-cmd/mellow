"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ── Landmark sets ──────────────────────────────────────────────────────────
const SILHOUETTE = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const MEASURE_PAIRS: [number, number, string][] = [
  [54,  284, "#C9A882"], [33,  263, "#C9A882"],
  [234, 454, "#8B6347"], [172, 397, "#4A3728"],
];
// Simplified wireframe features for Face ID look
const WIRE_EYE_R   = [33, 160, 158, 133, 153, 144, 33];
const WIRE_EYE_L   = [362, 385, 387, 263, 380, 373, 362];
const WIRE_BROW_R  = [46, 52, 55, 107];
const WIRE_BROW_L  = [276, 282, 285, 336];
const WIRE_NOSE    = [168, 6, 197, 5, 4, 1];
const WIRE_LIPS    = [61, 37, 0, 267, 291, 321, 17, 84, 61];

// ── Measurement types ──────────────────────────────────────────────────────
interface M  { foreW: number; eyeW: number; cheekW: number; jawW: number; faceLen: number }
interface Lm { x: number; y: number; z: number }

function d2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function measure(lm: Lm[]): M {
  return {
    foreW:   d2(lm[54],  lm[284]),
    eyeW:    d2(lm[33],  lm[263]),
    cheekW:  d2(lm[234], lm[454]),
    jawW:    d2(lm[172], lm[397]),
    faceLen: d2(lm[10],  lm[152]),
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
  const lenR = faceLen / cheekW, jawR = jawW / cheekW;
  const foreR = foreW / cheekW, eyeR = eyeW / cheekW;
  const scores: Record<string, number> = {
    Long: 0, Diamond: 0, Triangle: 0, Heart: 0, Round: 0, Square: 0, Oval: 0,
  };
  scores.Long     += lenR > 1.60 ? 4 : lenR > 1.50 ? 2 : 0;
  scores.Diamond  += foreR < 0.82 ? 2 : 0; scores.Diamond += jawR < 0.78 ? 2 : 0;
  scores.Diamond  += eyeR > 0.84 ? 1 : 0; scores.Diamond += cheekW > foreW && cheekW > jawW ? 1 : 0;
  scores.Triangle += (jawR - foreR) > 0.15 ? 4 : (jawR - foreR) > 0.10 ? 2 : 0;
  scores.Heart    += (foreR - jawR) > 0.18 ? 4 : (foreR - jawR) > 0.12 ? 2 : 0;
  scores.Heart    += foreR > 0.88 ? 1 : 0;
  scores.Round    += lenR < 1.18 ? 3 : lenR < 1.25 ? 1 : 0;
  scores.Round    += jawR > 0.84 ? 2 : jawR > 0.78 ? 1 : 0; scores.Round += foreR > 0.84 ? 1 : 0;
  scores.Square   += lenR >= 1.18 && lenR < 1.38 ? 2 : 0;
  scores.Square   += jawR > 0.82 ? 3 : jawR > 0.76 ? 1 : 0;
  scores.Square   += Math.abs(foreR - jawR) < 0.08 ? 2 : 0;
  scores.Oval     += lenR >= 1.25 && lenR <= 1.55 ? 3 : 0;
  scores.Oval     += jawR >= 0.70 && jawR <= 0.84 ? 2 : 0;
  scores.Oval     += foreR >= 0.78 && foreR <= 0.92 ? 2 : 0;
  scores.Oval     += Math.abs(foreR - jawR) < 0.12 ? 1 : 0;
  if (lenR > 1.50) scores.Oval = Math.max(0, scores.Oval - 3);
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// yaw: pos = user turns to their left (mirror view), neg = right; pitch: pos = down, neg = up
function estimatePose(lm: Lm[]): { yaw: number; pitch: number } {
  const faceW = lm[454].x - lm[234].x;
  const yaw   = faceW > 0 ? ((lm[1].x - lm[234].x) / faceW - 0.5) * 2 : 0;
  const faceH = lm[152].y - lm[10].y;
  const pitch = faceH > 0 ? ((lm[1].y - lm[10].y) / faceH - 0.45) * 2 : 0;
  return { yaw, pitch };
}

// ── Ring / coverage ────────────────────────────────────────────────────────
const N_SEGS         = 8;    // ring segments
const FRAMES_PER_SEG = 12;   // frames to fill one segment
const INIT_FRAMES    = 20;   // frontal frames before circular guidance
const MIN_COVERED    = 5;    // segments needed to complete

// Map (yaw,pitch) → ring segment 0–7.
// Segment 0 = top = frontal, going CW: 2=right, 4=bottom, 6=left
function getSegment(yaw: number, pitch: number): number {
  if (Math.sqrt(yaw * yaw + pitch * pitch) < 0.08) return 0;
  let angle = Math.atan2(yaw, -pitch); // right=π/2, down=π, left=-π/2, up=0
  if (angle < 0) angle += 2 * Math.PI;
  return Math.floor((angle / (2 * Math.PI)) * N_SEGS) % N_SEGS;
}

// SVG arc path for ring segment i
const CX = 68, CY = 88, RING_R = 76;
function segArc(i: number): string {
  const gap   = 8; // degrees gap between segments
  const span  = 360 / N_SEGS - gap;
  const base  = 270 + i * (360 / N_SEGS) + gap / 2;
  const start = (base * Math.PI) / 180;
  const end   = ((base + span) * Math.PI) / 180;
  const x1 = CX + RING_R * Math.cos(start), y1 = CY + RING_R * Math.sin(start);
  const x2 = CX + RING_R * Math.cos(end),   y2 = CY + RING_R * Math.sin(end);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${RING_R} ${RING_R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// Current-position dot on ring
function dotOnRing(yaw: number, pitch: number): { x: number; y: number } {
  let angle = Math.atan2(yaw, -pitch) - Math.PI / 2; // top = -90°
  return {
    x: CX + RING_R * Math.cos(angle),
    y: CY + RING_R * Math.sin(angle),
  };
}

function coverageHint(covered: boolean[], phase: "init" | "scan"): string {
  if (phase === "init") return "Hold still — scanning front";
  const L = covered[5] || covered[6] || covered[7];
  const R = covered[1] || covered[2] || covered[3];
  const D = covered[3] || covered[4] || covered[5];
  if (!L && !R) return "Slowly turn your head left, then right";
  if (!L) return "Turn your head left more";
  if (!R) return "Turn your head right more";
  if (!D) return "Tilt your chin down slightly";
  return "Keep moving — almost done";
}

// ── Canvas drawing ─────────────────────────────────────────────────────────
function drawWire(
  ctx: CanvasRenderingContext2D,
  lm: Lm[],
  W: number, H: number,
) {
  const p = (i: number) => ({ x: lm[i].x * W, y: lm[i].y * H });

  // Silhouette
  ctx.beginPath();
  SILHOUETTE.forEach((idx, i) => {
    const { x, y } = p(idx);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = "rgba(201,168,130,0.80)";
  ctx.lineWidth = 1.5; ctx.stroke();

  // Wireframe features (low opacity — ghostly face mesh)
  const wireColor = "rgba(201,168,130,0.30)";
  [[WIRE_EYE_R], [WIRE_EYE_L], [WIRE_BROW_R], [WIRE_BROW_L], [WIRE_NOSE], [WIRE_LIPS]].forEach(([pts]) => {
    ctx.beginPath();
    pts.forEach((idx, i) => {
      const { x, y } = p(idx);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 1.2; ctx.stroke();
  });

  // Measurement dots
  MEASURE_PAIRS.forEach(([a, b, color]) => {
    const ax = lm[a].x * W, ay = lm[a].y * H;
    const bx = lm[b].x * W, by = lm[b].y * H;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = color + "55"; ctx.lineWidth = 0.7; ctx.stroke();
    [{ x: ax, y: ay }, { x: bx, y: by }].forEach(({ x, y }) => {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
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
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarker     = useRef<any>(null);
  const stream         = useRef<MediaStream | null>(null);
  const raf            = useRef<number>(0);
  const captured       = useRef(false);
  const measureBuf     = useRef<M[]>([]);
  const frontalImg     = useRef<string | null>(null); // best frontal frame
  const initAcc        = useRef(0);
  const segFrames      = useRef<number[]>(Array(N_SEGS).fill(0));
  const lastYaw        = useRef(0);
  const lastPitch      = useRef(0);

  const [status,       setStatus]       = useState<"loading" | "scanning" | "done" | "error">("loading");
  const [phase,        setPhase]        = useState<"init" | "scan">("init");
  const [covered,      setCovered]      = useState<boolean[]>(Array(N_SEGS).fill(false));
  const [coveredCount, setCoveredCount] = useState(0);
  const [faceShape,    setFaceShape]    = useState<string | null>(null);
  const [faceInView,   setFaceInView]   = useState(false);
  const [dot,          setDot]          = useState<{ x: number; y: number } | null>(null);
  const [initPct,      setInitPct]      = useState(0);

  const doCapture = useCallback(
    (shape: string) => {
      if (captured.current) return;
      captured.current = true;
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());

      // Prefer the saved frontal image for best skin analysis
      const useImage = frontalImg.current;
      if (useImage) {
        setStatus("done");
        setTimeout(() => onCapture(useImage, shape), 800);
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      const cap = document.createElement("canvas");
      cap.width = video.videoWidth; cap.height = video.videoHeight;
      const ctx = cap.getContext("2d")!;
      ctx.translate(cap.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
      setStatus("done");
      setTimeout(() => onCapture(cap.toDataURL("image/jpeg", 0.85), shape), 800);
    },
    [onCapture]
  );

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
      drawWire(ctx, lm, W, H);

      measureBuf.current.push(measure(lm));
      if (measureBuf.current.length > 180) measureBuf.current.shift();

      const { yaw, pitch } = estimatePose(lm);
      lastYaw.current   = yaw;
      lastPitch.current = pitch;
      setDot(dotOnRing(yaw, pitch));

      const isFrontal = Math.abs(yaw) < 0.10 && Math.abs(pitch) < 0.12;

      // Save best frontal frame (non-mirrored, highest quality)
      if (isFrontal && !frontalImg.current) {
        const cap = document.createElement("canvas");
        cap.width = W; cap.height = H;
        const c = cap.getContext("2d")!;
        c.translate(W, 0); c.scale(-1, 1); c.drawImage(video, 0, 0);
        frontalImg.current = cap.toDataURL("image/jpeg", 0.90);
      }

      if (measureBuf.current.length >= 20) {
        const shape = classifyFromAvg(avgBuffer(measureBuf.current));
        setFaceShape(shape);
      }

      // ── Phase: init (frontal hold) ──
      if (initAcc.current < INIT_FRAMES) {
        if (isFrontal) {
          initAcc.current += 1;
          setInitPct(initAcc.current / INIT_FRAMES);
        } else {
          initAcc.current = Math.max(0, initAcc.current - 0.5);
          setInitPct(initAcc.current / INIT_FRAMES);
        }
        if (initAcc.current >= INIT_FRAMES) {
          setPhase("scan");
        }
      } else {
        // ── Phase: circular scan ──
        const seg = getSegment(yaw, pitch);
        const prev = segFrames.current[seg];
        const next = Math.min(prev + 1, FRAMES_PER_SEG);
        if (next !== prev) {
          segFrames.current[seg] = next;
          if (next >= FRAMES_PER_SEG) {
            setCovered(prev => {
              const n = [...prev];
              n[seg] = true;
              const count = n.filter(Boolean).length;
              setCoveredCount(count);
              if (count >= MIN_COVERED && measureBuf.current.length >= 20) {
                const finalShape = classifyFromAvg(avgBuffer(measureBuf.current));
                setFaceShape(finalShape);
                doCapture(finalShape);
              }
              return n;
            });
          }
        }
      }
    } else {
      setFaceInView(false);
      setDot(null);
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
          runningMode: "VIDEO", numFaces: 1,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
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

  const totalPct = coveredCount / N_SEGS;

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

          {/* Face ID ring overlay */}
          {status === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`}
                style={{ overflow: "visible" }}>
                {/* 8 ring segments */}
                {Array.from({ length: N_SEGS }, (_, i) => (
                  <path
                    key={i}
                    d={segArc(i)}
                    fill="none"
                    stroke={covered[i] ? "#C9A882" : "rgba(255,255,255,0.18)"}
                    strokeWidth={covered[i] ? 3.5 : 2}
                    strokeLinecap="round"
                    style={{ transition: "stroke 0.4s ease, stroke-width 0.3s ease" }}
                  />
                ))}
                {/* Trailing dot showing current head position */}
                {dot && faceInView && (
                  <motion.circle
                    cx={dot.x} cy={dot.y} r={5}
                    fill="#C9A882"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{ filter: "drop-shadow(0 0 4px #C9A882)" }}
                  />
                )}
              </svg>
            </div>
          )}

          {/* Init phase arc progress inside camera */}
          {status === "scanning" && phase === "init" && faceInView && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <div className="bg-black/50 rounded-full px-3 py-1">
                <div className="w-24 bg-white/20 rounded-full h-0.5 overflow-hidden">
                  <motion.div
                    className="bg-[#C9A882] h-0.5 rounded-full"
                    animate={{ width: `${initPct * 100}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>
            </div>
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

        {/* Instruction panel */}
        {status === "scanning" && (
          <div className="px-5 py-4 space-y-3">
            {/* Segment dots row */}
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: N_SEGS }, (_, i) => (
                <motion.div
                  key={i}
                  animate={{ backgroundColor: covered[i] ? "#4A3728" : "#C9A882", opacity: covered[i] ? 1 : 0.35 }}
                  transition={{ duration: 0.4 }}
                  className="w-2 h-2 rounded-full"
                />
              ))}
            </div>

            {/* Instruction text */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${phase}-${faceInView}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <p className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  {!faceInView
                    ? "Position your face"
                    : phase === "init"
                    ? "Look straight ahead"
                    : "Move your head in a circle"
                  }
                </p>
                <p className="font-sans text-xs text-brown-mid mt-1">
                  {!faceInView
                    ? "Move closer to the camera"
                    : phase === "scan"
                    ? coverageHint(covered, phase)
                    : "Hold still while we scan"
                  }
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Overall ring fill bar */}
            <div className="w-full bg-brown-light/20 rounded-full h-0.5 overflow-hidden">
              <motion.div
                className="bg-brown-dark h-0.5 rounded-full"
                animate={{ width: `${totalPct * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {/* Manual capture once enough scanned */}
            {coveredCount >= MIN_COVERED && faceShape && (
              <button
                onClick={() => doCapture(faceShape)}
                className="w-full border border-brown-light text-brown-dark py-2 rounded-xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-light/20 transition-colors"
              >
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
