"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { sampleSkinToneFromVideo, computeSkinToneFromLab, type SkinToneResult } from "@/app/lib/skinTone";

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
interface M { foreW: number; eyeW: number; cheekW: number; jawW: number; faceLen: number; chinW: number; jawAngle: number; weight: number }
interface Lm { x: number; y: number; z: number }

function d2px(a: Lm, b: Lm, W: number, H: number) {
  // CRITICAL: convert to pixel space before measuring to avoid 4:3 aspect distortion
  return Math.sqrt(((a.x - b.x) * W) ** 2 + ((a.y - b.y) * H) ** 2);
}

// Angle at vertex B formed by points A-B-C, in pixel space
function anglePx(a: Lm, b: Lm, c: Lm, W: number, H: number): number {
  const ax = (a.x - b.x) * W, ay = (a.y - b.y) * H;
  const cx = (c.x - b.x) * W, cy = (c.y - b.y) * H;
  const mag = Math.sqrt((ax * ax + ay * ay) * (cx * cx + cy * cy));
  return mag > 0 ? Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / mag))) : Math.PI;
}

// Avg jaw-corner angle at gonion landmarks (lm172 left, lm397 right)
// Square jaw ≈ <1.80 rad; Round jaw ≈ >2.05 rad
function jawCornerAngle(lm: Lm[], W: number, H: number): number {
  const L = anglePx(lm[136], lm[172], lm[58],  W, H);
  const R = anglePx(lm[379], lm[397], lm[288], W, H);
  return (L + R) / 2;
}

function measure(lm: Lm[], W: number, H: number): M {
  // jaw: average gonion-to-gonion + jaw-body (more stable than single pair)
  const jawW  = (d2px(lm[172], lm[397], W, H) + d2px(lm[136], lm[379], W, H)) / 2;
  // chin: average narrowest tip + slightly wider base (more robust than tip alone)
  const chinW = (d2px(lm[148], lm[377], W, H) + d2px(lm[176], lm[400], W, H)) / 2;
  // forehead: average upper temple (lm54/284) + lower temple (lm21/251) — two heights more representative than one
  const foreW = (d2px(lm[54],  lm[284], W, H) + d2px(lm[21],  lm[251], W, H)) / 2;
  return {
    foreW,
    eyeW:     d2px(lm[33],  lm[263], W, H),
    cheekW:   d2px(lm[234], lm[454], W, H),
    jawW,
    faceLen:  d2px(lm[10],  lm[152], W, H),
    chinW,
    jawAngle: jawCornerAngle(lm, W, H),
    weight:   1,
  };
}

function avgBuffer(buf: M[]): M {
  const n = buf.length;
  // Weighted trimmed mean: drop top+bottom 15%, then weight remaining by pose quality (m.weight)
  if (n >= 6) {
    const cut = Math.max(1, Math.floor(n * 0.15));
    const weightedTrim = (vals: number[], ws: number[]) => {
      const pairs = vals.map((v, i) => ({ v, w: ws[i] })).sort((a, b) => a.v - b.v).slice(cut, n - cut);
      const totalW = pairs.reduce((s, p) => s + p.w, 0);
      return totalW > 0 ? pairs.reduce((s, p) => s + p.v * p.w, 0) / totalW : 0;
    };
    const ws = buf.map(m => m.weight);
    return {
      foreW:    weightedTrim(buf.map(m => m.foreW),    ws),
      eyeW:     weightedTrim(buf.map(m => m.eyeW),     ws),
      cheekW:   weightedTrim(buf.map(m => m.cheekW),   ws),
      jawW:     weightedTrim(buf.map(m => m.jawW),      ws),
      faceLen:  weightedTrim(buf.map(m => m.faceLen),  ws),
      chinW:    weightedTrim(buf.map(m => m.chinW),     ws),
      jawAngle: weightedTrim(buf.map(m => m.jawAngle), ws),
      weight:   1,
    };
  }
  const sumW = buf.reduce((s, m) => s + m.weight, 0) || 1;
  return {
    foreW:    buf.reduce((s, m) => s + m.foreW    * m.weight, 0) / sumW,
    eyeW:     buf.reduce((s, m) => s + m.eyeW     * m.weight, 0) / sumW,
    cheekW:   buf.reduce((s, m) => s + m.cheekW   * m.weight, 0) / sumW,
    jawW:     buf.reduce((s, m) => s + m.jawW     * m.weight, 0) / sumW,
    faceLen:  buf.reduce((s, m) => s + m.faceLen  * m.weight, 0) / sumW,
    chinW:    buf.reduce((s, m) => s + m.chinW    * m.weight, 0) / sumW,
    jawAngle: buf.reduce((s, m) => s + m.jawAngle * m.weight, 0) / sumW,
    weight:   1,
  };
}

