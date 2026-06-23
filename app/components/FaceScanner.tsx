"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SILHOUETTE = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

const MEASURE_PAIRS: [number, number, string][] = [
  [54,  284, "#C9A882"],
  [33,  263, "#C9A882"],
  [234, 454, "#8B6347"],
  [172, 397, "#4A3728"],
];

interface M { foreW: number; eyeW: number; cheekW: number; jawW: number; faceLen: number }
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
  const lenR  = faceLen / cheekW;
  const jawR  = jawW    / cheekW;
  const foreR = foreW   / cheekW;
  const eyeR  = eyeW    / cheekW;

  const scores: Record<string, number> = {
    Long: 0, Diamond: 0, Triangle: 0, Heart: 0, Round: 0, Square: 0, Oval: 0,
  };

  scores.Long     += lenR > 1.60 ? 4 : lenR > 1.50 ? 2 : 0;
  scores.Diamond  += foreR < 0.82 ? 2 : 0;
  scores.Diamond  += jawR  < 0.78 ? 2 : 0;
  scores.Diamond  += eyeR  > 0.84 ? 1 : 0;
  scores.Diamond  += cheekW > foreW && cheekW > jawW ? 1 : 0;
  const jawForeGap = jawR - foreR;
  scores.Triangle += jawForeGap > 0.15 ? 4 : jawForeGap > 0.10 ? 2 : 0;
  const forJawGap  = foreR - jawR;
  scores.Heart    += forJawGap > 0.18 ? 4 : forJawGap > 0.12 ? 2 : 0;
  scores.Heart    += foreR > 0.88 ? 1 : 0;
  scores.Round    += lenR < 1.18 ? 3 : lenR < 1.25 ? 1 : 0;
  scores.Round    += jawR > 0.84 ? 2 : jawR > 0.78 ? 1 : 0;
  scores.Round    += foreR > 0.84 ? 1 : 0;
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

// yaw: 0=frontal, pos=nose right in raw image = user's displayed face left (mirror)
// pitch: 0=frontal, neg=up, pos=down
function estimatePose(lm: Lm[]): { yaw: number; pitch: number } {
  const faceW = lm[454].x - lm[234].x;
  const yaw   = faceW > 0 ? ((lm[1].x - lm[234].x) / faceW - 0.5) * 2 : 0;

  const faceH = lm[152].y - lm[10].y;
  const pitch = faceH > 0 ? ((lm[1].y - lm[10].y) / faceH - 0.45) * 2 : 0;

  return { yaw, pitch };
}

interface StageConfig {
  id: string;
  label: string;
  sub: string;
  yaw: [number, number];
  pitch: [number, number];
  frames: number;
  arrow: "none" | "left" | "right" | "up" | "down";
}

// yaw positive = displayed-left (mirrored), negative = displayed-right
const STAGES: StageConfig[] = [
  { id: "front", label: "Look straight ahead", sub: "Face the camera directly",    yaw: [-0.22, 0.22],  pitch: [-0.28, 0.28],  frames: 25, arrow: "none"  },
  { id: "left",  label: "Turn your head left",  sub: "Slowly rotate to your left",  yaw: [0.28,  0.85],  pitch: [-0.30, 0.30],  frames: 20, arrow: "left"  },
  { id: "right", label: "Turn your head right", sub: "Slowly rotate to your right", yaw: [-0.85, -0.28], pitch: [-0.30, 0.30],  frames: 20, arrow: "right" },
  { id: "up",    label: "Tilt your head up",    sub: "Look up slightly",            yaw: [-0.25, 0.25],  pitch: [-0.65, -0.22], frames: 15, arrow: "up"    },
  { id: "down",  label: "Tilt your head down",  sub: "Look down slightly",          yaw: [-0.25, 0.25],  pitch: [0.22,  0.65],  frames: 15, arrow: "down"  },
];

const TOTAL_FRAMES = STAGES.reduce((s, st) => s + st.frames, 0); // 95

interface Props {
  onCapture: (imageDataUrl: string, faceShape: string) => void;
  onClose: () => void;
}

