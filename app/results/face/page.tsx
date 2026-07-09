"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

// ── Face shape data ──────────────────────────────────────────────────────────

const FACE_SHAPES = [
  {
    name: "Oval",
    traits: ["Face length greater than width", "Forehead slightly wider than jaw", "Balanced proportions"],
    tip: "The most versatile shape — almost any style flatters you.",
  },
  {
    name: "Round",
    traits: ["Face length and width are similar", "Full, soft cheeks", "Rounded jawline with little definition"],
    tip: "Elongating styles and angles work best — avoid anything that adds width.",
  },
  {
    name: "Square",
    traits: ["Face length and width are similar", "Strong, angular jawline", "Broad, straight forehead"],
    tip: "Soft curves and layers balance the strong jaw. Avoid blunt, jaw-length cuts.",
  },
  {
    name: "Heart",
    traits: ["Wide forehead and prominent cheekbones", "Narrow, pointed chin", "Face tapers toward the jaw"],
    tip: "Balance the forehead by adding volume at the jaw. Chin-length cuts work well.",
  },
  {
    name: "Long",
    traits: ["Face length notably greater than width", "Similar forehead, cheekbone, and jaw width", "Straight sides"],
    tip: "Width-adding styles and layers shorten the face visually. Avoid height at the crown.",
  },
  {
    name: "Diamond",
    traits: ["Narrow forehead and jawline", "Wide, prominent cheekbones", "Angular overall structure"],
    tip: "Add width at forehead or chin to balance the cheeks. Side-swept styles help.",
  },
  {
    name: "Rectangle",
    traits: ["Face length greater than width", "Strong jawline with angular corners", "Uniform width top to bottom"],
    tip: "Soft layers and side-swept bangs add curves. Avoid straight, blunt cuts.",
  },
  {
    name: "Triangle",
    traits: ["Jaw wider than cheekbones and forehead", "Strong, wide jawline", "Face widens toward the chin"],
    tip: "Add volume at the crown and temples to balance the wide jaw.",
  },
  {
    name: "Inverted Triangle",
    traits: ["Wide forehead and temples", "Narrow jaw and chin", "Face narrows significantly downward"],
    tip: "Add width at the jaw with chin-length layers. Avoid volume at the crown.",
  },
];

// ── SVG face silhouettes ─────────────────────────────────────────────────────
// All viewBox 0 0 60 80 — drawn as closed paths, stroke only

