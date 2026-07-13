"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

export default function NailsPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mellow_analysis");
      if (raw) setAnalysis(JSON.parse(raw) as ColorAnalysis);
      else router.replace("/");
    } catch { router.replace("/"); }
  }, [router]);

  if (!analysis) return null;
  const nails = analysis.nails;

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur border-b border-brown-light/20 px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brown-light/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
        </button>
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Nail Colours</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your season</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.season}
          </h1>
          {nails?.tip && (
            <p className="font-sans text-sm text-brown-mid mt-3 leading-relaxed max-w-sm mx-auto">
              {nails.tip}
            </p>
          )}
        </motion.div>

        {/* Best polishes */}
        {nails?.bestPolish && nails.bestPolish.length > 0 && (
          <motion.div {...fade(0.08)}>
            <Card>
              <SectionLabel>Best nail colours</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {nails.bestPolish.map((swatch, i) => (
                  <div key={`np-${i}`} className="flex flex-col items-center gap-2">
                    <div
                      className="w-14 h-14 rounded-full border border-brown-light/30 shadow-sm"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <p className="font-sans text-[0.6rem] text-brown-mid text-center leading-tight">{swatch.name}</p>
                    <p className="font-sans text-[0.55rem] text-brown-light">{swatch.hex}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* French tip */}
        {nails?.frenchTip && nails.frenchTip.length > 0 && (
          <motion.div {...fade(0.14)}>
            <Card>
              <SectionLabel>French tip variations</SectionLabel>
              <div className="flex gap-4">
                {nails.frenchTip.map((hex, i) => (
                  <div key={`ft-${i}`} className="flex flex-col items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-2xl border border-brown-light/30"
                      style={{ backgroundColor: hex }}
                    />
                    <p className="font-sans text-[0.55rem] text-brown-light">{hex}</p>
                  </div>
                ))}
              </div>
              <p className="font-sans text-[0.65rem] text-brown-mid/70 mt-3">
                Soft, season-matched variations on the classic French manicure.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Avoid */}
        {nails?.avoid && nails.avoid.length > 0 && (
          <motion.div {...fade(0.20)}>
            <Card>
              <SectionLabel>Shades to skip</SectionLabel>
              <ul className="space-y-2">
                {nails.avoid.map((shade, i) => (
                  <li key={`na-${i}`} className="flex gap-2.5 font-sans text-xs text-brown-dark leading-snug">
                    <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
                    {shade}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {/* Seasonal palette fallback swatches */}
        {!nails && (
          <motion.div {...fade(0.08)}>
            <Card>
              <SectionLabel>Season palette — try these on your nails</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {(analysis.bestColors ?? []).slice(0, 10).map((hex, i) => (
                  <div key={`bc-${i}`} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-full border border-brown-light/30"
                      style={{ backgroundColor: hex }}
                    />
                    <p className="font-sans text-[0.52rem] text-brown-light">{hex}</p>
                  </div>
                ))}
              </div>
              <p className="font-sans text-[0.65rem] text-brown-mid/60 mt-3">
                Re-upload your photo to get nail-specific recommendations.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Hub CTA */}
        <motion.div {...fade(0.26)}>
          <button
            onClick={() => router.push("/results/hub")}
            className="w-full py-3 border border-brown-light/40 rounded-xl font-sans text-xs tracking-widest uppercase text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    </div>
  );
}