// Animated arrow outside the oval area
function DirectionArrow({ dir }: { dir: StageConfig["arrow"] }) {
  if (dir === "none") return null;
  const base = "absolute pointer-events-none flex items-center justify-center";
  const pos: Record<string, string> = {
    left:  "left-3 top-1/2 -translate-y-1/2",
    right: "right-3 top-1/2 -translate-y-1/2",
    up:    "top-3 left-1/2 -translate-x-1/2",
    down:  "bottom-3 left-1/2 -translate-x-1/2",
  };
  const arrows: Record<string, string> = { left: "←", right: "→", up: "↑", down: "↓" };
  const anim: Record<string, object> = {
    left:  { x: [-4, 0, -4] },
    right: { x: [4, 0, 4] },
    up:    { y: [-4, 0, -4] },
    down:  { y: [4, 0, 4] },
  };

  return (
    <motion.div
      key={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, ...anim[dir] }}
      transition={{ opacity: { duration: 0.3 }, ...{ x: undefined, y: undefined }, default: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }}
      className={`${base} ${pos[dir]}`}
    >
      <span className="text-white/60 text-4xl font-light leading-none" style={{ textShadow: "0 0 12px rgba(255,255,255,0.3)" }}>
        {arrows[dir]}
      </span>
    </motion.div>
  );
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
  const stageIdx    = useRef(0);
  const stageAcc    = useRef(0); // accumulator with decay
  const totalAcc    = useRef(0);

  const [status,        setStatus]        = useState<"loading" | "scanning" | "done" | "error">("loading");
  const [faceShape,     setFaceShape]     = useState<string | null>(null);
  const [currentStage,  setCurrentStage]  = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);
  const [faceInView,    setFaceInView]    = useState(false);
  const [poseOk,        setPoseOk]        = useState(false);

  const doCapture = useCallback(
    (shape: string) => {
      if (captured.current) return;
      captured.current = true;
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      if (!video) return;
      const cap = document.createElement("canvas");
      cap.width  = video.videoWidth;
      cap.height = video.videoHeight;
      const ctx  = cap.getContext("2d")!;
      ctx.translate(cap.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      setStatus("done");
      setTimeout(() => onCapture(cap.toDataURL("image/jpeg", 0.82), shape), 800);
    },
    [onCapture]
  );

  const detect = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const lmkr   = landmarker.current;
    if (!video || !canvas || !lmkr || video.readyState < 2) {
      raf.current = requestAnimationFrame(detect);
      return;
    }

    const W = video.videoWidth;
    const H = video.videoHeight;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    let results;
    try { results = lmkr.detectForVideo(video, performance.now()); }
    catch { raf.current = requestAnimationFrame(detect); return; }

    if (results.faceLandmarks.length > 0) {
      const lm = results.faceLandmarks[0];
      setFaceInView(true);

      // Draw silhouette
      ctx.beginPath();
      SILHOUETTE.forEach((idx, i) => {
        const x = lm[idx].x * W, y = lm[idx].y * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = "rgba(201,168,130,0.85)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Draw measurement dots
      MEASURE_PAIRS.forEach(([a, b, color]) => {
        const ax = lm[a].x * W, ay = lm[a].y * H;
        const bx = lm[b].x * W, by = lm[b].y * H;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.strokeStyle = color + "55"; ctx.lineWidth = 0.8; ctx.stroke();
        [{ x: ax, y: ay }, { x: bx, y: by }].forEach(({ x, y }) => {
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
        });
      });

      // Accumulate measurements
      measureBuf.current.push(measure(lm));
      if (measureBuf.current.length > 150) measureBuf.current.shift();

      const { yaw, pitch } = estimatePose(lm);
      const stage = STAGES[stageIdx.current];
      const ok = yaw >= stage.yaw[0] && yaw <= stage.yaw[1] &&
                 pitch >= stage.pitch[0] && pitch <= stage.pitch[1];
      setPoseOk(ok);

      if (ok) {
        stageAcc.current = Math.min(stageAcc.current + 1, stage.frames);
        totalAcc.current = Math.min(totalAcc.current + 1, TOTAL_FRAMES);
      } else {
        // Soft decay — don't reset completely; lose 0.5/frame
        stageAcc.current = Math.max(0, stageAcc.current - 0.5);
      }

      const sp = stageAcc.current / stage.frames;
      const tp = totalAcc.current / TOTAL_FRAMES;
      setStageProgress(sp);
      setTotalProgress(tp);

      if (measureBuf.current.length >= 15) {
        setFaceShape(classifyFromAvg(avgBuffer(measureBuf.current)));
      }

      if (stageAcc.current >= stage.frames) {
        const next = stageIdx.current + 1;
        if (next >= STAGES.length) {
          const finalShape = measureBuf.current.length >= 15
            ? classifyFromAvg(avgBuffer(measureBuf.current))
            : "Oval";
          doCapture(finalShape);
          return;
        }
        stageIdx.current  = next;
        stageAcc.current  = 0;
        setCurrentStage(next);
        setStageProgress(0);
      }
    } else {
      setFaceInView(false);
      setPoseOk(false);
      stageAcc.current = Math.max(0, stageAcc.current - 1);
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
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled) { lmkr.close(); return; }
        landmarker.current = lmkr;
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { mediaStream.getTracks().forEach((t) => t.stop()); return; }
        stream.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
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

  const stage = STAGES[currentStage];

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
          <div>
            <span className="font-display text-lg text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
              Face Scan
            </span>
            {faceShape && status === "scanning" && (
              <span className="ml-2 font-sans text-xs text-brown-mid">· {faceShape}</span>
            )}
          </div>
          <button onClick={onClose} className="text-brown-mid hover:text-brown-dark transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera area */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Directional arrow guide */}
          {status === "scanning" && (
            <AnimatePresence mode="wait">
              <DirectionArrow key={stage.id} dir={stage.arrow} />
            </AnimatePresence>
          )}

          {/* Oval + ring progress overlay */}
          {status === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width="130" height="170" viewBox="0 0 130 170">
                {/* Background ring */}
                <ellipse cx="65" cy="85" rx="58" ry="78"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2"
                />
                {/* Completed progress ring */}
                <ellipse cx="65" cy="85" rx="58" ry="78"
                  fill="none"
                  stroke={poseOk ? "#C9A882" : "rgba(255,255,255,0.25)"}
                  strokeWidth="3"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 - totalProgress * 100}
                  strokeLinecap="round"
                  transform="rotate(-90 65 85)"
                  style={{ transition: "stroke-dashoffset 0.15s ease, stroke 0.3s ease" }}
                />
                {/* Stage segment markers */}
                {STAGES.map((_, i) => {
                  const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
                  const mx = 65 + 58 * Math.cos(angle);
                  const my = 85 + 78 * Math.sin(angle);
                  return (
                    <circle key={i} cx={mx} cy={my} r={3}
                      fill={i <= currentStage ? "#C9A882" : "rgba(255,255,255,0.2)"}
                      style={{ transition: "fill 0.4s ease" }}
                    />
                  );
                })}
              </svg>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 gap-2"
            >
              <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                {faceShape}
              </p>
              <p className="font-sans text-[0.6rem] tracking-[0.35em] uppercase text-brown-mid">face shape detected</p>
            </motion.div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 p-6 text-center gap-3">
              <p className="font-sans text-sm text-brown-dark">Camera access denied or scanner unavailable.</p>
              <button onClick={onClose} className="font-sans text-xs text-brown-mid underline underline-offset-2">
                Upload a photo instead
              </button>
            </div>
          )}
        </div>

        {/* Stage dots + instruction */}
        {status === "scanning" && (
          <div className="px-5 py-4 space-y-3">
            {/* Stage pill dots */}
            <div className="flex items-center justify-center gap-1.5">
              {STAGES.map((s, i) => (
                <motion.div
                  key={s.id}
                  animate={{
                    width: i === currentStage ? 28 : 8,
                    backgroundColor: i < currentStage ? "#4A3728" : i === currentStage ? "#8B6347" : "#C9A882",
                    opacity: i > currentStage ? 0.35 : 1,
                  }}
                  transition={{ duration: 0.35 }}
                  className="h-2 rounded-full"
                />
              ))}
            </div>

            {/* Instruction text */}
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                <p className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  {!faceInView ? "Position your face" : stage.label}
                </p>
                <p className="font-sans text-xs text-brown-mid mt-1">
                  {!faceInView
                    ? "Move your face into the oval guide"
                    : !poseOk
                    ? stage.sub
                    : faceShape
                    ? `${faceShape} · Hold still…`
                    : "Hold still…"
                  }
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Per-stage progress bar */}
            <div className="w-full bg-brown-light/20 rounded-full h-0.5 overflow-hidden">
              <motion.div
                className="h-0.5 rounded-full"
                animate={{
                  width: `${stageProgress * 100}%`,
                  backgroundColor: poseOk ? "#4A3728" : "#C9A882",
                }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Manual capture (fallback once 3+ stages done) */}
            {currentStage >= 3 && totalProgress > 0.6 && faceShape && (
              <button
                onClick={() => doCapture(faceShape)}
                className="w-full border border-brown-light text-brown-dark py-2 rounded-xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-light/20 transition-colors"
              >
                Use {faceShape} · Capture Now
              </button>
            )}
          </div>
        )}
      </motion.div>

      <p className="font-sans text-[0.6rem] text-cream/40 mt-4 tracking-wide text-center">
        Camera stays on your device — nothing is uploaded during scanning
      </p>
    </div>
  );
}
