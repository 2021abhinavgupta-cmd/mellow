"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const HOLD_MS = 4000;

type Status = "instructions" | "loading" | "scanning" | "done" | "error";

interface Props {
  onCapture: (imageDataUrl: string) => void;
  onClose: () => void;
}

export default function SkinScanner({ onCapture, onClose }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").FaceLandmarker | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number>(0);
  const holdStart     = useRef<number | null>(null);
  const capturedRef   = useRef(false);
  const holdPctRef    = useRef(0); // mirrors holdPct state for canvas loop (avoids stale closure)

  const [status,     setStatus]     = useState<Status>("instructions");
  const [loadKey,    setLoadKey]    = useState(0);
  const [holdPct,    setHoldPct]    = useState(0);
  const [faceInView, setFaceInView] = useState(false);
  const [tooFar,     setTooFar]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const TIPS = [
    "Move close — your face should fill most of the frame",
    "Find a spot with bright, even, natural light (face a window)",
    "Remove glasses and pull hair back from your face",
    "Hold completely still for 4 seconds while scanning",
    "Clean, bare skin gives the most accurate analysis",
  ];

  // ── Init camera + MediaPipe ─────────────────────────────────────────────────
  useEffect(() => {
    if (loadKey === 0) return;
    let cancelled = false;

    async function init() {
      try {
        setStatus("loading");
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });
        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current!;
        video.srcObject = stream;
        await new Promise<void>(res => { video.onloadedmetadata = () => res(); });
        await video.play();
        if (cancelled) return;

        setStatus("scanning");
        capturedRef.current = false;
        holdStart.current = null;
        holdPctRef.current = 0;
        startLoop();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Camera error");
          setStatus("error");
        }
      }
    }

    function startLoop() {
      const video  = videoRef.current!;
      const canvas = canvasRef.current!;

      function loop() {
        if (cancelled || capturedRef.current) return;

        const W = video.videoWidth;
        const H = video.videoHeight;
        if (!W || !H || video.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }

        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        const result = landmarkerRef.current?.detectForVideo(video, performance.now());
        const lm = result?.faceLandmarks?.[0];
        const mx = result?.facialTransformationMatrixes?.[0];

        // ── Derive face position + pose (requires lm) ──────────────────────
        let steady  = false;
        let far     = false;
        let faceCx  = W / 2;
        let faceCy  = H * 0.46;

        if (lm && mx) {
          // iPhone portrait fix — same 3-part correction as FaceScanner
          const devicePortrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
          const videoRotated   = W > H && devicePortrait;
          const applyRot       = (lms: typeof lm) => videoRotated
            ? lms.map(p => ({ x: p.y, y: 1 - p.x, z: p.z }))
            : lms;
          const lmC = applyRot(lm);
          const mW  = videoRotated ? H : W;
          const mH  = videoRotated ? W : H;

          // Face center for canvas overlay — raw lm coords map to raw video pixel space
          faceCx = (lm[234].x + lm[454].x) / 2 * W;
          faceCy = (lm[10].y  + lm[152].y) / 2 * H;

          // Close-up check (stricter than FaceScanner)
          const cheekW     = Math.sqrt(
            ((lmC[234].x - lmC[454].x) * mW) ** 2 +
            ((lmC[234].y - lmC[454].y) * mH) ** 2
          );
          far = cheekW / mW < 0.20;

          // Pose — very frontal required for skin detail
          const data     = mx.data;
          const rawYaw   = Math.atan2(data[1], data[5]);
          const rawPitch = Math.atan2(-data[2], Math.sqrt(data[6] ** 2 + data[10] ** 2));
          const { yaw, pitch } = videoRotated
            ? { yaw: rawPitch, pitch: -rawYaw }
            : { yaw: rawYaw, pitch: rawPitch };

          steady = Math.abs(yaw) < 0.10 && Math.abs(pitch) < 0.12 && !far;
        }

        // ── Canvas draw — always runs so oval shows even when no face ──────
        ctx.clearRect(0, 0, W, H);
        const rx = W * 0.36, ry = H * 0.44;
        ctx.beginPath();
        ctx.ellipse(faceCx, faceCy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = steady
          ? `rgba(139,99,71,${0.5 + holdPctRef.current * 0.5})`
          : lm
            ? "rgba(139,99,71,0.5)"   // face detected, not yet steady
            : "rgba(139,99,71,0.3)";  // no face — faint guide
        ctx.lineWidth = 2;
        ctx.setLineDash(steady ? [] : [8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── No face ────────────────────────────────────────────────────────
        if (!lm || !mx) {
          setFaceInView(false);
          setTooFar(false);
          holdStart.current = null;
          setHoldPct(0);
          holdPctRef.current = 0;
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        setFaceInView(true);
        setTooFar(far);

        // ── Hold timer ─────────────────────────────────────────────────────
        const now = Date.now();
        if (steady) {
          if (holdStart.current === null) holdStart.current = now;
          const pct = Math.min((now - holdStart.current) / HOLD_MS, 1);
          setHoldPct(pct);
          holdPctRef.current = pct;

          if (pct >= 1 && !capturedRef.current) {
            capturedRef.current = true;
            capture(video, lm, W, H);
            return;
          }
        } else {
          holdStart.current = null;
          setHoldPct(0);
          holdPctRef.current = 0;
        }

        rafRef.current = requestAnimationFrame(loop);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      streamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  // ── Capture — crop face region for maximum skin detail ───────────────────
  function capture(video: HTMLVideoElement, lm: { x: number; y: number; z: number }[], W: number, H: number) {
    const pad = 0.12;
    const xs  = lm.map(p => p.x);
    const ys  = lm.map(p => p.y);
    const sx  = Math.max(0, Math.min(...xs) - pad) * W;
    const sy  = Math.max(0, Math.min(...ys) - pad) * H;
    const sw  = (Math.min(1, Math.max(...xs) + pad) - Math.max(0, Math.min(...xs) - pad)) * W;
    const sh  = (Math.min(1, Math.max(...ys) + pad) - Math.max(0, Math.min(...ys) - pad)) * H;

    // Upscale crop to 800px wide for more pixel detail sent to GPT-4o
    const outW      = 800;
    const outH      = Math.round(sh * (outW / sw));
    const offscreen = document.createElement("canvas");
    offscreen.width  = outW;
    offscreen.height = outH;
    offscreen.getContext("2d")!.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

    setStatus("done");
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(offscreen.toDataURL("image/jpeg", 0.92));
  }

  const handleRetry = useCallback(() => {
    capturedRef.current  = false;
    holdStart.current    = null;
    holdPctRef.current   = 0;
    setHoldPct(0);
    setFaceInView(false);
    setTooFar(false);
    setError(null);
    setStatus("loading");
    setLoadKey(k => k + 1);
  }, []);

  // ── Hint text ────────────────────────────────────────────────────────────
  function hint() {
    if (tooFar)       return "Move closer — face should fill the oval";
    if (!faceInView)  return "Position face in oval — good lighting helps detection";
    if (holdPct > 0)  return `Hold still — ${Math.ceil((1 - holdPct) * HOLD_MS / 1000)}s remaining`;
    return "Face detected — hold perfectly still";
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Skin Scan
        </span>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brown-light/20 transition-colors"
        >
          <X className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
        </button>
      </div>

      {/* Instructions */}
      <AnimatePresence>
        {status === "instructions" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 pb-10"
          >
            <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-6">
              Before scanning
            </p>
            <ul className="space-y-4 mb-10 max-w-xs w-full">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex gap-3 font-sans text-sm text-brown-dark leading-snug">
                  <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid mt-0.5 flex-shrink-0">
                    0{i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
            <p className="font-sans text-[0.6rem] text-brown-mid/60 text-center max-w-xs mb-8 leading-relaxed">
              Results are a visual assessment only — not a medical diagnosis.
            </p>
            <button
              onClick={() => { setStatus("loading"); setLoadKey(k => k + 1); }}
              className="px-10 py-3.5 bg-brown-dark text-cream rounded-full font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-mid transition-colors"
            >
              Start Scan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera view */}
      {(status === "loading" || status === "scanning") && (
        <div className="flex-1 flex flex-col items-center justify-start pt-4 pb-8 px-4">
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-brown-dark/10">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              playsInline muted autoPlay
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
            />

            {/* Hold progress ring */}
            {holdPct > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 100 100" className="w-16 h-16">
                  <circle cx={50} cy={50} r={44} fill="none" stroke="rgba(139,99,71,0.2)" strokeWidth={6} />
                  <circle
                    cx={50} cy={50} r={44} fill="none"
                    stroke="#8B6347" strokeWidth={6}
                    strokeDasharray={`${holdPct * 276.5} 276.5`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
              </div>
            )}

            {/* Loading overlay */}
            {status === "loading" && (
              <div className="absolute inset-0 bg-cream/80 flex items-center justify-center">
                <p className="font-sans text-xs text-brown-mid tracking-widest">Starting camera…</p>
              </div>
            )}
          </div>

          <p className="font-sans text-xs text-brown-mid mt-4 tracking-wide text-center">
            {status === "scanning" ? hint() : "Loading…"}
          </p>

          {holdPct > 0 && (
            <div className="mt-3 w-48 h-0.5 bg-brown-light/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brown-mid rounded-full"
                style={{ width: `${holdPct * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Done — brief feedback before onCapture navigates away */}
      {status === "done" && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-2"
          >
            <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
              Captured
            </p>
            <p className="font-sans text-xs text-brown-mid tracking-widest">Analysing…</p>
          </motion.div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <p className="font-sans text-xs text-brown-mid">{error ?? "Something went wrong"}</p>
          <button
            onClick={handleRetry}
            className="px-8 py-3 bg-brown-dark text-cream rounded-full font-sans text-xs tracking-widest uppercase hover:bg-brown-mid transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
