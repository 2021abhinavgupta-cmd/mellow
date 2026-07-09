"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ArrowRight, Download, Share2 } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";
import dynamic from "next/dynamic";

const ShareCard = dynamic(() => import("@/app/components/ShareCard"), { ssr: false });

function Dot({ hex }: { hex: string }) {
  return (
    <div className="w-9 h-9 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: hex }} title={hex} />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

function LoadingScreen({ photoSrc }: { photoSrc: string }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt="" className="w-28 h-28 rounded-full object-cover border-4 border-brown-light/40" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-brown-mid"
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Reading your radiance…
        </p>
        <p className="font-sans text-xs text-brown-mid mt-2 tracking-widest">Analysing your seasonal colour profile</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>Something went wrong</p>
      <p className="font-sans text-sm text-brown-mid max-w-xs">{message}</p>
      <div className="flex gap-3">
        <button onClick={() => router.push("/")} className="font-sans text-xs tracking-widest uppercase px-5 py-3 border border-brown-light rounded-xl text-brown-mid hover:bg-brown-light/10 transition-colors">
          Upload Again
        </button>
        <button onClick={onRetry} className="font-sans text-xs tracking-widest uppercase px-5 py-3 bg-brown-dark text-cream rounded-xl hover:bg-brown-mid transition-colors">
          Retry
        </button>
      </div>
    </div>
  );
}

export default function ColorResultsPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [faceShape, setFaceShape] = useState<string | null>(null);

  const runAnalysis = async (imageDataUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      // use cached result if available
      const cached = localStorage.getItem("mellow_analysis");
      if (cached) {
        setAnalysis(JSON.parse(cached) as ColorAnalysis);
        setLoading(false);
        return;
      }
      const gender = localStorage.getItem("mellow_gender") ?? "female";
      const skinToneRaw = localStorage.getItem("mellow_skin_tone");
      const skinTone = skinToneRaw ? JSON.parse(skinToneRaw) : undefined;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, gender, skinTone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
      localStorage.setItem("mellow_analysis", JSON.stringify(data));
      setAnalysis(data as ColorAnalysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("mellow_image");
    if (!stored) { router.replace("/"); return; }
    setPhoto(stored);
    runAnalysis(stored);
    setFaceShape(localStorage.getItem("mellow_face_shape"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && photo) return <LoadingScreen photoSrc={photo} />;
  if (error) return <ErrorScreen message={error} onRetry={() => photo && runAnalysis(photo)} />;
  if (!analysis || !photo) return null;

  const scannedFaceShape = faceShape ?? analysis.hair?.faceShape ?? null;

  const chunk = <T,>(arr: T[], n: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" } as import("framer-motion").Transition,
  });

  return (
    <div className="min-h-screen bg-cream pb-24">

      {showShare && (
        <ShareCard
          season={analysis.season}
          undertone={analysis.undertone}
          bestColors={analysis.bestColors ?? []}
          seasonalPalette={analysis.seasonalPalette ?? []}
          faceShape={scannedFaceShape}
          onClose={() => setShowShare(false)}
        />
      )}

      <nav className="print:hidden flex items-center justify-between px-6 md:px-12 py-5">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-brown-mid hover:text-brown-dark transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-sans text-xs tracking-widest uppercase">New Analysis</span>
        </button>
        <span className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>mellow</span>
        <button onClick={() => router.push("/results/hub")} className="font-sans text-xs tracking-widest uppercase text-brown-mid/60 hover:text-brown-mid transition-colors">
          Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-5">

        {/* ── HERO ── */}
        <motion.div {...fade(0)} className="flex flex-col sm:flex-row gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Personal Colour Analysis</p>
            <h1 className="font-display text-5xl sm:text-6xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>
              {analysis.season}
            </h1>
            <p className="font-sans text-[0.58rem] tracking-[0.2em] uppercase text-brown-mid mt-1.5 mb-3">
              {(analysis.descriptors ?? []).join(" · ")}
            </p>
            <p className="font-sans text-sm text-brown-mid leading-relaxed max-w-md">{analysis.seasonDescription}</p>
          </div>
        </motion.div>

        {/* ── WHAT WORKS FOR YOU ── */}
        <motion.div {...fade(0.08)}>
          <Card>
            <SectionLabel>What Works For You</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(analysis.whatWorksWell ?? []).map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brown-mid mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-xs text-brown-dark leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── BEST COLORS + UNDERTONE ── */}
        <motion.div {...fade(0.16)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Best Colors</SectionLabel>
            <div className="space-y-2">
              {chunk(analysis.bestColors ?? [], 5).map((row, ri) => (
                <div key={ri} className="flex gap-2">{row.map((hex, ci) => <Dot key={`bc-${ri}-${ci}`} hex={hex} />)}</div>
              ))}
            </div>
            <p className="font-sans text-xs text-brown-mid mt-4 leading-relaxed">{analysis.bestColorsNote}</p>
          </Card>

          <Card>
            <SectionLabel>Your Undertone</SectionLabel>
            <p className="font-sans text-sm font-medium tracking-[0.15em] uppercase text-brown-dark mb-3">{analysis.undertone}</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#C9A882] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-brown-mid" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              </div>
              <span className="text-brown-light">+</span>
              <div className="w-9 h-9 rounded-full border-2 border-brown-light overflow-hidden flex-shrink-0"
                style={{ background: `linear-gradient(90deg, ${analysis.bestNeutrals?.[0] ?? "#C9A882"} 50%, #FAF6F0 50%)` }}
              />
            </div>
            <p className="font-sans text-xs text-brown-mid leading-relaxed">{analysis.undertoneDescription}</p>
          </Card>
        </motion.div>

        {/* ── STYLE GUIDE ── */}
        <motion.div {...fade(0.24)}>
          <Card>
            <SectionLabel>Style Guide</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: "♥", label: "Enhances", items: analysis.enhances },
                { icon: "✕", label: "Avoid", items: analysis.avoid },
                { icon: "✦", label: "Style Tips", items: analysis.styleTips },
              ].map(({ icon, label, items }) => (
                <div key={label}>
                  <p className="font-sans text-[0.58rem] tracking-[0.2em] uppercase text-brown-dark font-medium mb-3 flex items-center gap-1.5">
                    <span className="text-brown-mid">{icon}</span> {label}
                  </p>
                  <ul className="space-y-2">
                    {(items ?? []).map((item) => (
                      <li key={item} className="font-sans text-xs text-brown-mid leading-relaxed flex gap-2">
                        <span className="text-brown-light flex-shrink-0">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ── BEST NEUTRALS ── */}
        <motion.div {...fade(0.32)}>
          <Card>
            <SectionLabel>Best Neutrals</SectionLabel>
            <div className="flex gap-3">
              {(analysis.bestNeutrals ?? []).map((hex, i) => <Dot key={`bn-${i}`} hex={hex} />)}
            </div>
            <p className="font-sans text-xs text-brown-mid mt-4 leading-relaxed">
              Build your wardrobe base around these — then layer your season&apos;s accent colours on top.
            </p>
          </Card>
        </motion.div>

        {/* ── SEASONAL PALETTE ── */}
        <motion.div {...fade(0.4)}>
          <Card>
            <SectionLabel>Full Seasonal Palette · {analysis.season}</SectionLabel>
            <div className="space-y-2">
              {chunk(analysis.seasonalPalette ?? [], 8).map((row, ri) => (
                <div key={ri} className="flex gap-1.5 sm:gap-2 flex-wrap">
                  {row.map((hex, ci) => (
                    <div key={`sp-${ri}-${ci}`} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              ))}
            </div>
            <p className="font-sans text-xs text-brown-mid mt-4 leading-relaxed">
              Your complete colour universe — use across clothing, accessories, and makeup.
            </p>
          </Card>
        </motion.div>

        {/* ── TRAITS ── */}
        <motion.div {...fade(0.48)} className="text-center pt-1">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-3">How Your Colouring Reads</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {(analysis.traits ?? []).map((trait) => (
              <span key={trait} className="font-sans text-xs tracking-widest uppercase text-brown-mid border border-brown-light/50 rounded-full px-5 py-2">
                {trait}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── CTA: MAKEUP PAGE ── */}
        <motion.div {...fade(0.55)} className="print:hidden">
          <button
            onClick={() => router.push("/results/makeup")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>Your Makeup Analysis</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>

        <motion.div {...fade(0.58)} className="print:hidden flex gap-3">
          <button
            onClick={() => setShowShare(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-brown-light/40 rounded-xl text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors font-sans text-xs tracking-widest uppercase"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Colour Card
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-brown-light/40 rounded-xl text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors font-sans text-xs tracking-widest uppercase"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            Print Page
          </button>
          <button
            onClick={() => router.push("/results/print")}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-brown-dark text-cream rounded-xl hover:bg-brown-mid transition-colors font-sans text-xs tracking-widest uppercase"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            All 4
          </button>
        </motion.div>

        <motion.p {...fade(0.6)} className="print:hidden text-center font-display text-xl text-brown-dark/40 pb-4" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Wear what makes you feel like yourself.
        </motion.p>

      </div>
    </div>
  );
}
