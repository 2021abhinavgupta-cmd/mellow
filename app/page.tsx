"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import { Upload, Lock, Palette, Sparkles, Scissors, BookOpen, Camera, Check, Loader2, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";

const FaceScanner = dynamic(() => import("@/app/components/FaceScanner"), { ssr: false });

const FACE_SHAPE_BLURB: Record<string, string> = {
  "Oval":               "Balanced proportions — forehead slightly wider than jaw, gently rounded chin.",
  "Round":              "Soft, full cheeks with similar face length and width. Gentle, curved jawline.",
  "Square":             "Strong, angular jaw roughly as wide as the forehead. Defined, structured look.",
  "Heart":              "Wide forehead and prominent cheekbones tapering to a narrow, pointed chin.",
  "Long":               "Face notably longer than wide, with similar forehead, cheekbone, and jaw width.",
  "Diamond":            "Wide cheekbones are the widest point — forehead and jaw both narrow.",
  "Rectangle":          "Long face with an angular jaw as wide as the forehead. Structured, strong.",
  "Triangle":           "Jaw wider than cheekbones and forehead — face widens toward the chin.",
  "Inverted Triangle":  "Wide forehead and temples tapering down to a narrow jaw and chin.",
};

const features = [
  {
    icon: Palette,
    title: "Color Analysis",
    desc: "Discover your seasonal palette, undertones, and colours that make you glow.",
  },
  {
    icon: Sparkles,
    title: "Makeup Guide",
    desc: "Curated looks that complement your features, skin tone, and bone structure.",
  },
  {
    icon: Scissors,
    title: "Hair Styles",
    desc: "Face-framing cuts and hues chosen for your unique facial geometry.",
  },
  {
    icon: BookOpen,
    title: "Style Guide",
    desc: "Wardrobe essentials and silhouettes tailored to your personal aesthetic.",
  },
];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: "easeOut" } as Transition,
});