function classifyFromAvg(avg: M, debug = false, gender: "male" | "female" = "female"): { shape: string; confidence: "High" | "Medium" | "Low" } {
  const { foreW, eyeW, cheekW, jawW, faceLen, chinW, jawAngle } = avg;
  const lenR  = faceLen / cheekW;
  const jawR  = jawW    / cheekW;
  const foreR = foreW   / cheekW;
  const chinR = chinW   / cheekW;
  const eyeR  = eyeW    / cheekW;
  const diff  = foreR   - jawR;
  const taper = jawR    - chinR;   // jaw-to-chin taper: low = both narrow (Heart); moderate = Square; high = Round/Long
  // Males have anatomically more acute gonion angles — require stricter threshold
  // to avoid over-classifying male Oval/Round faces as Square
  const angularThresh = gender === "male" ? 1.72 : 1.80;
  const softThresh    = gender === "male" ? 2.10 : 2.05;
  const isAngular = jawAngle < angularThresh;
  const isSoft    = jawAngle > softThresh;

  const scores: Record<string, number> = {
    Long: 0, Rectangle: 0, Diamond: 0, Triangle: 0, "Inverted Triangle": 0,
    Heart: 0, Round: 0, Square: 0, Oval: 0,
  };

  // Length ratio — MediaPipe lenR compresses real values: lm10 starts mid-forehead (not hairline) and cheekW is near-ear
  // Real lenR 1.5 → MP ~1.28–1.34; so Long threshold lowered accordingly
  if (lenR > 1.32)       scores.Long  += 8;
  else if (lenR > 1.24)  scores.Long  += 5;
  if (lenR < 1.14)       scores.Round += 8;
  else if (lenR < 1.18)  scores.Round += 4;

  // Jaw/cheek ratio
  if (jawR > 0.86)       scores.Triangle += 6;
  else if (jawR > 0.82)  { scores.Triangle += 2; scores.Square += 2; }
  // Heart jaw threshold tightened: avg Oval jawR ≈ 0.63 (bigonial 0.72 × bizy ÷ near-ear cheekW 1.15×)
  // Heart needs jaw notably below average — < 0.60 is truly narrow
  if (jawR < 0.60)       { scores.Heart += 4; scores.Diamond += 2; }
  else if (jawR < 0.65)  scores.Heart += 2;

  // Forehead/cheek ratio — Heart needs very wide forehead; MediaPipe temple landmarks inflate foreR so threshold raised
  if (foreR > 0.93)      scores.Heart   += 4;
  if (foreR < 0.79)      scores.Diamond += 4;
  else if (foreR < 0.84) scores.Diamond += 2;

  // Forehead-jaw differential — average face diff ≈ 0.08–0.13 in MediaPipe space
  // Only strong taper (> 0.17) counts — removes false Heart from moderate forehead-jaw gap
  if (diff > 0.17)       scores.Heart    += 6;
  if (diff < -0.10)      scores.Triangle += 6;
  else if (diff < -0.05) scores.Triangle += 3;

  // Jaw angularity — angular confirms Square/Rectangle; soft confirms Round/Oval
  if (isAngular && Math.abs(diff) < 0.08 && lenR < 1.32) scores.Square     += 4;
  else if (isAngular)                                     scores.Square     += 2;
  if (isAngular && lenR > 1.28)                           scores.Rectangle  += 3;
  if (isSoft && lenR < (gender === "male" ? 1.15 : 1.20)) scores.Round      += 3;
  else if (isSoft)                                        scores.Round      += 1;

  // Chin narrowness — require foreR > 0.91 (truly wide forehead) to avoid false Heart on typical narrow chins
  const heartChinA = gender === "male" ? 0.40 : 0.38;
  const heartChinB = gender === "male" ? 0.43 : 0.41;
  if (chinR < heartChinA && foreR > 0.91)      scores.Heart += 4;
  else if (chinR < heartChinB && foreR > 0.89) scores.Heart += 2;

  // Taper scoring — removed Heart contribution (was causing false positives for average Oval faces)
  if (taper < 0.30 && jawR > 0.78) scores.Square += 2;  // wide jaw, chin not much narrower → Square-like

  // Inverted Triangle: forehead wider than cheekbones AND jaw very narrow
  if (foreR > 0.94 && jawR < 0.72)      scores["Inverted Triangle"] += 8;
  else if (foreR > 0.90 && jawR < 0.76) scores["Inverted Triangle"] += 5;
  else if (foreR > 0.86 && jawR < 0.78) scores["Inverted Triangle"] += 3;

  // Rectangle: long + wide angular jaw (not tapered like Long, not short like Square)
  if (lenR > 1.30 && jawR > 0.80 && Math.abs(diff) < 0.10)      scores.Rectangle += 8;
  else if (lenR > 1.24 && jawR > 0.77 && Math.abs(diff) < 0.12) scores.Rectangle += 5;
  else if (lenR > 1.22 && jawR > 0.78 && isAngular)              scores.Rectangle += 3;

  // Square: jaw ≈ forehead, both wide, NOT long — angular jaw required for full score
  // Soft jaw gets reduced score (avoids misclassifying Oval/Round with equal proportions)
  if (Math.abs(diff) < 0.05 && jawR > 0.80 && foreR > 0.82 && lenR < 1.30) scores.Square += isAngular ? 7 : 4;
  else if (Math.abs(diff) < 0.09 && jawR > 0.76)                             scores.Square += 3;

  // Diamond: narrow at both forehead and jaw vs cheekbones
  if (foreR < 0.79 && jawR < 0.76) scores.Diamond += 4;

  // Eye width ratio — Diamond has wide eyes relative to narrow face (wide mid-face/cheekbones dominant)
  if (eyeR > 0.68 && foreR < 0.84 && jawR < 0.76) scores.Diamond += 2;
  else if (eyeR > 0.65 && foreR < 0.87)             scores.Diamond += 1;

  // Round bonus: wide + short
  if (jawR > 0.82 && foreR > 0.82 && lenR < 1.18) scores.Round += 3;

  // Long bonus: elongated face with moderate jaw (lower threshold to match MP compression)
  if (lenR > 1.34 && jawR < 0.80) scores.Long += 3;

  // Oval proactive — tiered by lenR to prevent tie with Long (+5 at lenR 1.24-1.32)
  // Core Oval zone (lenR 1.19–1.24): full +5. Borderline Long zone (1.24–1.32): +3 with tighter diff.
  if (lenR >= 1.19 && lenR <= 1.24 && Math.abs(diff) < 0.11) scores.Oval += 5;
  else if (lenR > 1.24 && lenR <= 1.32 && Math.abs(diff) < 0.09) scores.Oval += 3;
  if (Math.abs(diff) < 0.07) scores.Oval += 2;   // very balanced bonus

  // Oval last resort — additional points only when no strong alternative
  const maxOther = Math.max(
    scores.Long, scores.Rectangle, scores.Diamond, scores.Triangle,
    scores["Inverted Triangle"], scores.Heart, scores.Round, scores.Square
  );
  if (maxOther < 5) {
    if (lenR >= 1.19 && lenR <= 1.32) scores.Oval += 3;
    if (jawR >= 0.63 && jawR <= 0.80) scores.Oval += 2;
    if (foreR >= 0.70 && foreR <= 0.91) scores.Oval += 2;
    if (Math.abs(diff) < 0.07) scores.Oval += 1;
  }

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (debug) {
    console.log("[FaceShape] ratios", { lenR: +lenR.toFixed(3), jawR: +jawR.toFixed(3), foreR: +foreR.toFixed(3), chinR: +chinR.toFixed(3), eyeR: +eyeR.toFixed(3), diff: +diff.toFixed(3), taper: +taper.toFixed(3), jawAngleDeg: +(jawAngle * 180 / Math.PI).toFixed(1), isAngular, isSoft });
    console.log("[FaceShape] scores", Object.fromEntries(winner));
    console.log("[FaceShape] winner →", winner[0][0], `(${winner[0][1]} pts)`);
  }
  const shape = winner[0][1] > 0 ? winner[0][0] : "Oval";
  const gap = winner[0][1] - (winner[1]?.[1] ?? 0);
  const confidence: "High" | "Medium" | "Low" = gap >= 6 ? "High" : gap >= 3 ? "Medium" : "Low";
  return { shape, confidence };
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
const N_SEGS           = 8;
const SEG_REQUIRED_MS  = 1000; // 1s dwell per segment — more samples per position
const INIT_REQUIRED_MS = 2500; // 2.5s frontal hold before rotation phase
const MIN_COVERED      = 7;    // 7/8 segments = 315° coverage required

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
  gender: "male" | "female";
  onCapture: (imageDataUrl: string, faceShape: string) => void;
  onClose: () => void;
}