function FaceOutline({ shape, active }: { shape: string; active: boolean }) {
  const stroke = active ? "#8B6347" : "rgba(139,99,71,0.35)";
  const sw = active ? 1.8 : 1.2;

  const props = {
    fill: active ? "rgba(139,99,71,0.06)" : "none",
    stroke,
    strokeWidth: sw,
    strokeLinejoin: "round" as const,
  };

  switch (shape) {
    case "Oval":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <ellipse cx={30} cy={40} rx={17} ry={25} {...props} />
        </svg>
      );
    case "Round":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <ellipse cx={30} cy={40} rx={20} ry={21} {...props} />
        </svg>
      );
    case "Square":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 13 20 Q 13 16 17 16 L 43 16 Q 47 16 47 20 L 47 54 Q 47 64 30 64 Q 13 64 13 54 Z" {...props} />
        </svg>
      );
    case "Heart":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 12 20 Q 11 14 18 14 L 42 14 Q 49 14 48 20 Q 49 34 30 62 Q 11 34 12 20 Z" {...props} />
        </svg>
      );
    case "Long":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <ellipse cx={30} cy={40} rx={14} ry={30} {...props} />
        </svg>
      );
    case "Diamond":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 30 10 Q 46 22 46 40 Q 46 58 30 70 Q 14 58 14 40 Q 14 22 30 10 Z" {...props} />
        </svg>
      );
    case "Rectangle":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 14 18 Q 14 13 19 13 L 41 13 Q 46 13 46 18 L 46 58 Q 46 67 30 67 Q 14 67 14 58 Z" {...props} strokeLinejoin="round" />
        </svg>
      );
    case "Triangle":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 20 15 Q 22 12 30 12 Q 38 12 40 15 L 48 54 Q 48 66 30 66 Q 12 66 12 54 Z" {...props} />
        </svg>
      );
    case "Inverted Triangle":
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <path d="M 10 18 Q 10 12 17 12 L 43 12 Q 50 12 50 18 L 42 58 Q 38 68 30 68 Q 22 68 18 58 Z" {...props} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 60 80" className="w-full h-full">
          <ellipse cx={30} cy={40} rx={17} ry={25} {...props} />
        </svg>
      );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FacePage() {
  const router = useRouter();
  const [faceShape, setFaceShape] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mellow_face_shape");
    if (stored) setFaceShape(stored);
    else {
      // Fall back to GPT analysis if scanner wasn't used
      try {
        const analysis = JSON.parse(localStorage.getItem("mellow_analysis") ?? "{}");
        if (analysis?.hair?.faceShape) setFaceShape(analysis.hair.faceShape);
      } catch { /* ignore */ }
    }
  }, []);

  const detected = FACE_SHAPES.find(s => faceShape && s.name.toLowerCase() === faceShape.toLowerCase())
    ?? (faceShape ? { name: faceShape, traits: [], tip: "" } : null);

  const GRID_SHAPES = FACE_SHAPES.map(s => s.name);

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur border-b border-brown-light/20 px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/results/style")}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brown-light/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
        </button>
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Face Shape</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-6">

        {/* Hero — detected shape */}
        <motion.div {...fade(0)}>
          <div className="text-center mb-6">
            <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your face shape</p>
            <h1
              className="font-display text-5xl text-brown-dark"
              style={{ fontStyle: "italic", fontWeight: 300 }}
            >
              {detected?.name ?? "—"}
            </h1>
          </div>

          {detected && (
            <Card>
              <div className="flex gap-5 items-start">
                {/* Large silhouette */}
                <div className="w-20 h-28 flex-shrink-0">
                  <FaceOutline shape={detected.name} active={true} />
                </div>
                <div className="flex-1 min-w-0">
                  <SectionLabel>Key characteristics</SectionLabel>
                  <ul className="space-y-2">
                    {detected.traits.map((t) => (
                      <li key={t} className="flex gap-2 font-sans text-xs text-brown-mid leading-snug">
                        <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  {detected.tip && (
                    <p className="mt-4 font-sans text-xs text-brown-dark/70 leading-relaxed border-t border-brown-light/20 pt-3">
                      {detected.tip}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </motion.div>

        {/* Reference chart — all 6 common shapes */}
        <motion.div {...fade(0.1)}>
          <Card>
            <SectionLabel>All face shapes</SectionLabel>
            <div className="grid grid-cols-3 gap-4">
              {GRID_SHAPES.map((name) => {
                const isMatch = faceShape?.toLowerCase() === name.toLowerCase();
                return (
                  <div key={name} className="flex flex-col items-center gap-2">
                    <div
                      className={`w-full aspect-[3/4] rounded-xl flex items-center justify-center p-3 transition-colors ${
                        isMatch
                          ? "bg-brown-dark/6 border border-brown-mid/40"
                          : "bg-white/40 border border-brown-light/15"
                      }`}
                    >
                      <FaceOutline shape={name} active={isMatch} />
                    </div>
                    <p
                      className={`font-sans text-[0.62rem] tracking-widest uppercase text-center transition-colors ${
                        isMatch ? "text-brown-dark font-medium" : "text-brown-mid/60"
                      }`}
                    >
                      {name}
                      {isMatch && (
                        <span className="block text-[0.55rem] tracking-widest text-brown-mid mt-0.5 normal-case">
                          yours
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>

          </Card>
        </motion.div>

        {/* Shape characteristics quick reference */}
        <motion.div {...fade(0.18)}>
          <Card>
            <SectionLabel>Shape guide</SectionLabel>
            <div className="space-y-4">
              {FACE_SHAPES.map((s) => {
                const isMatch = faceShape?.toLowerCase() === s.name.toLowerCase();
                return (
                  <div
                    key={s.name}
                    className={`flex gap-3 pb-4 border-b border-brown-light/15 last:border-0 last:pb-0 transition-opacity ${
                      isMatch ? "opacity-100" : "opacity-50"
                    }`}
                  >
                    <div className="w-8 h-11 flex-shrink-0">
                      <FaceOutline shape={s.name} active={isMatch} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-sans text-xs font-medium mb-1 ${isMatch ? "text-brown-dark" : "text-brown-mid"}`}>
                        {s.name}
                      </p>
                      <p className="font-sans text-[0.65rem] text-brown-mid/70 leading-snug">{s.traits[0]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* CTA: Skin Analysis */}
        <motion.div {...fade(0.25)}>
          <button
            onClick={() => router.push("/skin-scan")}
            className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
          >
            <div className="text-left">
              <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">Next</p>
              <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>Skin Analysis</p>
            </div>
            <ArrowRight className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </button>
        </motion.div>

        {/* Back to Style Guide */}
        <motion.div {...fade(0.30)}>
          <button
            onClick={() => router.push("/results/style")}
            className="w-full py-3 border border-brown-light/40 rounded-xl font-sans text-xs tracking-widest uppercase text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors"
          >
            Back to Style Guide
          </button>
        </motion.div>
      </div>
    </div>
  );
}
