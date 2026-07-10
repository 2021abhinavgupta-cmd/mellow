"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { SkinAnalysis } from "@/app/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Severity bar ─────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  none:        { label: "None",        fill: 0,   color: "#C9A882" },
  mild:        { label: "Mild",        fill: 1,   color: "#C9A882" },
  moderate:    { label: "Moderate",    fill: 2,   color: "#8B6347" },
  significant: { label: "Significant", fill: 3,   color: "#4A3728" },
} as const;

function SeverityBar({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.none;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-5 h-1.5 rounded-full"
            style={{ backgroundColor: i < cfg.fill ? cfg.color : "rgba(201,168,130,0.2)" }}
          />
        ))}
      </div>
      <span className="font-sans text-[0.6rem] tracking-widest uppercase" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Concern labels ───────────────────────────────────────────────────────────

const CONCERN_META: Record<string, { label: string; icon: string }> = {
  pores:       { label: "Pores",               icon: "○" },
  acne:        { label: "Acne & Breakouts",    icon: "◆" },
  darkSpots:   { label: "Dark Spots",          icon: "●" },
  texture:     { label: "Texture",             icon: "≋" },
  darkCircles: { label: "Dark Circles",        icon: "◐" },
  redness:     { label: "Redness",             icon: "◈" },
  oiliness:    { label: "Oiliness",            icon: "◎" },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SkinPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<"morning" | "evening">("morning");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mellow_skin_analysis");
      if (raw) setAnalysis(JSON.parse(raw) as SkinAnalysis);
      else router.replace("/skin-scan");
    } catch { router.replace("/skin-scan"); }
  }, [router]);

  if (!analysis) return null;

  const concerns = analysis.concerns ?? {};
  const concernKeys = Object.keys(CONCERN_META) as (keyof typeof CONCERN_META)[];

  // Sort: significant → moderate → mild → none
  const order = { significant: 0, moderate: 1, mild: 2, none: 3 };
  const sortedConcerns = [...concernKeys].sort((a, b) => {
    const sa = concerns[a as keyof typeof concerns]?.severity ?? "none";
    const sb = concerns[b as keyof typeof concerns]?.severity ?? "none";
    return (order[sa as keyof typeof order] ?? 3) - (order[sb as keyof typeof order] ?? 3);
  });

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Skin Analysis</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your skin type</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.skinType}
          </h1>
          <p className="font-sans text-sm text-brown-mid mt-3 leading-relaxed max-w-sm mx-auto">
            {analysis.overallCondition}
          </p>
        </motion.div>

        {/* Positives */}
        <motion.div {...fade(0.08)}>
          <Card>
            <SectionLabel>What&apos;s working well</SectionLabel>
            <ul className="space-y-2.5">
              {(analysis.positives ?? []).map((p, i) => (
                <li key={i} className="flex gap-2.5 font-sans text-xs text-brown-dark leading-snug">
                  <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* Concerns */}
        <motion.div {...fade(0.14)}>
          <Card>
            <SectionLabel>Skin concerns</SectionLabel>
            <div className="space-y-4">
              {sortedConcerns.map((key) => {
                const concern = concerns[key as keyof typeof concerns];
                const meta = CONCERN_META[key];
                if (!concern || !meta) return null;
                return (
                  <div key={key} className="pb-4 border-b border-brown-light/15 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-brown-light text-sm">{meta.icon}</span>
                        <p className="font-sans text-xs font-medium text-brown-dark">{meta.label}</p>
                      </div>
                      <SeverityBar severity={concern.severity} />
                    </div>
                    <p className="font-sans text-[0.65rem] text-brown-mid/70 leading-snug pl-5">
                      {concern.notes}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Recommendations */}
        <motion.div {...fade(0.20)}>
          <Card>
            <SectionLabel>Top recommendations</SectionLabel>
            <ul className="space-y-3">
              {(analysis.recommendations ?? []).map((r, i) => (
                <li key={i} className="flex gap-3 font-sans text-xs text-brown-dark leading-snug">
                  <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid flex-shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* Routine */}
        <motion.div {...fade(0.26)}>
          <Card>
            <SectionLabel>Skincare routine</SectionLabel>
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-brown-light/10 rounded-xl mb-5">
              {(["morning", "evening"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveRoutine(tab)}
                  className={`flex-1 py-2 rounded-lg font-sans text-[0.62rem] tracking-widest uppercase transition-colors ${
                    activeRoutine === tab
                      ? "bg-brown-dark text-cream"
                      : "text-brown-mid hover:text-brown-dark"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ol className="space-y-3">
              {(analysis.routine?.[activeRoutine] ?? []).map((step, i) => (
                <li key={i} className="flex gap-3 font-sans text-xs text-brown-dark leading-snug">
                  <span className="font-sans text-[0.6rem] tracking-widest text-brown-mid flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </motion.div>

        {/* Ingredients */}
        <motion.div {...fade(0.32)}>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <SectionLabel>Use</SectionLabel>
              <ul className="space-y-2">
                {(analysis.ingredients?.use ?? []).map((ing, i) => (
                  <li key={i} className="font-sans text-[0.65rem] text-brown-dark leading-snug flex gap-1.5">
                    <span className="text-brown-light flex-shrink-0">+</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <SectionLabel>Avoid</SectionLabel>
              <ul className="space-y-2">
                {(analysis.ingredients?.avoid ?? []).map((ing, i) => (
                  <li key={i} className="font-sans text-[0.65rem] text-brown-dark leading-snug flex gap-1.5">
                    <span className="text-brown-light flex-shrink-0">—</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </motion.div>

        {/* Rescan */}
        <motion.div {...fade(0.36)}>
          <button
            onClick={() => {
              localStorage.removeItem("mellow_skin_analysis");
              router.push("/skin-scan");
            }}
            className="w-full py-3 border border-brown-light/40 rounded-xl font-sans text-xs tracking-widest uppercase text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors"
          >
            Scan Again
          </button>
        </motion.div>

        {/* CTA: Continue to body scan */}
        <motion.div {...fade(0.40)}>
          <button
            onClick={() => router.push("/body-scan")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next · Step 2 of 2</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>Body Analysis</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