export default function FaceScanner({ gender, onCapture, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarker  = useRef<any>(null);
  const stream      = useRef<MediaStream | null>(null);
  const raf         = useRef<number>(0);
  const captured    = useRef(false);
  const measureBuf  = useRef<M[]>([]);
  const frontalImg  = useRef<string | null>(null);
  const skinLabBuf     = useRef<{ L: number; a: number; b: number }[]>([]);
  const bestCenterScore = useRef(Infinity);
  const initTimeMs      = useRef(0);
  const segTimeMs       = useRef<number[]>(Array(N_SEGS).fill(0));
  const lastDetectT     = useRef(0);
  const yawRef          = useRef(0);
  const pitchRef        = useRef(0);
  const offscreenCanvas = useRef<HTMLCanvasElement | null>(null);
  const scanFrameCount  = useRef(0);
  const pulseTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status,              setStatus]              = useState<"instructions" | "loading" | "scanning" | "done" | "error">("instructions");
  const [loadKey,             setLoadKey]             = useState(0);
  const [phase,               setPhase]               = useState<"init" | "scan">("init");
  const [covered,             setCovered]             = useState<boolean[]>(Array(N_SEGS).fill(false));
  const [coveredCount,        setCoveredCount]        = useState(0);
  const [faceShape,           setFaceShape]           = useState<string | null>(null);
  const [faceShapeConfidence, setFaceShapeConfidence] = useState<"High" | "Medium" | "Low">("Medium");
  const [faceInView,          setFaceInView]          = useState(false);
  const [tooClose,            setTooClose]            = useState(false);
  const [tooFar,              setTooFar]              = useState(false);
  const [lightingWarn,        setLightingWarn]        = useState<"dark" | "bright" | null>(null);
  const [initPct,             setInitPct]             = useState(0);
  const [dotAngle,            setDotAngle]            = useState<number | null>(null);
  const [activeSeg,           setActiveSeg]           = useState<number | null>(null);
  const [activeSegPct,        setActiveSegPct]        = useState<number>(0);
  const [pulseSeg,            setPulseSeg]            = useState<number | null>(null);
  const [skinToneResult,      setSkinToneResult]      = useState<SkinToneResult | null>(null);

  const doCapture = useCallback((shape: string, confidence: "High" | "Medium" | "Low") => {
    if (captured.current) return;
    captured.current = true;
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());

    // Compute + save skin tone from accumulated frontal samples
    if (skinLabBuf.current.length >= 3) {
      const buf = skinLabBuf.current;
      const med = (arr: number[]) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      const tone = computeSkinToneFromLab(
        med(buf.map(v => v.L)),
        med(buf.map(v => v.a)),
        med(buf.map(v => v.b)),
      );
      localStorage.setItem("mellow_skin_tone", JSON.stringify(tone));
      setSkinToneResult(tone);
    }

    localStorage.setItem("mellow_face_shape_confidence", confidence);

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

  const handleRetry = useCallback(() => {
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    captured.current      = false;
    measureBuf.current    = [];
    frontalImg.current    = null;
    skinLabBuf.current    = [];
    bestCenterScore.current = Infinity;
    initTimeMs.current    = 0;
    segTimeMs.current     = Array(N_SEGS).fill(0);
    lastDetectT.current   = 0;
    scanFrameCount.current = 0;
    setPhase("init");
    setCovered(Array(N_SEGS).fill(false));
    setCoveredCount(0);
    setFaceShape(null);
    setFaceShapeConfidence("Medium");
    setFaceInView(false);
    setTooClose(false);
    setTooFar(false);
    setLightingWarn(null);
    setInitPct(0);
    setDotAngle(null);
    setActiveSeg(null);
    setActiveSegPct(0);
    setPulseSeg(null);
    setSkinToneResult(null);
    setStatus("loading");
    setLoadKey(k => k + 1);
  }, []);

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

    // iPhone fallback: if camera delivered landscape video (W > H) while device is portrait,
    // landmarks are rotated 90° — correct by rotating them before measurement.
    // Detection: video is landscape but viewport is portrait.
    const devicePortrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
    const videoRotated   = W > H && devicePortrait;
    // 90° CCW correction (iPhone front camera portrait): (x,y) → (y, 1−x), effective dims swap
    const mW = videoRotated ? H : W;
    const mH = videoRotated ? W : H;
    function rotateLm(lm: { x: number; y: number; z: number }[]) {
      return videoRotated ? lm.map(p => ({ x: p.y, y: 1 - p.x, z: p.z })) : lm;
    }

    let results;
    try { results = lmkr.detectForVideo(video, performance.now()); }
    catch { raf.current = requestAnimationFrame(detect); return; }

    if (results.faceLandmarks.length > 0) {
      const lmRaw = results.faceLandmarks[0];
      const lm    = rotateLm(lmRaw);  // identity if not rotated; corrected landmarks for iPhone portrait
      setFaceInView(true);
      drawFace(ctx, lmRaw, W, H);     // draw on canvas using raw coords (canvas is in video space)

      // Face size check — cheekW > 52% = too close; < 15% = too far (landmark precision drops)
      const cheekWnorm = Math.abs(lm[454].x - lm[234].x);
      const close = cheekWnorm > 0.52;
      const far   = cheekWnorm < 0.15;
      setTooClose(close);
      setTooFar(far);

      // Lighting quality check — throttled to every 30 frames, samples nose region
      scanFrameCount.current++;
      if (scanFrameCount.current % 30 === 1) {
        if (!offscreenCanvas.current) {
          offscreenCanvas.current = document.createElement("canvas");
          offscreenCanvas.current.width = 40; offscreenCanvas.current.height = 40;
        }
        const oc = offscreenCanvas.current;
        const octx = oc.getContext("2d")!;
        const nx = Math.min(Math.max(lmRaw[1].x * W, 20), W - 20);
        const ny = Math.min(Math.max(lmRaw[1].y * H, 20), H - 20);
        octx.drawImage(video, nx - 20, ny - 20, 40, 40, 0, 0, 40, 40);
        const px = octx.getImageData(0, 0, 40, 40).data;
        let lum = 0;
        for (let i = 0; i < px.length; i += 4) lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        lum /= px.length / 4;
        setLightingWarn(lum < 50 ? "dark" : lum > 230 ? "bright" : null);
      }

      // Pose: prefer transformation matrix (true 3D), fall back to landmarks
      // If video is rotated, swap yaw/pitch so frontal detection works correctly
      let pose: { yaw: number; pitch: number };
      if (results.facialTransformationMatrixes?.length > 0) {
        const p = poseFromMatrix(results.facialTransformationMatrixes[0].data);
        pose = videoRotated ? { yaw: p.pitch, pitch: -p.yaw } : p;
      } else {
        pose = poseFromLandmarks(lm);
      }
      const { yaw, pitch } = pose;
      yawRef.current   = yaw;
      pitchRef.current = pitch;

      // Compute dot angle for ring visualization
      setDotAngle(Math.atan2(yaw, -pitch) - Math.PI / 2);

      const isFrontal = Math.abs(yaw) < 0.15 && Math.abs(pitch) < 0.18;

      // Accumulate measurements ONLY when frontal — side-view data corrupts ratios
      // Weight by frontality: frames near yaw=0/pitch=0 count more than edge-of-window frames
      if (isFrontal && !close) {
        const m = measure(lm, mW, mH);  // use corrected landmarks + effective dims
        m.weight = Math.max(0.1, (1 - Math.abs(yaw) / 0.15) * (1 - Math.abs(pitch) / 0.18));
        measureBuf.current.push(m);
        if (measureBuf.current.length > 400) measureBuf.current.shift();
      }

      // Save best frontal frame for GPT-4o — replace whenever a more centered frame is found
      // Most-centered (lowest yaw+pitch sum) gives GPT-4o the clearest face photo
      const centerScore = Math.abs(yaw) + Math.abs(pitch);
      if (isFrontal && !close && centerScore < bestCenterScore.current) {
        bestCenterScore.current = centerScore;
        const cap = document.createElement("canvas");
        cap.width = W; cap.height = H;
        const c = cap.getContext("2d")!;
        c.translate(W, 0); c.scale(-1, 1); c.drawImage(video, 0, 0);
        frontalImg.current = cap.toDataURL("image/jpeg", 0.92);
      }

      // Sample skin tone from cheeks during frontal hold (accumulate LAB values)
      // Use raw (unrotated) landmarks — sampleSkinToneFromVideo maps into raw video pixel space
      if (isFrontal && !close && skinLabBuf.current.length < 180) {
        const sample = sampleSkinToneFromVideo(video, lmRaw);
        if (sample) skinLabBuf.current.push(sample);
      }

      if (measureBuf.current.length >= 8) {
        const live = classifyFromAvg(avgBuffer(measureBuf.current), false, gender);
        setFaceShape(live.shape);
        setFaceShapeConfidence(live.confidence);
      }

      // Time delta — capped at 100ms to avoid huge jumps after tab switch
      const now = performance.now();
      const deltaMs = lastDetectT.current > 0 ? Math.min(now - lastDetectT.current, 100) : 16;
      lastDetectT.current = now;

      // Phase 1: frontal hold (time-based, device-framerate independent)
      if (initTimeMs.current < INIT_REQUIRED_MS) {
        initTimeMs.current = isFrontal && !close
          ? initTimeMs.current + deltaMs
          : Math.max(0, initTimeMs.current - deltaMs * 0.5);
        setInitPct(initTimeMs.current / INIT_REQUIRED_MS);
        if (initTimeMs.current >= INIT_REQUIRED_MS) setPhase("scan");
      } else {
        // Phase 2: circular coverage (time-based)
        if (!close) {
          const seg = getSegment(yaw, pitch);
          segTimeMs.current[seg] = Math.min(segTimeMs.current[seg] + deltaMs, SEG_REQUIRED_MS);
          // Real-time tick fill: update active segment progress every frame
          setActiveSeg(seg);
          setActiveSegPct(segTimeMs.current[seg] / SEG_REQUIRED_MS);
          if (segTimeMs.current[seg] >= SEG_REQUIRED_MS) {
            setCovered(prev => {
              if (prev[seg]) return prev;
              const next = [...prev]; next[seg] = true;
              const count = next.filter(Boolean).length;
              setCoveredCount(count);
              // Brief pulse on the newly completed segment
              setPulseSeg(seg);
              if (typeof navigator !== "undefined") navigator.vibrate?.(40);
              if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
              pulseTimeout.current = setTimeout(() => setPulseSeg(null), 500);
              if (count >= MIN_COVERED && measureBuf.current.length >= 8) {
                const final = classifyFromAvg(avgBuffer(measureBuf.current), true, gender);
                setFaceShape(final.shape);
                setFaceShapeConfidence(final.confidence);
                doCapture(final.shape, final.confidence);
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
      setActiveSeg(null);
      setActiveSegPct(0);
      lastDetectT.current = 0; // reset delta so next frame doesn't get a huge gap
    }

    raf.current = requestAnimationFrame(detect);
  }, [doCapture]);

  useEffect(() => {
    if (loadKey === 0) return;
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
          // Portrait-preferred: iPhone front camera delivers landscape internally;
          // requesting height > width signals portrait orientation, fixing sideways MediaPipe input
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
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
  }, [loadKey]);

  useEffect(() => {
    if (status !== "scanning") return;
    raf.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(raf.current);
  }, [status, detect]);


  return (
    <div className="fixed inset-0 z-50 bg-cream flex flex-col items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-brown-light/20 text-brown-dark hover:text-brown-dark hover:bg-brown-light/40 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Pre-scan instructions */}
      {status === "instructions" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center px-8 max-w-sm w-full"
        >
          <h2
            className="font-display text-brown-dark text-3xl mb-2 text-center"
            style={{ fontStyle: "italic", fontWeight: 300 }}
          >
            Before we begin
          </h2>
          <p className="font-sans text-brown-mid/60 text-xs tracking-wide text-center mb-8">
            For the most accurate scan, follow these tips
          </p>

          <ul className="w-full space-y-4 mb-10">
            {[
              "Sit in a well-lit room with light facing you",
              "Tuck hair back so your full face is visible",
              "Remove glasses if you wear them",
              "Hold your phone at eye level, arm's length away",
              "Keep a neutral expression throughout",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="font-sans text-brown-light text-xs mt-0.5 select-none">—</span>
                <span className="font-sans text-brown-dark text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => { setStatus("loading"); setLoadKey(k => k + 1); }}
            className="w-full py-3.5 rounded-full bg-brown-dark text-cream font-sans text-sm tracking-widest uppercase hover:bg-brown-mid transition-colors"
          >
            Start Scan
          </button>

          <p className="mt-5 font-sans text-[0.58rem] text-brown-mid/40 tracking-wide text-center leading-relaxed">
            Results are a guide, not a diagnosis — accuracy varies with lighting and camera quality
          </p>
        </motion.div>
      )}

      {/* Circle + Ring wrapper — always in DOM so videoRef stays mounted; hidden during instructions */}
      <div
        className="relative flex-shrink-0"
        style={{ width: "calc(min(72vw, 340px) + 32px)", height: "calc(min(72vw, 340px) + 32px)", display: status === "instructions" ? "none" : undefined }}
      >
        {/* Circular video */}
        <div className="absolute rounded-full overflow-hidden bg-brown-dark" style={{ inset: 16 }}>
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

          {/* Face outline guide — shows when no face detected */}
          {status === "scanning" && !faceInView && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
              <ellipse cx={50} cy={48} rx={28} ry={37}
                fill="none" stroke="rgba(201,168,130,0.4)" strokeWidth="1" strokeDasharray="4 3" />
            </svg>
          )}

          {/* Lighting warning */}
          {status === "scanning" && faceInView && lightingWarn && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-3 pointer-events-none">
              <p className="font-sans text-[0.55rem] tracking-wide text-center text-cream/70 bg-brown-dark/60 rounded px-2 py-0.5">
                {lightingWarn === "dark" ? "Too dark — face a light source" : "Too bright — try turning slightly"}
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-brown-dark">
              <div className="w-8 h-8 border-2 border-brown-light/30 border-t-brown-light rounded-full animate-spin" />
            </div>
          )}

          {/* Error overlay */}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-brown-dark p-6 text-center gap-3">
              <p className="font-sans text-sm text-cream">Camera access denied or unavailable.</p>
              <button onClick={onClose} className="font-sans text-xs text-brown-light underline underline-offset-2">
                Upload a photo instead
              </button>
            </div>
          )}

          {/* Done overlay */}
          {status === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-cream/90"
            >
              <p className="font-display text-4xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                {faceShape}
              </p>
              <p className="font-sans text-[0.55rem] tracking-[0.35em] uppercase text-brown-mid mt-1">
                {faceShapeConfidence === "High" ? "face shape detected" : faceShapeConfidence === "Medium" ? "approximate result" : "low confidence — try rescanning"}
              </p>
              {skinToneResult && (
                <div className="flex items-center gap-2 mt-3">
                  <div
                    className="w-5 h-5 rounded-full border border-brown-light flex-shrink-0"
                    style={{ backgroundColor: skinToneResult.hex }}
                  />
                  <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid">
                    {skinToneResult.hex}
                  </p>
                </div>
              )}
              <button
                onClick={handleRetry}
                className="mt-4 font-sans text-[0.6rem] tracking-[0.2em] uppercase text-brown-mid/60 underline underline-offset-2"
              >
                Scan again
              </button>
            </motion.div>
          )}
        </div>

        {/* Ring SVG — scanning + brief done flash */}
        {(status === "scanning" || status === "done") && (() => {
          const isDoneFlash = status === "done";
          // Nearest uncovered segment to subtly highlight where user should turn next
          const nextSeg = (() => {
            if (phase !== "scan" || activeSeg === null) return null;
            for (let d = 1; d <= N_SEGS; d++) {
              const fwd = (activeSeg + d) % N_SEGS;
              if (!covered[fwd]) return fwd;
              const bwd = ((activeSeg - d) + N_SEGS) % N_SEGS;
              if (!covered[bwd]) return bwd;
            }
            return null;
          })();
          return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
              {/* 40 tick dashes around the circle */}
              {Array.from({ length: 40 }, (_, i) => {
                const angle = (i / 40) * 2 * Math.PI - Math.PI / 2;
                const seg = Math.floor((i / 40) * N_SEGS);
                const isDone    = isDoneFlash || (phase === "scan" && covered[seg]);
                const isPending = phase === "scan" && !covered[seg] && seg === activeSeg;
                const isPulsing = (phase === "scan" && covered[seg] && seg === pulseSeg) || isDoneFlash;
                const isNext    = phase === "scan" && !covered[seg] && seg === nextSeg;
                return (
                  <line
                    key={i}
                    x1={50 + 45 * Math.cos(angle)} y1={50 + 45 * Math.sin(angle)}
                    x2={50 + (isPulsing ? 50 : 49) * Math.cos(angle)} y2={50 + (isPulsing ? 50 : 49) * Math.sin(angle)}
                    stroke={
                      isDoneFlash ? "#C9A882" :
                      isPulsing   ? "#C9A882" :
                      isDone      ? "#8B6347" :
                      isNext      ? "rgba(139,99,71,0.65)" :
                      isPending   ? `rgba(139,99,71,${(0.3 + 0.7 * activeSegPct).toFixed(2)})` :
                      "rgba(201,168,130,0.45)"
                    }
                    strokeWidth={isPulsing ? "3" : isNext ? "2.5" : "2"}
                    strokeLinecap="round"
                    style={{ transition: isDone ? "stroke 0.15s ease, stroke-width 0.15s ease" : "none" }}
                  />
                );
              })}

              {/* Init phase arc fills as user holds frontal */}
              {phase === "init" && faceInView && !tooClose && initPct > 0 && (
                <circle
                  cx={50} cy={50} r={47}
                  fill="none"
                  stroke="#8B6347"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={100}
                  strokeDashoffset={100 - initPct * 100}
                  transform="rotate(-90 50 50)"
                  style={{ transition: "stroke-dashoffset 0.12s ease" }}
                />
              )}

              {/* Moving dot — tracks current head direction on the ring */}
              {phase === "scan" && faceInView && !tooClose && dotAngle !== null && (
                <circle
                  cx={50 + 47 * Math.cos(dotAngle)}
                  cy={50 + 47 * Math.sin(dotAngle)}
                  r={2.5}
                  fill="#4A3728"
                  opacity={0.85}
                />
              )}
            </svg>
          );
        })()}
      </div>

      {/* Instruction text */}
      {status === "scanning" && (
        <div className="mt-10 px-8 text-center max-w-xs">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${phase}-${faceInView}-${tooClose}-${tooFar}-${lightingWarn}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-brown-dark text-lg font-sans font-medium leading-snug">
                {tooClose
                  ? "Move back a little"
                  : tooFar
                  ? "Move closer to the camera"
                  : !faceInView
                  ? "Position your face within the frame"
                  : phase === "init"
                  ? "Look straight ahead"
                  : coverageHint(covered, faceInView, tooClose)}
              </p>
              {/* Countdown during frontal hold */}
              {phase === "init" && faceInView && !tooClose && !tooFar && initPct > 0 && initPct < 1 && (
                <p className="mt-1 font-sans text-brown-mid/50 text-xs tracking-widest">
                  {Math.ceil((1 - initPct) * INIT_REQUIRED_MS / 1000)}s
                </p>
              )}
              {/* Live shape estimate during scan */}
              {phase === "scan" && faceShape && (
                <p className="mt-1 font-sans text-[0.55rem] tracking-[0.3em] text-brown-mid/35 uppercase">
                  detecting {faceShape.toLowerCase()}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Direction arrow nudge — animated arrow pointing toward next uncovered area */}
          {phase === "scan" && faceInView && !tooClose && !tooFar && (() => {
            const L = covered[5] || covered[6] || covered[7];
            const R = covered[1] || covered[2] || covered[3];
            const D = covered[3] || covered[4] || covered[5];
            const dir = !R ? "right" : !L ? "left" : !D ? "down" : null;
            if (!dir) return null;
            return (
              <motion.p
                key={dir}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" as const }}
                className="mt-3 font-sans text-2xl text-brown-mid/50 select-none"
              >
                {dir === "right" ? "→" : dir === "left" ? "←" : "↓"}
              </motion.p>
            );
          })()}

          {/* Progress bar — fills left to right as scan progresses */}
          {faceInView && !tooClose && !tooFar && (
            <div className="mt-6 w-full">
              <div className="h-[2px] bg-brown-light/25 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brown-mid rounded-full"
                  animate={{
                    width: `${phase === "init"
                      ? Math.round(initPct * 35)
                      : Math.min(100, Math.round(35 + (coveredCount / MIN_COVERED) * 65))
                    }%`
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" as const }}
                />
              </div>
              {phase === "scan" && (
                <p className="mt-2 font-sans text-[0.55rem] tracking-[0.25em] text-brown-mid/40 text-center uppercase">
                  {coveredCount} / {MIN_COVERED} positions
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading text */}
      {status === "loading" && (
        <p className="mt-8 font-sans text-[0.6rem] text-brown-mid/50 tracking-[0.3em] uppercase">
          Loading scanner
        </p>
      )}

      {/* Privacy note — hidden during instructions (that screen has its own footer) */}
      {status !== "instructions" && (
        <p className="absolute bottom-6 font-sans text-[0.58rem] text-brown-mid/40 tracking-wide text-center px-8">
          Camera stays on your device — nothing uploaded during scanning
        </p>
      )}
    </div>
  );
}
