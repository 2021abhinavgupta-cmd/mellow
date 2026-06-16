"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Droplets, Layers, Circle, XCircle, Download } from "lucide-react";
import type { ColorAnalysis, NamedSwatch } from "@/app/lib/types";

// ── Primitives ────────────────────────────────────────────────────────────────

function Dot({ hex }: { hex: string }) {
  return <div className="w-9 h-9 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: hex }} title={hex} />;
}

function LipSwatch({ name, hex }: NamedSwatch) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-14 h-7 rounded-full border border-black/10" style={{ backgroundColor: hex }} title={hex} />
      <span className="font-sans text-[0.55rem] text-brown-mid text-center leading-tight max-w-[56px]">{name}</span>
    </div>
  );
}

function NamedDot({ name, hex }: NamedSwatch) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-10 h-10 rounded-full border border-black/10" style={{ backgroundColor: hex }} title={hex} />
      <span className="font-sans text-[0.55rem] text-brown-mid text-center leading-tight max-w-[44px]">{name}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 border-t border-brown-light/30" />
      <span className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-light">{label}</span>
      <div className="flex-1 border-t border-brown-light/30" />
    </div>
  );
}

const SKIN_ICONS = [Droplets, Layers, Circle, XCircle];

// ── Loading / Error ───────────────────────────────────────────────────────────

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
        <p className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>Building your makeup guide…</p>
        <p className="font-sans text-xs text-brown-mid mt-2 tracking-widest">This takes about 15 seconds</p>
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MakeupResultsPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (imageDataUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const cached = localStorage.getItem("mellow_analysis");
      if (cached) {
        setAnalysis(JSON.parse(cached) as ColorAnalysis);
        setLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && photo) return <LoadingScreen photoSrc={photo} />;
  if (error) return <ErrorScreen message={error} onRetry={() => photo && runAnalysis(photo)} />;
  if (!analysis || !photo) return null;

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: "easeOut" } as import("framer-motion").Transition,
  });

  const m = analysis.makeup;

  return (
    <div className="min-h-screen bg-cream pb-24">

      <nav className="print:hidden flex items-center justify-between px-6 md:px-12 py-5">
        <button onClick={() => router.push("/results")} className="flex items-center gap-2 text-brown-mid hover:text-brown-dark transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-sans text-xs tracking-widest uppercase">Colour Analysis</span>
        </button>
        <span className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>mellow</span>
      </nav>

      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-5">

        {/* ── HERO ── */}
        <motion.div {...fade(0)} className="flex flex-col sm:flex-row gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
          <div>
            <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your Personal Makeup Palette</p>
            <h1 className="font-display text-5xl sm:text-6xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>
              {analysis.season}
            </h1>
            <p className="font-sans text-[0.58rem] tracking-[0.2em] uppercase text-brown-mid mt-1.5 mb-3">
              {(analysis.descriptors ?? []).join(" · ")}
            </p>
            <p className="font-sans text-sm text-brown-mid leading-relaxed max-w-md">{analysis.bestColorsNote}</p>
          </div>
        </motion.div>

        {/* ── EYESHADOWS ── */}
        <motion.div {...fade(0.08)}>
          <Card>
            <SectionLabel>Eyeshadows</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid mb-3">Matte Shades</p>
                <div className="flex gap-3 flex-wrap">
                  {(m?.eyeshadow?.matte ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
                </div>
              </div>
              <div>
                <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid mb-3">Shimmer Shades</p>
                <div className="flex gap-3 flex-wrap">
                  {(m?.eyeshadow?.shimmer ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
                </div>
              </div>
            </div>
            {m?.eyeshadow?.tip && (
              <p className="font-sans text-xs text-brown-mid mt-4 leading-relaxed border-t border-brown-light/20 pt-3">{m.eyeshadow.tip}</p>
            )}
          </Card>
        </motion.div>

        {/* ── LIPSTICK COLORS ── */}
        <motion.div {...fade(0.16)}>
          <Card>
            <SectionLabel>Lipstick Colors</SectionLabel>
            <div className="space-y-5">
              {(
                [
                  { label: "Nudes", items: m?.lipstick?.nudes },
                  { label: "Pinks & Roses", items: m?.lipstick?.pinksAndRoses },
                  { label: "Corals & Browns", items: m?.lipstick?.coralsAndBrowns },
                ] as { label: string; items: NamedSwatch[] | undefined }[]
              ).map(({ label, items }) => (
                <div key={label}>
                  <Divider label={label} />
                  <div className="flex gap-4 flex-wrap mt-3">
                    {(items ?? []).map((s) => <LipSwatch key={s.name} {...s} />)}
                  </div>
                </div>
              ))}
            </div>
            {m?.lipstick?.tip && (
              <p className="font-sans text-xs text-brown-mid mt-5 leading-relaxed border-t border-brown-light/20 pt-3">{m.lipstick.tip}</p>
            )}
          </Card>
        </motion.div>

        {/* ── BLUSH + HIGHLIGHT & CONTOUR ── */}
        <motion.div {...fade(0.24)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Blush Shades</SectionLabel>
            <div className="flex gap-3 flex-wrap mb-4">
              {(m?.blush?.shades ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
            </div>
            {m?.blush?.tip && (
              <p className="font-sans text-xs text-brown-mid leading-relaxed border-t border-brown-light/20 pt-3">{m.blush.tip}</p>
            )}
          </Card>

          <Card>
            <SectionLabel>Highlight & Contour</SectionLabel>
            <div className="flex gap-6 mb-2">
              <div>
                <p className="font-sans text-[0.53rem] tracking-[0.15em] uppercase text-brown-mid mb-2">Highlight</p>
                <div className="flex gap-2">{(m?.highlightAndContour?.highlight ?? []).map((hex, i) => <Dot key={`hl-${i}`} hex={hex} />)}</div>
              </div>
              <div>
                <p className="font-sans text-[0.53rem] tracking-[0.15em] uppercase text-brown-mid mb-2">Contour</p>
                <div className="flex gap-2">{(m?.highlightAndContour?.contour ?? []).map((hex, i) => <Dot key={`ct-${i}`} hex={hex} />)}</div>
              </div>
            </div>
            {m?.highlightAndContour?.tip && (
              <p className="font-sans text-xs text-brown-mid leading-relaxed border-t border-brown-light/20 pt-3">{m.highlightAndContour.tip}</p>
            )}
          </Card>
        </motion.div>

        {/* ── WHAT WORKS FOR YOUR SKIN ── */}
        <motion.div {...fade(0.32)}>
          <Card>
            <SectionLabel>What Works For Your Skin</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(analysis.skinTips ?? []).map((tip, i) => {
                const Icon = SKIN_ICONS[i] ?? Circle;
                return (
                  <div key={tip.title} className="flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-brown-light/15 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-brown-mid" strokeWidth={1.5} />
                    </div>
                    <p className="font-sans text-xs font-medium text-brown-dark">{tip.title}</p>
                    <p className="font-sans text-[0.65rem] text-brown-mid leading-relaxed">{tip.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* ── COMPLETE LOOK EXAMPLE + QUICK REFERENCE ── */}
        <motion.div {...fade(0.4)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <SectionLabel>Complete Look Example</SectionLabel>
            <div className="space-y-2.5">
              {[
                { emoji: "👁", label: "Eyes", val: analysis.completeLook?.eyes },
                { emoji: "💋", label: "Lips", val: analysis.completeLook?.lips },
                { emoji: "🌸", label: "Blush", val: analysis.completeLook?.blush },
                { emoji: "✨", label: "Highlight", val: analysis.completeLook?.highlight },
              ].map(({ emoji, label, val }) => val && (
                <div key={label} className="flex items-start gap-2.5">
                  <span className="text-sm">{emoji}</span>
                  <div>
                    <span className="font-sans text-[0.58rem] tracking-[0.15em] uppercase text-brown-mid">{label}: </span>
                    <span className="font-sans text-xs text-brown-dark">{val}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionLabel>Quick Reference</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-sans text-[0.55rem] tracking-[0.15em] uppercase text-brown-mid mb-2">Best Colors</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(analysis.bestColors ?? []).slice(0, 10).map((hex, i) => (
                    <div key={`qbc-${i}`} className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="font-sans text-[0.55rem] tracking-[0.15em] uppercase text-brown-mid mb-2">Avoid Colors</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(analysis.avoidColors ?? []).map((hex, i) => (
                    <div key={`qac-${i}`} className="w-6 h-6 rounded-full border border-black/10 opacity-60" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── CTA: HAIR PAGE ── */}
        <motion.div {...fade(0.48)} className="print:hidden">
          <button
            onClick={() => router.push("/results/hair")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>Your Hair Styles</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>

        <motion.div {...fade(0.52)} className="print:hidden flex gap-3">
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

        <motion.p {...fade(0.56)} className="print:hidden text-center font-display text-xl text-brown-dark/40 pb-4" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Enhance your beauty, not hide it.
        </motion.p>

      </div>
    </div>
  );
}
