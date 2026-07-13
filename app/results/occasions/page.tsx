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

const TABS = [
  { key: "festival",     label: "Festival" },
  { key: "weddingGuest", label: "Wedding" },
  { key: "casualIndian", label: "Daily Wear" },
] as const;

type TabKey = typeof TABS[number]["key"];

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

export default function OccasionsPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("festival");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mellow_analysis");
      if (raw) setAnalysis(JSON.parse(raw) as ColorAnalysis);
      else router.replace("/");
    } catch { router.replace("/"); }
  }, [router]);

  if (!analysis) return null;
  const occ = analysis.indianOccasions;

  const tabData = occ
    ? {
        festival:     occ.festival,
        weddingGuest: occ.weddingGuest,
        casualIndian: { ...occ.casualIndian, makeup: undefined },
      }
    : null;

  const current = tabData ? tabData[activeTab] : null;

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Indian Occasions</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Dressed for India</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.season}
          </h1>
          <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/60 mt-1">
            {analysis.undertone} undertone
          </p>
        </motion.div>

        {/* Tab switcher */}
        <motion.div {...fade(0.06)}>
          <div className="flex gap-1 p-1 bg-brown-light/10 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg font-sans text-[0.62rem] tracking-widest uppercase transition-colors ${
                  activeTab === tab.key
                    ? "bg-brown-dark text-cream"
                    : "text-brown-mid hover:text-brown-dark"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab content */}
        {current ? (
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

            {/* Outfit styles */}
            <Card>
              <SectionLabel>Outfit styles</SectionLabel>
              <ul className="space-y-3">
                {current.outfits.map((outfit, i) => (
                  <li key={`oo-${i}`} className="flex gap-3 font-sans text-xs text-brown-dark leading-snug">
                    <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid flex-shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {outfit}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Palette */}
            <Card>
              <SectionLabel>
                {activeTab === "festival" ? "Festive palette" : activeTab === "weddingGuest" ? "Wedding palette" : "Daily palette"}
              </SectionLabel>
              <div className="flex gap-3">
                {current.colors.map((hex, i) => (
                  <div key={`oc-${i}`} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-12 h-12 rounded-xl border border-brown-light/30 shadow-sm"
                      style={{ backgroundColor: hex }}
                    />
                    <p className="font-sans text-[0.52rem] text-brown-light">{hex}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Makeup direction (not for casual) */}
            {"makeup" in current && current.makeup && (
              <Card>
                <SectionLabel>Makeup direction</SectionLabel>
                <p className="font-sans text-xs text-brown-dark leading-snug">{current.makeup}</p>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div {...fade(0.14)}>
            <Card>
              <p className="font-sans text-xs text-brown-mid/70 text-center leading-relaxed">
                Re-upload your photo to unlock Indian occasion outfit guides.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Style guide cross-link */}
        <motion.div {...fade(0.28)}>
          <button
            onClick={() => router.push("/results/style")}
            className="w-full flex items-center justify-between px-5 py-3.5 border border-brown-light/30 rounded-xl hover:border-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.55rem] tracking-widest uppercase text-brown-mid/50">Also see</p>
              <p className="font-sans text-xs font-medium text-brown-dark">Western Style Guide</p>
            </div>
            <span className="font-sans text-brown-light group-hover:text-brown-mid transition-colors">→</span>
          </button>
        </motion.div>

        {/* Hub CTA */}
        <motion.div {...fade(0.34)}>
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
