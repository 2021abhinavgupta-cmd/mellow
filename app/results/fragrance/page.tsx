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

export default function FragrancePage() {
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
  const fr = analysis.fragrance;

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Fragrance Guide</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Scents for</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.season}
          </h1>
          {fr?.tip && (
            <p className="font-sans text-sm text-brown-mid mt-3 leading-relaxed max-w-sm mx-auto">{fr.tip}</p>
          )}
        </motion.div>

        {/* Scent families */}
        {fr?.families && fr.families.length > 0 && (
          <motion.div {...fade(0.08)}>
            <Card>
              <SectionLabel>Your scent families</SectionLabel>
              <div className="space-y-3">
                {fr.families.map((family, i) => (
                  <div key={`ff-${i}`} className="flex items-center gap-3 py-2 border-b border-brown-light/15 last:border-0 last:pb-0">
                    <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid w-5 flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="font-sans text-sm text-brown-dark">{family}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Key notes */}
        {fr?.notes && fr.notes.length > 0 && (
          <motion.div {...fade(0.14)}>
            <Card>
              <SectionLabel>Key fragrance notes</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {fr.notes.map((note, i) => (
                  <span
                    key={`fn-${i}`}
                    className="px-3 py-1.5 bg-brown-light/10 border border-brown-light/25 rounded-full font-sans text-xs text-brown-dark"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Indian attars */}
        {fr?.indianAttars && fr.indianAttars.length > 0 && (
          <motion.div {...fade(0.20)}>
            <Card>
              <SectionLabel>Indian attars &amp; perfumes</SectionLabel>
              <ul className="space-y-3">
                {fr.indianAttars.map((attar, i) => (
                  <li key={`ia-${i}`} className="flex gap-3 font-sans text-xs text-brown-dark leading-snug">
                    <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid flex-shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {attar}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {/* Seasonal tips */}
        {fr?.seasonal && fr.seasonal.length > 0 && (
          <motion.div {...fade(0.26)}>
            <Card>
              <SectionLabel>Wear by season</SectionLabel>
              <ul className="space-y-2.5">
                {fr.seasonal.map((tip, i) => (
                  <li key={`fs-${i}`} className="flex gap-2.5 font-sans text-xs text-brown-dark leading-snug">
                    <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {!fr && (
          <motion.div {...fade(0.08)}>
            <Card>
              <p className="font-sans text-xs text-brown-mid/70 text-center leading-relaxed">
                Re-upload your photo to unlock personalised fragrance recommendations for your season.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Hub CTA */}
        <motion.div {...fade(0.32)}>
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
