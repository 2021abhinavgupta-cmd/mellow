"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Sparkles, X, Download } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";
import { GeneratingScreen } from "@/app/components/GeneratingScreen";
import { styleImageCache } from "@/app/lib/imageCache";

// Module-level cache — survives client-side navigation, auto-invalidates on new photo
let _styleCache: { photoKey: string; images: Record<string, string | null> } | null = null;

// ── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

function Dot({ hex }: { hex: string }) {
  return (
    <div
      className="w-7 h-7 rounded-full border border-black/10 flex-shrink-0"
      style={{ backgroundColor: hex }}
      title={hex}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-xs text-brown-mid border border-brown-light/40 rounded-full px-4 py-1.5">
      {children}
    </span>
  );
}

type OccasionKey = "everyday" | "office" | "occasional";

const OCCASION_LABELS: Record<OccasionKey, { label: string; subtitle: string }> = {
  everyday: { label: "Everyday", subtitle: "Casual · Chic · Effortless" },
  office: { label: "Office", subtitle: "Polished · Professional · Sharp" },
  occasional: { label: "Occasions", subtitle: "Elevated · Graceful · Memorable" },
};

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

const OCCASIONS: OccasionKey[] = ["everyday", "office", "occasional"];

export default function StyleResultsPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [genDone, setGenDone] = useState(0);
  const [genTotal] = useState(3);
  const [styleImages, setStyleImages] = useState<Record<string, string | null>>({});
  const [activeOccasion, setActiveOccasion] = useState<OccasionKey>("everyday");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const generateImages = useCallback(async (imageDataUrl: string, a: ColorAnalysis) => {
    // Never throw — image generation failure must not crash the page
    try {
      const s = a.style;
      if (!s) { setPhase("done"); return; }

      const photoKey = imageDataUrl.slice(0, 80);

      if (_styleCache?.photoKey === photoKey) {
        styleImageCache.photoKey = photoKey;
        styleImageCache.images = _styleCache.images;
        setStyleImages(_styleCache.images);
        setGenDone(OCCASIONS.length);
        setPhase("done");
        return;
      }

      // Fallback: sessionStorage survives client-side navigation even if module cache cleared
      try {
        const ss = sessionStorage.getItem("mellow_style_images");
        if (ss) {
          const cached = JSON.parse(ss) as Record<string, string | null>;
          _styleCache = { photoKey, images: cached };
          styleImageCache.photoKey = photoKey;
          styleImageCache.images = cached;
          setStyleImages(cached);
          setGenDone(OCCASIONS.length);
          setPhase("done");
          return;
        }
      } catch { /* ignore */ }

      setGenDone(0);
      setPhase("generating");

      const gender = (typeof window !== "undefined" ? localStorage.getItem("mellow_gender") : null) ?? "female";
      const isMale = gender === "male";
      const genderNote = isMale
        ? "This is a MALE person. Show him in masculine men's clothing only (shirts, trousers, suits, kurtas). No dresses, skirts, or feminine items."
        : "This is a FEMALE person. Show her in feminine women's clothing only (dresses, skirts, blouses). No men's suits or masculine items.";

      // Build all prompts upfront, send in one batch (parallel on server)
      const allPrompts = OCCASIONS.map((key) => {
        const data = s[key];
        const styles = (data?.bestStyles ?? []).slice(0, 2).join(" and ");
        const label = OCCASION_LABELS[key].label.toLowerCase();
        const prompt = [
          `Fashion edit: show this SAME person wearing a ${label} outfit — ${styles}.`,
          genderNote,
          `Colours harmonious with their ${a.season} colour season.`,
          `MUST keep IDENTICAL: face, skin tone, body proportions.`,
          `Full-length or 3/4 view, natural standing pose, professional fashion photography.`,
        ].join(" ");
        return { key, prompt };
      });

      setGenDone(0);
      const map: Record<string, string | null> = {};

      try {
        const res = await fetch("/api/generate-visuals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl, prompts: allPrompts }),
        });
        const result = await res.json();
        for (const item of result.images ?? []) {
          map[item.key] = item.imageData ?? null;
        }
      } catch {
        for (const { key } of allPrompts) map[key] = null;
      }
      setGenDone(OCCASIONS.length);

      _styleCache = { photoKey, images: map };
      styleImageCache.photoKey = photoKey;
      styleImageCache.images = map;
      try { sessionStorage.setItem("mellow_style_images", JSON.stringify(map)); } catch { /* quota */ }
      setStyleImages(map);
    } catch {
      // swallow all errors — text content still renders
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
        await generateImages(imageDataUrl, a);
        return;
      }
      const gender = localStorage.getItem("mellow_gender") ?? "female";
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, gender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
      localStorage.setItem("mellow_analysis", JSON.stringify(data));
      const a = data as ColorAnalysis;
      setAnalysis(a);
      await generateImages(imageDataUrl, a);
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

  if ((phase === "loading" || phase === "generating") && photo) {
    return (
      <GeneratingScreen
        photo={photo}
        title="Style Guide"
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

  const s = analysis.style;
  if (!s) return null;

  const activeData = s[activeOccasion];

  return (
    <div className="min-h-screen bg-cream pb-24">
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <button
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="w-5 h-5 text-white" strokeWidth={1.5} />
          </button>
        </div>
      )}
      <nav className="print:hidden flex items-center justify-between px-6 md:px-12 py-5">
        <button
          onClick={() => router.push("/results/hair")}
          className="flex items-center gap-2 text-brown-mid hover:text-brown-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-sans text-xs tracking-widest uppercase">Hair Styles</span>
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
            <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your Style Guide</p>
            <h1
              className="font-display text-5xl sm:text-6xl text-brown-dark leading-tight"
              style={{ fontStyle: "italic", fontWeight: 300 }}
            >
              {s.bodyType}
            </h1>
            <p className="font-sans text-sm text-brown-mid leading-relaxed max-w-md mt-3">{s.bodyTypeDescription}</p>
          </div>
        </motion.div>

        {/* ── KEY FEATURES + WHAT FLATTERS ── */}
        <motion.div {...fade(0.08)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Your Shape</SectionLabel>
            <ul className="space-y-2">
              {(s.keyFeatures ?? []).map((f, i) => (
                <li key={`kf-${i}`} className="flex items-start gap-2.5">
                  <span className="text-brown-light flex-shrink-0 mt-0.5">•</span>
                  <span className="font-sans text-xs text-brown-dark leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>What Flatters You</SectionLabel>
            <ul className="space-y-2">
              {(s.whatFlattens ?? []).map((f, i) => (
                <li key={`wf-${i}`} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brown-mid flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-dark leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* ── OUTFIT CATEGORIES WITH IMAGE ── */}
        <motion.div {...fade(0.16)}>
          <Card>
            <SectionLabel>Outfit Categories</SectionLabel>
            <div className="flex gap-1 mb-5 bg-brown-light/10 rounded-xl p-1">
              {OCCASIONS.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveOccasion(key)}
                  className={`flex-1 py-2.5 sm:py-2 rounded-lg font-sans text-[0.65rem] tracking-widest uppercase transition-all duration-200 ${
                    activeOccasion === key
                      ? "bg-brown-dark text-cream shadow-sm"
                      : "text-brown-mid hover:text-brown-dark"
                  }`}
                >
                  {OCCASION_LABELS[key].label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Generated outfit image */}
              <div
                className={`relative rounded-xl overflow-hidden group ${styleImages[activeOccasion] ? "cursor-pointer" : ""}`}
                style={{ aspectRatio: "3/4", maxHeight: "280px" }}
                onClick={styleImages[activeOccasion] ? () => setLightboxSrc(styleImages[activeOccasion]!) : undefined}
              >
                {styleImages[activeOccasion] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={styleImages[activeOccasion]!}
                    alt={`${OCCASION_LABELS[activeOccasion].label} outfit`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-brown-light/10 rounded-xl flex items-center justify-center border border-brown-light/20">
                    <Sparkles className="w-8 h-8 text-brown-light" strokeWidth={1.5} />
                  </div>
                )}
                {styleImages[activeOccasion] && (
                  <>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brown-dark/60 to-transparent p-3">
                      <p className="font-sans text-[0.6rem] tracking-widest uppercase text-cream/80">
                        {OCCASION_LABELS[activeOccasion].subtitle}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const a = document.createElement("a");
                        a.href = styleImages[activeOccasion]!;
                        a.download = `mellow-${activeOccasion}-outfit.png`;
                        a.click();
                      }}
                      className="print:hidden absolute top-2 right-2 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/60"
                      title="Download image"
                    >
                      <Download className="w-4 h-4 text-white" strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-sans text-[0.55rem] tracking-[0.15em] uppercase text-brown-mid mb-3">
                    Best Styles
                  </p>
                  <ul className="space-y-2">
                    {(activeData?.bestStyles ?? []).map((st, i) => (
                      <li key={`st-${activeOccasion}-${i}`} className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-brown-mid flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span className="font-sans text-xs text-brown-dark">{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-sans text-[0.55rem] tracking-[0.15em] uppercase text-brown-mid mb-3">
                    Best Colors
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {(activeData?.bestColors ?? []).map((hex, i) => (
                      <Dot key={`oc-${activeOccasion}-${i}`} hex={hex} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── NECKLINES + PRINTS ── */}
        <motion.div {...fade(0.24)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Necklines That Flatter</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {(s.necklines ?? []).map((n, i) => <Pill key={`nl-${i}`}>{n}</Pill>)}
            </div>
          </Card>
          <Card>
            <SectionLabel>Prints & Patterns</SectionLabel>
            <ul className="space-y-3">
              {(s.prints ?? []).map((p, i) => (
                <li key={`pr-${i}`}>
                  <p className="font-sans text-xs font-medium text-brown-dark">{p.name}</p>
                  <p className="font-sans text-[0.65rem] text-brown-mid leading-relaxed">{p.tip}</p>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* ── FABRICS + AVOID ── */}
        <motion.div {...fade(0.32)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Fabrics That Flatter</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {(s.fabrics ?? []).map((f, i) => <Pill key={`fb-${i}`}>{f}</Pill>)}
            </div>
          </Card>
          <Card>
            <SectionLabel>What to Avoid</SectionLabel>
            <ul className="space-y-2">
              {(s.avoid ?? []).map((a, i) => (
                <li key={`av-${i}`} className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-brown-light flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-mid leading-snug">{a}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* ── OUTFIT FORMULA ── */}
        <motion.div {...fade(0.4)}>
          <div className="border border-brown-light/40 rounded-2xl p-5 bg-brown-dark/[0.03]">
            <SectionLabel>Your Outfit Formula</SectionLabel>
            <p
              className="font-display text-2xl sm:text-3xl text-brown-dark"
              style={{ fontStyle: "italic", fontWeight: 300 }}
            >
              {s.outfitFormula}
            </p>
          </div>
        </motion.div>

        {/* ── QUICK TIPS ── */}
        <motion.div {...fade(0.48)}>
          <Card>
            <SectionLabel>Quick Style Tips</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(s.quickTips ?? []).map((tip, i) => (
                <div key={`qt-${i}`} className="flex items-start gap-2.5">
                  <span
                    className="font-display text-2xl text-brown-light leading-none"
                    style={{ fontStyle: "italic" }}
                  >
                    {i + 1}
                  </span>
                  <p className="font-sans text-xs text-brown-mid leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── CTA: FACE SHAPE GUIDE ── */}
        <motion.div {...fade(0.50)} className="print:hidden">
          <button
            onClick={() => router.push("/results/face")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>Your Face Shape Guide</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>

        <motion.div {...fade(0.54)} className="print:hidden flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-brown-light/40 rounded-xl text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors font-sans text-xs tracking-widest uppercase"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            This Page
          </button>
          <button
            onClick={() => router.push("/results/print")}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-brown-dark text-cream rounded-xl hover:bg-brown-mid transition-colors font-sans text-xs tracking-widest uppercase"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            All 4 Pages
          </button>
        </motion.div>

        <motion.p
          {...fade(0.56)}
          className="print:hidden text-center font-display text-xl text-brown-dark/40 pb-4"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          Dress for the woman you are becoming.
        </motion.p>
      </div>
    </div>
  );
}
