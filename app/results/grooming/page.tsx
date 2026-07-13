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

export default function GroomingPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [gender, setGender] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mellow_analysis");
      const g = localStorage.getItem("mellow_gender");
      setGender(g);
      if (raw) setAnalysis(JSON.parse(raw) as ColorAnalysis);
      else router.replace("/");
    } catch { router.replace("/"); }
  }, [router]);

  if (!analysis) return null;

  // Redirect female users to makeup page
  if (gender === "female") {
    return (
      <div className="min-h-screen bg-cream pb-16">
        <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur border-b border-brown-light/20 px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brown-light/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
          </button>
          <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Grooming</p>
        </div>
        <div className="max-w-xl mx-auto px-5 pt-16 space-y-5 text-center">
          <motion.div {...fade(0)}>
            <h1 className="font-display text-4xl text-brown-dark mb-4" style={{ fontStyle: "italic", fontWeight: 300 }}>
              Grooming is for men
            </h1>
            <p className="font-sans text-sm text-brown-mid mb-8">
              Your personalised makeup guide is waiting for you.
            </p>
            <button
              onClick={() => router.push("/results/makeup")}
              className="px-6 py-3 bg-brown-dark text-cream rounded-xl font-sans text-xs tracking-widest uppercase hover:bg-brown-mid transition-colors"
            >
              Go to Makeup Guide
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const gr = analysis.grooming;

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Grooming Guide</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Grooming for</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.hair?.faceShape ?? analysis.season}
          </h1>
          {gr?.tip && (
            <p className="font-sans text-sm text-brown-mid mt-3 leading-relaxed max-w-sm mx-auto">{gr.tip}</p>
          )}
        </motion.div>

        {/* Beard styles */}
        {gr?.beardStyles && gr.beardStyles.length > 0 && (
          <motion.div {...fade(0.08)}>
            <Card>
              <SectionLabel>Beard styles for your face shape</SectionLabel>
              <div className="space-y-4">
                {gr.beardStyles.map((style, i) => (
                  <div key={`bs-${i}`} className="pb-4 border-b border-brown-light/15 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="font-sans text-sm font-medium text-brown-dark">{style.name}</p>
                    </div>
                    <p className="font-sans text-[0.65rem] text-brown-mid/70 leading-snug pl-5">{style.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* No-beard / stubble */}
        {gr?.noBeardOptions && gr.noBeardOptions.length > 0 && (
          <motion.div {...fade(0.14)}>
            <Card>
              <SectionLabel>No-beard alternatives</SectionLabel>
              <ul className="space-y-2">
                {gr.noBeardOptions.map((opt, i) => (
                  <li key={`nb-${i}`} className="flex gap-2.5 font-sans text-xs text-brown-dark leading-snug">
                    <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
                    {opt}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {/* Skincare */}
        {gr?.skincare && gr.skincare.length > 0 && (
          <motion.div {...fade(0.20)}>
            <Card>
              <SectionLabel>Grooming routine</SectionLabel>
              <ol className="space-y-3">
                {gr.skincare.map((step, i) => (
                  <li key={`gc-${i}`} className="flex gap-3 font-sans text-xs text-brown-dark leading-snug">
                    <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid flex-shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>
          </motion.div>
        )}

        {/* Fragrance notes */}
        {gr?.fragranceNotes && gr.fragranceNotes.length > 0 && (
          <motion.div {...fade(0.26)}>
            <Card>
              <SectionLabel>Fragrance notes for your season</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {gr.fragranceNotes.map((note, i) => (
                  <span
                    key={`gf-${i}`}
                    className="px-3 py-1.5 bg-brown-light/10 border border-brown-light/25 rounded-full font-sans text-xs text-brown-dark"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {!gr && (
          <motion.div {...fade(0.08)}>
            <Card>
              <p className="font-sans text-xs text-brown-mid/70 text-center leading-relaxed">
                Re-upload your photo to unlock a personalised grooming guide.
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