export default function Home() {
  const router = useRouter();

  // ── Upload path ────────────────────────────────────────────────────────────
  const [image,    setImage]    = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Onboarding (scan path) ─────────────────────────────────────────────────
  const [pendingScanner, setPendingScanner] = useState(false);
  const [pendingAge,     setPendingAge]     = useState(false);
  const [gender, setGender] = useState<"male" | "female" | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mellow_gender") as "male" | "female" | null : null
  );
  const [ageRange, setAgeRange] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mellow_age_range") : null
  );

  // ── Checklist ──────────────────────────────────────────────────────────────
  const [checklistActive, setChecklistActive] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("mellow_checklist_active") === "1" : false
  );
  const [showScanner, setShowScanner] = useState(false);

  const [faceDone,   setFaceDone]   = useState(() => typeof window !== "undefined" ? !!localStorage.getItem("mellow_face_shape")     : false);
  const [faceShape,  setFaceShape]  = useState<string | null>(() => typeof window !== "undefined" ? localStorage.getItem("mellow_face_shape") : null);
  const [skinToneHex, setSkinToneHex] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { const r = localStorage.getItem("mellow_skin_tone"); return r ? JSON.parse(r).hex ?? null : null; } catch { return null; }
  });

  const [skinDone,    setSkinDone]    = useState(() => typeof window !== "undefined" ? !!localStorage.getItem("mellow_skin_analysis") : false);
  const [skinLoading, setSkinLoading] = useState(false);
  const [skinError,   setSkinError]   = useState(false);

  const [bodyDone, setBodyDone] = useState(() => typeof window !== "undefined" ? !!localStorage.getItem("mellow_body_type") : false);
  const [bodyType, setBodyType] = useState<string | null>(() => typeof window !== "undefined" ? localStorage.getItem("mellow_body_type") : null);

  const allDone = faceDone && skinDone && bodyDone;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const compressImage = useCallback((dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = dataUrl;
    }), []);

  // ── Upload path handlers ───────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPendingScanner(false);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const compressed = await compressImage(raw);
      setImage(compressed);
      setGender(null);
    };
    reader.readAsDataURL(file);
  }, [compressImage]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);
  const onDragOver  = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onChange    = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) handleFile(file);
  }, [handleFile]);

  const analyze = useCallback(() => {
    if (!image || !gender) return;
    localStorage.setItem("mellow_age_range", ageRange ?? "");
    localStorage.removeItem("mellow_face_shape_confidence");
    localStorage.removeItem("mellow_analysis");
    localStorage.removeItem("mellow_skin_analysis");
    localStorage.removeItem("mellow_body_type");
    localStorage.removeItem("mellow_measurements");
    sessionStorage.removeItem("mellow_hair_images");
    sessionStorage.removeItem("mellow_style_images");
    localStorage.setItem("mellow_image", image);
    localStorage.setItem("mellow_gender", gender);
    localStorage.removeItem("mellow_face_shape");
    router.push("/results/skin");
  }, [image, gender, ageRange, router]);

  // ── Scan path: enter checklist ─────────────────────────────────────────────
  const enterChecklist = useCallback((age: string) => {
    localStorage.removeItem("mellow_analysis");
    localStorage.removeItem("mellow_skin_analysis");
    localStorage.removeItem("mellow_body_type");
    localStorage.removeItem("mellow_measurements");
    localStorage.removeItem("mellow_face_shape");
    localStorage.removeItem("mellow_face_shape_confidence");
    localStorage.removeItem("mellow_image");
    localStorage.removeItem("mellow_skin_tone");
    sessionStorage.removeItem("mellow_hair_images");
    sessionStorage.removeItem("mellow_style_images");
    localStorage.setItem("mellow_gender", gender!);
    localStorage.setItem("mellow_age_range", age);
    sessionStorage.setItem("mellow_checklist_active", "1");
    setAgeRange(age);
    setChecklistActive(true);
    setFaceDone(false); setFaceShape(null); setSkinToneHex(null);
    setSkinDone(false); setSkinLoading(false); setSkinError(false);
    setBodyDone(false); setBodyType(null);
    setPendingAge(false); setPendingScanner(false);
  }, [gender]);

  // ── Scan path: skin API ────────────────────────────────────────────────────
  const triggerSkinAnalysis = useCallback((imageDataUrl: string) => {
    setSkinLoading(true);
    setSkinError(false);
    fetch("/api/analyze-skin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.skinType) {
          localStorage.setItem("mellow_skin_analysis", JSON.stringify(data));
          setSkinDone(true);
        } else {
          setSkinError(true);
        }
      })
      .catch(() => setSkinError(true))
      .finally(() => setSkinLoading(false));
  }, []);

  // ── Scan path: face capture ────────────────────────────────────────────────
  const handleScanCapture = useCallback(async (dataUrl: string, shape: string) => {
    const compressed = await compressImage(dataUrl);
    localStorage.setItem("mellow_image", compressed);
    localStorage.setItem("mellow_face_shape", shape);
    setFaceShape(shape);
    setFaceDone(true);
    setShowScanner(false);
    try {
      const raw = localStorage.getItem("mellow_skin_tone");
      if (raw) setSkinToneHex(JSON.parse(raw).hex ?? null);
    } catch { /* ignore */ }
    triggerSkinAnalysis(compressed);
  }, [compressImage, triggerSkinAnalysis]);

  // ── Scan path: body scan ───────────────────────────────────────────────────
  const startBodyScan = useCallback(() => {
    sessionStorage.setItem("mellow_from_checklist", "1");
    router.push("/body-scan");
  }, [router]);

  const goToResults = useCallback(() => {
    sessionStorage.removeItem("mellow_checklist_active");
    router.push("/results");
  }, [router]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-cream">
      {showScanner && (
        <FaceScanner
          gender={gender ?? "female"}
          onCapture={handleScanCapture}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Nav */}
      <motion.nav {...fadeUp(0)} className="flex items-center justify-between px-8 py-7 md:px-16">
        <span className="font-display text-[2rem] text-brown-dark tracking-wide" style={{ fontStyle: "italic", fontWeight: 300 }}>
          mellow
        </span>
        <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-brown-mid">Personal Style AI</span>
      </motion.nav>

      {/* Decorative rule */}
      <motion.div {...fadeUp(0.1)} className="mx-8 md:mx-16 border-t border-brown-light/40" />

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-20">
        <motion.p {...fadeUp(0.25)} className="font-sans text-[0.65rem] tracking-[0.35em] uppercase text-brown-mid mb-8">
          AI-Powered Beauty Analysis
        </motion.p>

        <motion.h1
          {...fadeUp(0.35)}
          className="font-display text-[2.8rem] sm:text-[3.5rem] md:text-[5.5rem] text-brown-dark leading-[1.05] max-w-3xl"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          Discover Your
          <br />
          Natural Radiance
        </motion.h1>

        <motion.p {...fadeUp(0.5)} className="mt-7 text-brown-mid font-sans text-base md:text-lg max-w-sm leading-relaxed">
          Upload a portrait and receive a full style analysis — colour season, makeup, hair, and wardrobe — in seconds.
        </motion.p>

        {/* ── Main interactive area ── */}
        <motion.div {...fadeUp(0.65)} className="mt-14 w-full max-w-md">

          {/* ══ CHECKLIST MODE ══════════════════════════════════════════════ */}
          {checklistActive && !showScanner && (
            <div className="space-y-3">
              {/* Header */}
              <div className="text-center mb-6">
                <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid mb-2">Your Analysis</p>
                <h2 className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  3 Quick Scans
                </h2>
                <p className="font-sans text-xs text-brown-mid mt-2 leading-relaxed">
                  Complete each scan to unlock your full style report
                </p>
              </div>

              {/* ── Item 1: Face Shape Scan ── */}
              <div className={`rounded-2xl border px-5 py-4 transition-all ${
                faceDone ? "bg-brown-dark/5 border-brown-dark/20" : "bg-white/60 border-brown-mid"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    faceDone ? "bg-brown-dark" : "bg-brown-mid"
                  }`}>
                    {faceDone
                      ? <Check className="w-4 h-4 text-cream" strokeWidth={2} />
                      : <span className="font-sans text-[0.6rem] text-cream font-medium">01</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid">Face Shape</p>
                    <p className="font-display text-lg text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                      {faceDone && faceShape ? faceShape : "Face Shape Scan"}
                    </p>
                    {faceDone && faceShape && FACE_SHAPE_BLURB[faceShape] && (
                      <p className="font-sans text-[0.6rem] text-brown-mid/60 leading-snug mt-0.5 line-clamp-1">
                        {FACE_SHAPE_BLURB[faceShape]}
                      </p>
                    )}
                    {faceDone && skinToneHex && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-3 h-3 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: skinToneHex }} />
                        <span className="font-sans text-[0.58rem] text-brown-mid">{skinToneHex}</span>
                      </div>
                    )}
                  </div>
                  {!faceDone && (
                    <button
                      onClick={() => setShowScanner(true)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-brown-dark text-cream rounded-xl font-sans text-[0.62rem] tracking-widest uppercase hover:bg-brown-mid transition-colors"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>

              {/* ── Item 2: Skin Analysis (auto) ── */}
              <div className={`rounded-2xl border px-5 py-4 transition-all ${
                skinDone   ? "bg-brown-dark/5 border-brown-dark/20" :
                faceDone   ? "bg-white/60 border-brown-light" :
                             "bg-white/30 border-brown-light/30"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    skinDone   ? "bg-brown-dark" :
                    skinLoading ? "bg-brown-light/40" :
                    faceDone   ? "bg-brown-light" :
                                 "bg-brown-light/30"
                  }`}>
                    {skinDone
                      ? <Check className="w-4 h-4 text-cream" strokeWidth={2} />
                      : skinLoading
                      ? <Loader2 className="w-4 h-4 text-brown-dark animate-spin" />
                      : <span className={`font-sans text-[0.6rem] font-medium ${faceDone ? "text-brown-dark" : "text-brown-light"}`}>02</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-sans text-[0.6rem] tracking-widest uppercase ${faceDone ? "text-brown-mid" : "text-brown-light/50"}`}>
                      Skin Analysis
                    </p>
                    <p className={`font-display text-lg ${faceDone ? "text-brown-dark" : "text-brown-light/40"}`} style={{ fontStyle: "italic", fontWeight: 300 }}>
                      {skinDone    ? "Skin Analysed"
                      : skinLoading ? "Analysing skin…"
                      : skinError   ? "Analysis failed"
                      : faceDone   ? "Ready"
                      :              "Auto-analysed after face scan"}
                    </p>
                    {!faceDone && (
                      <p className="font-sans text-[0.58rem] text-brown-light/40 mt-0.5">Unlocks after face scan</p>
                    )}
                  </div>
                  {skinError && faceDone && !skinDone && (
                    <button
                      onClick={() => { const img = localStorage.getItem("mellow_image"); if (img) triggerSkinAnalysis(img); }}
                      className="flex-shrink-0 px-3 py-1.5 border border-brown-mid rounded-lg font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid hover:bg-brown-mid hover:text-cream transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {!faceDone && <Lock className="w-4 h-4 text-brown-light/30 flex-shrink-0" strokeWidth={1.5} />}
                </div>
              </div>

              {/* ── Item 3: Body Scan ── */}
              <div className={`rounded-2xl border px-5 py-4 transition-all ${
                bodyDone ? "bg-brown-dark/5 border-brown-dark/20" :
                skinDone ? "bg-white/60 border-brown-mid" :
                           "bg-white/30 border-brown-light/30"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    bodyDone ? "bg-brown-dark" :
                    skinDone ? "bg-brown-mid"  :
                               "bg-brown-light/30"
                  }`}>
                    {bodyDone
                      ? <Check className="w-4 h-4 text-cream" strokeWidth={2} />
                      : <span className={`font-sans text-[0.6rem] font-medium ${skinDone ? "text-cream" : "text-brown-light"}`}>03</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-sans text-[0.6rem] tracking-widest uppercase ${skinDone ? "text-brown-mid" : "text-brown-light/50"}`}>
                      Body Analysis
                    </p>
                    <p className={`font-display text-lg ${skinDone ? "text-brown-dark" : "text-brown-light/40"}`} style={{ fontStyle: "italic", fontWeight: 300 }}>
                      {bodyDone && bodyType ? bodyType : "Body Scan"}
                    </p>
                    {!skinDone && (
                      <p className="font-sans text-[0.58rem] text-brown-light/40 mt-0.5">Unlocks after skin analysis</p>
                    )}
                  </div>
                  {bodyDone ? null : skinDone ? (
                    <button
                      onClick={startBodyScan}
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-brown-dark text-cream rounded-xl font-sans text-[0.62rem] tracking-widest uppercase hover:bg-brown-mid transition-colors"
                    >
                      Start
                    </button>
                  ) : (
                    <Lock className="w-4 h-4 text-brown-light/30 flex-shrink-0" strokeWidth={1.5} />
                  )}
                </div>
              </div>

              {/* ── CTA: See Results ── */}
              <div className="pt-2">
                <button
                  onClick={allDone ? goToResults : undefined}
                  disabled={!allDone}
                  className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-brown-dark"
                >
                  <div className="text-left">
                    <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">
                      {allDone
                        ? "All scans complete"
                        : `${[faceDone, skinDone, bodyDone].filter(Boolean).length} of 3 complete`}
                    </p>
                    <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>
                      See Full Results
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </button>
              </div>

              <button
                onClick={() => {
                  sessionStorage.removeItem("mellow_checklist_active");
                  setChecklistActive(false);
                  setPendingScanner(false);
                  setPendingAge(false);
                }}
                className="w-full text-center font-sans text-xs text-brown-mid/40 hover:text-brown-mid transition-colors pt-1"
              >
                ← Start over
              </button>
            </div>
          )}

          {/* ══ NORMAL MODE (upload + scan button) ══════════════════════════ */}
          {!checklistActive && (
            <>
              {!image && (
                <>
                  {/* PRIMARY: face scan — or gender/age picker before scan */}
                  {!pendingScanner ? (
                    <button
                      onClick={() => setPendingScanner(true)}
                      className="w-full relative cursor-pointer rounded-2xl border-2 border-brown-mid bg-white/60 hover:bg-white/85 hover:border-brown-dark transition-all duration-300 px-10 py-12 flex flex-col items-center gap-5 group"
                    >
                      <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                      <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                      <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                      <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                      <div className="w-16 h-16 rounded-full bg-brown-dark flex items-center justify-center">
                        <Camera className="w-7 h-7 text-cream" strokeWidth={1.5} />
                      </div>
                      <div className="text-center">
                        <p className="font-display text-2xl text-brown-dark" style={{ fontWeight: 400 }}>Scan Your Face</p>
                        <p className="font-sans text-sm text-brown-mid mt-1.5 leading-relaxed">
                          Camera detects face shape &amp; captures your photo automatically
                        </p>
                      </div>
                    </button>
                  ) : pendingAge ? (
                    /* Step 2: age range */
                    <div className="w-full relative rounded-2xl border-2 border-brown-mid bg-white/60 px-10 py-12 flex flex-col items-center gap-5">
                      <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/50" />
                      <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/50" />
                      <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/50" />
                      <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/50" />
                      <div className="text-center">
                        <p className="font-display text-2xl text-brown-dark" style={{ fontWeight: 400 }}>Your age range</p>
                        <p className="font-sans text-sm text-brown-mid mt-1.5">Shapes routine &amp; style advice</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        {(["Under 25", "25–35", "35–45", "45+"] as const).map((age) => (
                          <button
                            key={age}
                            onClick={() => enterChecklist(age)}
                            className="py-3 rounded-xl font-sans text-sm tracking-[0.15em] border border-brown-light bg-white/50 text-brown-mid hover:bg-brown-dark hover:text-cream hover:border-brown-dark transition-all duration-200"
                          >
                            {age}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => { setPendingAge(false); setPendingScanner(true); }}
                        className="font-sans text-xs text-brown-mid/60 hover:text-brown-mid transition-colors"
                      >
                        ← Back
                      </button>
                    </div>
                  ) : (
                    /* Step 1: gender */
                    <div className="w-full relative rounded-2xl border-2 border-brown-mid bg-white/60 px-10 py-12 flex flex-col items-center gap-5">
                      <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/50" />
                      <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/50" />
                      <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/50" />
                      <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/50" />
                      <div className="text-center">
                        <p className="font-display text-2xl text-brown-dark" style={{ fontWeight: 400 }}>Before we scan</p>
                        <p className="font-sans text-sm text-brown-mid mt-1.5">I am —</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 w-full">
                        {(["female", "male"] as const).map((g) => (
                          <button
                            key={g}
                            onClick={() => { setGender(g); setPendingScanner(false); setPendingAge(true); }}
                            className="py-3 rounded-xl font-sans text-sm tracking-[0.15em] uppercase border border-brown-light bg-white/50 text-brown-mid hover:bg-brown-dark hover:text-cream hover:border-brown-dark transition-all duration-200"
                          >
                            {g === "female" ? "Female" : "Male"}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setPendingScanner(false)}
                        className="font-sans text-xs text-brown-mid/60 hover:text-brown-mid transition-colors"
                      >
                        ← Back
                      </button>
                    </div>
                  )}

                  {/* SECONDARY: upload */}
                  <div className="mt-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 border-t border-brown-light/30" />
                      <span className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-brown-light">or upload a photo</span>
                      <div className="flex-1 border-t border-brown-light/30" />
                    </div>

                    <div
                      onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
                      onClick={() => inputRef.current?.click()}
                      className={`relative cursor-pointer rounded-2xl border border-dashed px-8 py-8 transition-all duration-300 ${
                        dragging
                          ? "border-brown-mid bg-brown-light/10"
                          : "border-brown-light bg-white/40 hover:bg-white/70 hover:border-brown-mid"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brown-light/20 flex items-center justify-center flex-shrink-0">
                          <Upload className="w-5 h-5 text-brown-mid" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="font-sans text-sm text-brown-dark font-medium">Drop portrait here</p>
                          <p className="font-sans text-xs text-brown-mid mt-0.5">or click to browse — JPG, PNG, WEBP</p>
                        </div>
                      </div>
                      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
                    </div>
                  </div>
                </>
              )}

              {/* Photo preview — upload path */}
              {image && (
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-white/60 z-10" />
                  <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-white/60 z-10" />
                  <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-white/60 z-10" />
                  <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-white/60 z-10" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="Your portrait" className="w-full h-80 object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setImage(null); }}
                    className="absolute top-3 right-10 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-brown-dark font-sans z-10 hover:bg-white transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {image && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid text-center mb-3">I am</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["female", "male"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g)}
                          className={`py-3 rounded-xl font-sans text-sm tracking-[0.15em] uppercase transition-all duration-200 border ${
                            gender === g
                              ? "bg-brown-dark text-cream border-brown-dark"
                              : "bg-white/50 text-brown-mid border-brown-light hover:bg-white/80 hover:border-brown-mid"
                          }`}
                        >
                          {g === "female" ? "Female" : "Male"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {gender && (
                    <div>
                      <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid text-center mb-3">Age range</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["Under 25", "25–35", "35–45", "45+"] as const).map((age) => (
                          <button
                            key={age}
                            onClick={() => setAgeRange(age)}
                            className={`py-3 rounded-xl font-sans text-sm tracking-[0.15em] transition-all duration-200 border ${
                              ageRange === age
                                ? "bg-brown-dark text-cream border-brown-dark"
                                : "bg-white/50 text-brown-mid border-brown-light hover:bg-white/80 hover:border-brown-mid"
                            }`}
                          >
                            {age}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={analyze}
                    disabled={!gender || !ageRange}
                    className="w-full bg-brown-dark text-cream py-4 rounded-xl font-sans tracking-[0.2em] text-sm uppercase hover:bg-brown-mid transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Analyze My Style
                  </button>
                </motion.div>
              )}

              {/* Privacy badge */}
              <motion.div {...fadeUp(0.8)} className="mt-5 flex items-center justify-center gap-2 text-brown-mid/70">
                <Lock className="w-3 h-3" strokeWidth={1.5} />
                <span className="font-sans text-xs tracking-wide">Your photo is never stored</span>
              </motion.div>
            </>
          )}
        </motion.div>
      </section>

      {/* Divider with ornament */}
      <motion.div {...fadeUp(0.85)} className="flex items-center gap-4 mx-8 md:mx-16 mb-16">
        <div className="flex-1 border-t border-brown-light/40" />
        <span className="font-display text-brown-light text-xl" style={{ fontStyle: "italic" }}>what you&apos;ll receive</span>
        <div className="flex-1 border-t border-brown-light/40" />
      </motion.div>

      {/* Feature cards */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 + i * 0.1, ease: "easeOut" }}
              className="group bg-white/40 rounded-2xl p-7 border border-brown-light/25 hover:bg-white/70 hover:border-brown-light/50 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-full bg-brown-light/15 flex items-center justify-center mb-5 group-hover:bg-brown-light/25 transition-colors">
                <f.icon className="w-5 h-5 text-brown-mid" strokeWidth={1.5} />
              </div>
              <h3 className="font-display text-xl text-brown-dark mb-2" style={{ fontWeight: 400 }}>{f.title}</h3>
              <p className="font-sans text-sm text-brown-mid leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <motion.footer {...fadeUp(1.2)} className="border-t border-brown-light/30 px-8 md:px-16 py-8 flex items-center justify-between">
        <span className="font-display text-xl text-brown-dark/60" style={{ fontStyle: "italic", fontWeight: 300 }}>mellow</span>
        <span className="font-sans text-xs text-brown-mid/60 tracking-wide">© 2026 · Powered by AI</span>
      </motion.footer>
    </main>
  );
}
