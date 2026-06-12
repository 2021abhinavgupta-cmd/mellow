"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Scissors, Check, Star } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";
import { GeneratingScreen } from "@/app/components/GeneratingScreen";
import { compressDataUrl } from "@/app/lib/compress-image";

// ── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

function StyleImageCard({ name, imageData }: { name: string; imageData: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {imageData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageData} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-brown-light/10 flex items-center justify-center rounded-xl border border-brown-light/25">
            <Scissors className="w-6 h-6 text-brown-light" strokeWidth={1.5} />
          </div>
        )}
        {imageData && (
          <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <p className="font-sans text-[0.62rem] font-medium text-brown-dark text-center uppercase tracking-wide leading-tight px-1">
        {name}
      </p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
        Something went wrong
      </p>
      <p className="font-sans text-sm text-brown-mid max-w-xs">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/")}
          className="font-sans text-xs tracking-widest uppercase px-5 py-3 border border-brown-light rounded-xl text-brown-mid hover:bg-brown-light/10 transition-colors"
        >
          Upload Again
        </button>
        <button
          onClick={onRetry}
          className="font-sans text-xs tracking-widest uppercase px-5 py-3 bg-brown-dark text-cream rounded-xl hover:bg-brown-mid transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Phase = "loading" | "generating" | "done";

export default function HairResultsPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [genDone, setGenDone] = useState(0);
  const [genTotal, setGenTotal] = useState(4);
  const [hairImages, setHairImages] = useState<Record<string, string | null>>({});

  const generateImages = useCallback(async (imageDataUrl: string, h: ColorAnalysis["hair"]) => {
    const styles = h?.mostFlattering ?? [];
    if (!styles.length) { setPhase("done"); return; }

    const cacheKey = "mellow_hair_images";
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setHairImages(JSON.parse(cached));
      setGenDone(styles.length);
      setPhase("done");
      return;
    }

    setGenTotal(styles.length);
    setGenDone(0);
    setPhase("generating");

    const map: Record<string, string | null> = {};

    // Sequential — one at a time to respect 5 images/min rate limit
    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      const key = `mf-${i}`;
      const prompt = [
        `Photo editing: restyle ONLY the hair to "${style.name}". ${style.description}.`,
        `MUST keep IDENTICAL: face, skin tone, eyes, nose, lips, expression, clothing, background.`,
        `ONLY change: hair length, texture, layering, styling.`,
        `Person has ${h.faceShape} face and ${h.observedHairType} hair naturally.`,
        `Conservative minimal edit — same person, different hairstyle only.`,
      ].join(" ");

      try {
        const res = await fetch("/api/generate-visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl, prompts: [{ key, prompt }] }),
        });
        const data = await res.json();
        map[key] = data.images?.[0]?.imageData ?? null;
      } catch {
        map[key] = null;
      }
      setGenDone(i + 1);
    }

    // Compress PNG→JPEG before caching to avoid sessionStorage quota
    const compressed: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(map)) {
      compressed[k] = v ? await compressDataUrl(v) : null;
    }
    setHairImages(compressed);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(compressed));
    } catch {
      // quota exceeded — images still in memory for this session
    }
    setPhase("done");
  }, []);

  const runAnalysis = useCallback(async (imageDataUrl: string) => {
    setError(null);
    try {
      const cached = localStorage.getItem("mellow_analysis");
      if (cached) {
        const a = JSON.parse(cached) as ColorAnalysis;
        setAnalysis(a);
        await generateImages(imageDataUrl, a.hair);
        return;
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
      localStorage.setItem("mellow_analysis", JSON.stringify(data));
      const a = data as ColorAnalysis;
      setAnalysis(a);
      await generateImages(imageDataUrl, a.hair);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setPhase("done");
    }
  }, [generateImages]);

  useEffect(() => {
    const stored = localStorage.getItem("mellow_image");
    if (!stored) { router.replace("/"); return; }
    setPhoto(stored);
    runAnalysis(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show generating screen until fully ready
  if ((phase === "loading" || phase === "generating") && photo) {
    return (
      <GeneratingScreen
        photo={photo}
        title="Hairstyle Analysis"
        analysisLoaded={phase === "generating"}
        genDone={genDone}
        genTotal={genTotal}
      />
    );
  }

  if (error) return <ErrorScreen message={error} onRetry={() => photo && runAnalysis(photo)} />;
  if (!analysis || !photo) return null;

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" } as import("framer-motion").Transition,
  });

  const h = analysis.hair;
  if (!h) return null;

  return (
    <div className="min-h-screen bg-cream pb-24">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <button
          onClick={() => router.push("/results/makeup")}
          className="flex items-center gap-2 text-brown-mid hover:text-brown-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-sans text-xs tracking-widest uppercase">Makeup</span>
        </button>
        <span className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
          mellow
        </span>
      </nav>

      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-5">

        {/* ── HERO ── */}
        <motion.div {...fade(0)} className="flex flex-col sm:flex-row gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0"
          />
          <div>
            <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-1">
              Hairstyle Analysis
            </p>
            <h1
              className="font-display text-5xl sm:text-6xl text-brown-dark leading-tight"
              style={{ fontStyle: "italic", fontWeight: 300 }}
            >
              {h.faceShape}
            </h1>
            <p className="font-sans text-[0.58rem] tracking-[0.2em] uppercase text-brown-mid mt-1.5 mb-3">
              {h.observedHairType}
            </p>
            <p className="font-sans text-sm text-brown-mid leading-relaxed max-w-md">
              {h.faceShapeDescription}
            </p>
          </div>
        </motion.div>

        {/* ── FACE SHAPE TRAITS ── */}
        <motion.div {...fade(0.06)} className="flex gap-3 flex-wrap">
          {(h.faceShapeTraits ?? []).map((trait, i) => (
            <div
              key={`fst-${i}`}
              className="flex items-center gap-2 bg-white/55 border border-brown-light/25 rounded-full px-4 py-2"
            >
              <Star className="w-3 h-3 text-brown-mid" strokeWidth={1.5} />
              <span className="font-sans text-xs text-brown-mid">{trait}</span>
            </div>
          ))}
        </motion.div>

        {/* ── MOST FLATTERING HAIRSTYLES (generated images) ── */}
        <motion.div {...fade(0.12)}>
          <Card>
            <SectionLabel>Most Flattering Hairstyles</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(h.mostFlattering ?? []).map((style, i) => (
                <StyleImageCard
                  key={`mf-${i}`}
                  name={style.name}
                  imageData={hairImages[`mf-${i}`] ?? null}
                />
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── WHY THESE WORK ── */}
        <motion.div {...fade(0.2)}>
          <Card>
            <SectionLabel>Why These Work For You</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(h.mostFlattering ?? []).map((style, i) => (
                <div key={`desc-${i}`} className="flex items-start gap-2.5">
                  <span
                    className="font-display text-xl text-brown-light leading-none mt-0.5 flex-shrink-0"
                    style={{ fontStyle: "italic" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-sans text-xs font-medium text-brown-dark">{style.name}</p>
                    <p className="font-sans text-xs text-brown-mid leading-relaxed">{style.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── OTHER OPTIONS ── */}
        <motion.div {...fade(0.28)}>
          <Card>
            <SectionLabel>Other Good Options</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {(h.otherOptions ?? []).map((opt, i) => (
                <div key={`oo-${i}`} className="flex items-center gap-2 bg-brown-light/10 rounded-xl px-3 py-2">
                  <Scissors className="w-3 h-3 text-brown-mid" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-dark">{opt}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── BANGS + UPDOS ── */}
        <motion.div {...fade(0.36)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Bangs That Work</SectionLabel>
            <ul className="space-y-2">
              {(h.bangs ?? []).map((b, i) => (
                <li key={`bg-${i}`} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-dark">{b}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>Updos That Flatter</SectionLabel>
            <ul className="space-y-2">
              {(h.updos ?? []).map((u, i) => (
                <li key={`ud-${i}`} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-dark">{u}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* ── BEST PARTING + TIPS ── */}
        <motion.div {...fade(0.44)}>
          <Card>
            <div className="mb-4">
              <SectionLabel>Best Parting</SectionLabel>
              <p className="font-sans text-sm font-medium text-brown-dark">{h.bestParting}</p>
            </div>
            <div className="border-t border-brown-light/20 pt-4">
              <SectionLabel>Hair Tips</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(h.tips ?? []).map((tip, i) => (
                  <div key={`ht-${i}`} className="flex items-start gap-2">
                    <span className="text-brown-light flex-shrink-0 mt-0.5">•</span>
                    <span className="font-sans text-xs text-brown-mid leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── HAIR GOAL ── */}
        <motion.div {...fade(0.5)} className="text-center pt-1">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-2">
            Your Hair Goal
          </p>
          <p
            className="font-display text-3xl text-brown-dark"
            style={{ fontStyle: "italic", fontWeight: 300 }}
          >
            {h.goal}
          </p>
        </motion.div>

        {/* ── CTA ── */}
        <motion.div {...fade(0.56)}>
          <button
            onClick={() => router.push("/results/style")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>
                Your Style Guide
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>

        <motion.p
          {...fade(0.62)}
          className="text-center font-display text-xl text-brown-dark/40 pb-4"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          Your hair, framing your best self.
        </motion.p>
      </div>
    </div>
  );
}
