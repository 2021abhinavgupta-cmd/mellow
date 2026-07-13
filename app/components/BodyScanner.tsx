"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { classifyFromPose, type BodyShape } from "@/app/lib/bodyShape";

const WASM_URL  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const HOLD_MS = 5000;

// Key landmark indices (MediaPipe pose 33-point model)
const LM_L_SHOULDER = 11;
const LM_R_SHOULDER = 12;
const LM_L_HIP      = 23;
const LM_R_HIP      = 24;

// Skeleton segments to draw
const SEGMENTS = [
  [LM_L_SHOULDER, LM_R_SHOULDER],
  [LM_L_SHOULDER, LM_L_HIP],
  [LM_R_SHOULDER, LM_R_HIP],
  [LM_L_HIP, LM_R_HIP],
] as const;

type Status = "instructions" | "loading" | "countdown" | "scanning" | "done" | "error";

interface Props {
  onCapture: (shape: BodyShape, confident: boolean) => void;
  onClose: () => void;
}

export default function BodyScanner({ onCapture, onClose }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").PoseLandmarker | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number>(0);
  const holdStart     = useRef<number | null>(null);
  const capturedRef   = useRef(false);
  const holdPctRef    = useRef(0);
  const onCaptureRef  = useRef(onCapture);

  // Always keep ref current so RAF loop sees latest callback without stale closure
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);

  const [status,      setStatus]      = useState<Status>("instructions");
  const [loadKey,     setLoadKey]     = useState(0);
  const [holdPct,     setHoldPct]     = useState(0);
  const [bodyInView,  setBodyInView]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [countdown,   setCountdown]   = useState(5);

  const TIPS = [
    "Stand 1.5–2 metres from camera so full body is visible",
    "Face camera directly — feet hip-width apart, arms relaxed",
    "Wear fitted clothing (not baggy) for accurate proportions",
    "Good lighting and a plain background help accuracy",
    "Hold still for 5 seconds while scanning",
  ];

  // ── Init camera + MediaPipe PoseLandmarker ──────────────────────────────────
  useEffect(() => {
    if (loadKey === 0) return;
    let cancelled = false;

    async function init() {
      try {
        setStatus("loading");
        const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
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

        // 5-second countdown before scanning
        capturedRef.current  = false;
        holdStart.current    = null;
        holdPctRef.current   = 0;
        setStatus("countdown");
        for (let i = 5; i >= 1; i--) {
          if (cancelled) return;
          setCountdown(i);
          await new Promise<void>(r => setTimeout(r, 1000));
        }
        if (cancelled) return;

        setStatus("scanning");
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
        ctx.clearRect(0, 0, W, H);

        const result = landmarkerRef.current?.detectForVideo(video, performance.now());
        const lm = result?.landmarks?.[0];

        // ── Check key landmarks are visible ────────────────────────────────
        let bodyReady   = false;
        let shoulderPx  = 0;
        let hipPx       = 0;

        if (lm && lm.length > LM_R_HIP) {
          const ls = lm[LM_L_SHOULDER];
          const rs = lm[LM_R_SHOULDER];
          const lh = lm[LM_L_HIP];
          const rh = lm[LM_R_HIP];

          const allVisible = [ls, rs, lh, rh].every(p => (p.visibility ?? 0) > 0.5);

          if (allVisible) {
            shoulderPx = Math.abs(rs.x - ls.x) * W;
            hipPx      = Math.abs(rh.x - lh.x) * W;
            bodyReady  = shoulderPx > 30 && hipPx > 30; // sanity: must be sizeable
          }

          // ── Draw skeleton frame ─────────────────────────────────────────
          const alpha  = bodyReady ? 0.5 + holdPctRef.current * 0.5 : 0.4;
          ctx.strokeStyle = `rgba(139,99,71,${alpha})`;
          ctx.lineWidth   = 2.5;
          ctx.lineCap     = "round";

          for (const [a, b] of SEGMENTS) {
            const pa = lm[a], pb = lm[b];
            if (!pa || !pb) continue;
            ctx.beginPath();
            ctx.moveTo(pa.x * W, pa.y * H);
            ctx.lineTo(pb.x * W, pb.y * H);
            ctx.stroke();
          }

          // Landmark dots
          ctx.fillStyle = `rgba(139,99,71,${bodyReady ? 0.9 : 0.5})`;
          for (const i of [LM_L_SHOULDER, LM_R_SHOULDER, LM_L_HIP, LM_R_HIP]) {
            const p = lm[i];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // No body — draw faint dashed guide rectangle
          ctx.strokeStyle = "rgba(139,99,71,0.25)";
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([8, 6]);
          const gx = W * 0.22, gy = H * 0.04;
          ctx.strokeRect(gx, gy, W * 0.56, H * 0.92);
          ctx.setLineDash([]);
        }

        // ── No body detected ────────────────────────────────────────────────
        if (!bodyReady) {
          setBodyInView(false);
          holdStart.current  = null;
          setHoldPct(0);
          holdPctRef.current = 0;
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        setBodyInView(true);

        // ── Hold timer ──────────────────────────────────────────────────────
        const now = Date.now();
        if (holdStart.current === null) holdStart.current = now;
        const pct = Math.min((now - holdStart.current) / HOLD_MS, 1);
        setHoldPct(pct);
        holdPctRef.current = pct;

        if (pct >= 1 && !capturedRef.current) {
          capturedRef.current = true;
          setStatus("done");
          streamRef.current?.getTracks().forEach(t => t.stop());
          const { shape, confident } = classifyFromPose(shoulderPx, hipPx);
          onCaptureRef.current(shape, confident);
          return;
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

  const handleRetry = useCallback(() => {
    capturedRef.current  = false;
    holdStart.current    = null;
    holdPctRef.current   = 0;
    setHoldPct(0);
    setBodyInView(false);
    setError(null);
    setStatus("loading");
    setLoadKey(k => k + 1);
  }, []);

  function hint() {
    if (!bodyInView)   return "Step back until your full body is visible";
    if (holdPct > 0)   return `Hold still — ${Math.ceil((1 - holdPct) * HOLD_MS / 1000)}s remaining`;
    return "Body detected — hold perfectly still";
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Body Scan
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
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
            <p className="font-sans text-[0.6rem] text-brown-mid/60 text-center max-w-xs mb-8 leading-relaxed">
              Camera detects shoulder and hip width to estimate your body shape. Fitted clothing gives more accurate results.
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
      {(status === "loading" || status === "countdown" || status === "scanning") && (
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

            {/* Countdown overlay */}
            <AnimatePresence>
              {status === "countdown" && (
                <motion.div
                  key={countdown}
                  initial={{ opacity: 0, scale: 1.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-brown-dark/50"
                >
                  <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-cream/70 mb-2">
                    Get ready
                  </p>
                  <p className="font-display text-8xl text-cream" style={{ fontWeight: 300 }}>
                    {countdown}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="font-sans text-xs text-brown-mid mt-4 tracking-wide text-center">
            {status === "scanning" ? hint() : status === "countdown" ? "Stand in position — scanning soon" : "Loading…"}
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

      {/* Done */}
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
            <p className="font-sans text-xs text-brown-mid tracking-widest">Processing…</p>
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
