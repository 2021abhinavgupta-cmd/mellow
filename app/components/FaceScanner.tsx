"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Face oval silhouette
const SILHOUETTE = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// Measurement dot pairs [a, b, color]
const MEASURE_PAIRS: [number, number, string][] = [
  [54,  284, "#C9A882"],  // forehead (temple-to-temple)
  [33,  263, "#C9A882"],  // eye width (outer corners)
  [234, 454, "#8B6347"],  // cheekbones
  [172, 397, "#4A3728"],  // jaw corners
];

// Accumulate 60 frames (~2s), require 30 before first classification
const BUFFER_SIZE   = 60;
const MIN_FRAMES    = 30;
const STABLE_TARGET = 60;

interface M { foreW: number; eyeW: number; cheekW: number; jawW: number; faceLen: number }

function d2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function measure(lm: Array<{ x: number; y: number }>): M {
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

  // All ratios relative to cheekW (most stable landmark pair)
  const lenR  = faceLen / cheekW;
  const jawR  = jawW    / cheekW;
  const foreR = foreW   / cheekW;
  const eyeR  = eyeW    / cheekW;

  // Scoring approach — highest score wins
  const scores: Record<string, number> = {
    Long:     0,
    Diamond:  0,
    Triangle: 0,
    Heart:    0,
    Round:    0,
    Square:   0,
    Oval:     0,
  };

  // Long: face much taller than wide
  scores.Long     += lenR > 1.60 ? 4 : lenR > 1.50 ? 2 : 0;

  // Diamond: cheeks clearly widest, narrow forehead AND jaw, eyes moderate
  scores.Diamond  += foreR < 0.82 ? 2 : 0;
  scores.Diamond  += jawR  < 0.78 ? 2 : 0;
  scores.Diamond  += eyeR  > 0.84 ? 1 : 0;
  scores.Diamond  += cheekW > foreW && cheekW > jawW ? 1 : 0;

  // Triangle (pear): jaw wider than forehead
  const jawForeGap = jawR - foreR;
  scores.Triangle += jawForeGap > 0.15 ? 4 : jawForeGap > 0.10 ? 2 : 0;

  // Heart: forehead wider than jaw, moderate cheeks
  const forJawGap = foreR - jawR;
  scores.Heart    += forJawGap > 0.18 ? 4 : forJawGap > 0.12 ? 2 : 0;
  scores.Heart    += foreR > 0.88 ? 1 : 0;

  // Round: face nearly as wide as long, wide jaw, wide forehead
  scores.Round    += lenR < 1.18 ? 3 : lenR < 1.25 ? 1 : 0;
  scores.Round    += jawR > 0.84 ? 2 : jawR > 0.78 ? 1 : 0;
  scores.Round    += foreR > 0.84 ? 1 : 0;

  // Square: moderate length, strong wide jaw
  scores.Square   += lenR >= 1.18 && lenR < 1.38 ? 2 : 0;
  scores.Square   += jawR > 0.82 ? 3 : jawR > 0.76 ? 1 : 0;
  scores.Square   += Math.abs(foreR - jawR) < 0.08 ? 2 : 0; // fore ≈ jaw = square

  // Oval: balanced — slightly longer than wide, moderate ratios
  scores.Oval     += lenR >= 1.25 && lenR <= 1.55 ? 3 : 0;
  scores.Oval     += jawR >= 0.70 && jawR <= 0.84 ? 2 : 0;
  scores.Oval     += foreR >= 0.78 && foreR <= 0.92 ? 2 : 0;
  scores.Oval     += Math.abs(foreR - jawR) < 0.12 ? 1 : 0;

  // Long gets a boost over Oval if very long
  if (lenR > 1.50) scores.Oval = Math.max(0, scores.Oval - 3);

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

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
  const stableCount = useRef(0);
  const captured    = useRef(false);
  const measureBuf  = useRef<M[]>([]);

  const [status,         setStatus]         = useState<"loading" | "scanning" | "done" | "error">("loading");
  const [faceShape,      setFaceShape]      = useState<string | null>(null);
  const [stableProgress, setStableProgress] = useState(0);

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
      setTimeout(() => onCapture(cap.toDataURL("image/jpeg", 0.82), shape), 700);
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
    try {
      results = lmkr.detectForVideo(video, performance.now());
    } catch {
      raf.current = requestAnimationFrame(detect);
      return;
    }

    if (results.faceLandmarks.length > 0) {
      const lm = results.faceLandmarks[0];

      // Draw silhouette
      ctx.beginPath();
      SILHOUETTE.forEach((idx, i) => {
        const x = lm[idx].x * W;
        const y = lm[idx].y * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = "rgba(201,168,130,0.85)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Draw measurement dots + connecting lines
      MEASURE_PAIRS.forEach(([a, b, color]) => {
        const ax = lm[a].x * W;
        const ay = lm[a].y * H;
        const bx = lm[b].x * W;
        const by = lm[b].y * H;

        // Connecting line (subtle)
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = color + "55";
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        // Dots
        [{ x: ax, y: ay }, { x: bx, y: by }].forEach(({ x, y }) => {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      });

      // Accumulate measurement frame into rolling buffer
      const m = measure(lm);
      measureBuf.current.push(m);
      if (measureBuf.current.length > BUFFER_SIZE) measureBuf.current.shift();

      // Classify only once we have enough frames for a stable average
      if (measureBuf.current.length >= MIN_FRAMES) {
        const shape = classifyFromAvg(avgBuffer(measureBuf.current));
        setFaceShape(shape);
      }

      stableCount.current += 1;
      setStableProgress(Math.min(stableCount.current / STABLE_TARGET, 1));

      if (stableCount.current >= STABLE_TARGET && measureBuf.current.length >= MIN_FRAMES) {
        const finalShape = classifyFromAvg(avgBuffer(measureBuf.current));
        doCapture(finalShape);
        return;
      }
    } else {
      // Face lost — reset counts but keep buffer (partial data still useful)
      stableCount.current = 0;
      setStableProgress(0);
      // Clear buffer fully only if face gone for a while (handled by next frames)
      measureBuf.current = [];
      setFaceShape(null);
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
          <span className="font-display text-lg text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            Face Scan
          </span>
          <button onClick={onClose} className="text-brown-mid hover:text-brown-dark transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera + canvas */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Oval guide */}
          {status === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="border-2 border-dashed border-white/25 rounded-full"
                style={{ width: "58%", height: "78%" }}
              />
            </div>
          )}

          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/90 gap-3">
              <div className="w-8 h-8 border-2 border-brown-light border-t-brown-dark rounded-full animate-spin" />
              <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid">Loading scanner</p>
            </div>
          )}

          {status === "done" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 gap-2">
              <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                {faceShape}
              </p>
              <p className="font-sans text-[0.6rem] tracking-[0.35em] uppercase text-brown-mid">face shape detected</p>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream/95 p-6 text-center gap-3">
              <p className="font-sans text-sm text-brown-dark">Camera access denied or scanner unavailable.</p>
              <button onClick={onClose} className="font-sans text-xs text-brown-mid underline underline-offset-2">
                Upload a photo instead
              </button>
            </div>
          )}
        </div>

        {/* Progress bar + status text */}
        {status === "scanning" && (
          <div className="px-5 py-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="font-sans text-xs text-brown-mid tracking-wide">
                {faceShape
                  ? `${faceShape} face — hold still to confirm`
                  : "Position your face in the oval"}
              </p>
              {faceShape && (
                <span className="font-sans text-[0.65rem] text-brown-dark tabular-nums">
                  {Math.round(stableProgress * 100)}%
                </span>
              )}
            </div>
            {faceShape && (
              <div className="w-full bg-brown-light/25 rounded-full h-0.5 overflow-hidden">
                <motion.div
                  className="bg-brown-dark h-0.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${stableProgress * 100}%` }}
                  transition={{ duration: 0.08 }}
                />
              </div>
            )}
            {faceShape && stableProgress > 0.5 && (
              <button
                onClick={() => doCapture(faceShape)}
                className="w-full border border-brown-light text-brown-dark py-2 rounded-xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-light/20 transition-colors"
              >
                Capture Now
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
