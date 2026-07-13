"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

// ── Face shape base data ─────────────────────────────────────────────────────

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

// ── Per-shape extras data ─────────────────────────────────────────────────────

interface ShapeExtras {
  glasses: { best: string[]; avoid: string };
  earrings: { best: string[]; tip: string };
  contour: { contour: string; highlight: string; blush: string };
  bindi: { shape: string; placement: string };
}

const FACE_SHAPE_EXTRAS: Record<string, ShapeExtras> = {
  Oval: {
    glasses: {
      best: ["Wayfarers", "Aviators", "Cat-eye", "Square frames"],
      avoid: "Oversized round frames that hide your natural balance",
    },
    earrings: {
      best: ["Hoops", "Long drops", "Chandbali", "Geometric studs"],
      tip: "Most versatile shape — any silhouette works. Use earrings to express personality.",
    },
    contour: {
      contour: "Minimal needed — light sculpting along temples if desired",
      highlight: "Centre of forehead, nose bridge, cupid's bow, chin centre",
      blush: "Apples of cheeks swept upward toward temples",
    },
    bindi: {
      shape: "Round or teardrop — both flatter",
      placement: "Centre of forehead between brows. Any size works; medium is ideal for everyday",
    },
  },
  Round: {
    glasses: {
      best: ["Square frames", "Rectangle frames", "Wayfarers", "Angular shapes"],
      avoid: "Round and circular frames — they echo the face shape and add width",
    },
    earrings: {
      best: ["Long drops", "Linear dangles", "Tassel earrings", "Elongated hoops"],
      tip: "Choose earrings that hang below the jaw to visually lengthen the face.",
    },
    contour: {
      contour: "Along the sides of the face from temples to jaw and under cheekbones",
      highlight: "Vertical strip down centre of forehead, nose bridge, and chin",
      blush: "Diagonal sweep from cheek apples upward toward temples — avoid circular placement",
    },
    bindi: {
      shape: "Elongated teardrop or vertical oval",
      placement: "Centre of forehead, slightly higher than usual. Smaller to medium size preferred",
    },
  },
  Square: {
    glasses: {
      best: ["Round frames", "Oval frames", "Cat-eye", "Rimless styles"],
      avoid: "Square and angular frames — they amplify the strong jawline",
    },
    earrings: {
      best: ["Hoops", "Oval drops", "Chandbali", "Teardrop earrings"],
      tip: "Curved and rounded earring silhouettes soften angular jaw angles beautifully.",
    },
    contour: {
      contour: "Under the jawline corners and along sides of face to soften angles",
      highlight: "Centre of forehead, nose bridge, and centre of chin",
      blush: "Diagonal sweep upward toward temples — creates visual softness",
    },
    bindi: {
      shape: "Round or floral — soft shapes only",
      placement: "Centre of forehead, medium size. Avoid geometric or angular bindi shapes",
    },
  },
  Heart: {
    glasses: {
      best: ["Aviators", "Light rimless", "Round frames", "Bottom-heavy styles"],
      avoid: "Cat-eye and top-heavy frames — they add unwanted width to the forehead",
    },
    earrings: {
      best: ["Chandbali", "Wide teardrop drops", "Shoulder dusters", "Fan-shaped earrings"],
      tip: "Earrings wider at the bottom balance the pointed chin and draw the eye down.",
    },
    contour: {
      contour: "Along the forehead hairline at temples to minimise width",
      highlight: "Chin centre and jaw area; nose bridge",
      blush: "Low on the cheeks near the jaw, blended outward — not high on cheekbones",
    },
    bindi: {
      shape: "Small to medium round or dot bindi",
      placement: "Centre of forehead, slightly lower than usual. Avoid large bindis that widen forehead",
    },
  },
  Long: {
    glasses: {
      best: ["Oversized frames", "Wide rectangle", "Aviators", "Deep frames"],
      avoid: "Small and narrow frames — they elongate the face further",
    },
    earrings: {
      best: ["Wide hoops", "Cluster studs", "Horizontal bar drops", "Button earrings"],
      tip: "Width-adding earrings shorten the face visually. Avoid long vertical drops.",
    },
    contour: {
      contour: "Along the forehead at hairline and the tip of the chin to shorten the face",
      highlight: "Cheekbones horizontally to add width to the mid-face",
      blush: "Sweep horizontally across cheeks from nose outward — avoid upward diagonal",
    },
    bindi: {
      shape: "Wide horizontal oval or large round bindi",
      placement: "Centre of forehead. Wider shapes add horizontal width and balance face length",
    },
  },
  Diamond: {
    glasses: {
      best: ["Cat-eye", "Oval frames", "Rimless brow-line", "Curved styles"],
      avoid: "Narrow rectangles — they emphasise the narrow forehead and chin",
    },
    earrings: {
      best: ["Chandelier earrings", "Studs", "Small hoops", "Teardrop drops"],
      tip: "Avoid earrings widest at the mid-point — frame the face rather than widen cheekbones.",
    },
    contour: {
      contour: "Lightly along cheekbones to soften their prominence",
      highlight: "Centre of forehead and chin to add width at the narrower points",
      blush: "On the apples of the cheeks, blended softly",
    },
    bindi: {
      shape: "Round or small floral bindi",
      placement: "Centre of forehead between brows. Draws attention to the centre, balancing proportions",
    },
  },
  Rectangle: {
    glasses: {
      best: ["Round frames", "Oval frames", "Oversized styles", "Deep cat-eye"],
      avoid: "Narrow rectangle frames — they mirror the face shape",
    },
    earrings: {
      best: ["Hoops", "Curved drops", "Chandbali", "Round cluster earrings"],
      tip: "Rounded earring shapes add visual curves that contrast the angular face structure.",
    },
    contour: {
      contour: "Sides of the forehead at temples and corners of the jaw to reduce length",
      highlight: "Cheekbones horizontally; nose bridge",
      blush: "Diagonal sweep across cheeks — creates width at the centre of the face",
    },
    bindi: {
      shape: "Round or oval bindi, medium size",
      placement: "Centre of forehead between brows. Adds a focal point and softens elongated proportions",
    },
  },
  Triangle: {
    glasses: {
      best: ["Cat-eye frames", "Wide top-heavy styles", "Semi-rimless with decorative top"],
      avoid: "Bottom-heavy frames that emphasise the wide jaw",
    },
    earrings: {
      best: ["Chandelier drops", "Wide fan shapes", "Statement studs", "Cluster earrings with top detail"],
      tip: "Earrings with volume at the top draw the eye upward and balance the wider jaw.",
    },
    contour: {
      contour: "Along the sides of the jaw to reduce visual width",
      highlight: "Centre of forehead and temples to widen the upper face",
      blush: "High on cheekbones, swept upward — draws attention above the jaw",
    },
    bindi: {
      shape: "Elongated teardrop or vertical oval",
      placement: "Centre of forehead, slightly higher. Adds visual width to the upper face",
    },
  },
  "Inverted Triangle": {
    glasses: {
      best: ["Round frames", "Aviators", "Bottom-rimmed styles", "Oval frames"],
      avoid: "Cat-eye and top-heavy frames — they widen the forehead further",
    },
    earrings: {
      best: ["Teardrop drops", "Wide chandbali", "Fan drops wider at base", "Shoulder dusters"],
      tip: "Earrings wider at the bottom add visual weight to the narrow jaw and chin.",
    },
    contour: {
      contour: "Lightly along the sides of the forehead to narrow the upper face",
      highlight: "Jaw and chin area to add presence at the lower face",
      blush: "Low on the cheeks near the jaw — adds fullness to the lower face",
    },
    bindi: {
      shape: "Small round or dot bindi",
      placement: "Centre of forehead. Keep small to avoid widening the forehead further",
    },
  },
};

// ── SVG face silhouettes ─────────────────────────────────────────────────────

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

function readFaceShape(): string | null {
  const stored = localStorage.getItem("mellow_face_shape");
  if (stored) return stored;
  try {
    const a = JSON.parse(localStorage.getItem("mellow_analysis") ?? "{}");
    return a?.hair?.faceShape ?? null;
  } catch { return null; }
}

export default function FacePage() {
  const router = useRouter();
  const [faceShape] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readFaceShape()
  );
  const [confidence] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("mellow_face_shape_confidence")
  );
  const [isMale] = useState<boolean>(() =>
    typeof window !== "undefined" && localStorage.getItem("mellow_gender") === "male"
  );
  const [feedback, setFeedback] = useState<"accurate" | "inaccurate" | null>(() => {
    if (typeof window === "undefined") return null;
    const fb = localStorage.getItem("mellow_face_shape_feedback");
    return fb === "accurate" || fb === "inaccurate" ? fb : null;
  });

  useEffect(() => {
    if (!faceShape) router.replace("/face-scan");
  }, [faceShape, router]);

  const submitFeedback = (value: "accurate" | "inaccurate") => {
    localStorage.setItem("mellow_face_shape_feedback", value);
    setFeedback(value);
  };

  const detected = FACE_SHAPES.find(s => faceShape && s.name.toLowerCase() === faceShape.toLowerCase())
    ?? (faceShape ? { name: faceShape, traits: [], tip: "" } : null);

  const extras = faceShape ? FACE_SHAPE_EXTRAS[faceShape] ?? FACE_SHAPE_EXTRAS[
    Object.keys(FACE_SHAPE_EXTRAS).find(k => k.toLowerCase() === faceShape.toLowerCase()) ?? ""
  ] ?? null : null;

  if (!faceShape) return null;

  const GRID_SHAPES = FACE_SHAPES.map(s => s.name);

  const confidenceColor =
    confidence === "High" ? "text-brown-mid" :
    confidence === "Low" ? "text-brown-light" :
    "text-brown-mid/60";

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid flex-1">Face Shape</p>
        <button
          onClick={() => router.push("/face-scan")}
          className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid/60 hover:text-brown-mid transition-colors"
        >
          Rescan
        </button>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-6">

        {/* Hero */}
        <motion.div {...fade(0)}>
          <div className="text-center mb-2">
            <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your face shape</p>
            <h1
              className="font-display text-5xl text-brown-dark"
              style={{ fontStyle: "italic", fontWeight: 300 }}
            >
              {detected?.name ?? "—"}
            </h1>
            {confidence && (
              <p className={`font-sans text-[0.58rem] tracking-[0.2em] uppercase mt-2 ${confidenceColor}`}>
                {confidence} confidence
              </p>
            )}
          </div>
        </motion.div>

        {/* Detected shape card */}
        {detected && (
          <motion.div {...fade(0.05)}>
            <Card>
              <div className="flex gap-5 items-start">
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
          </motion.div>
        )}

        {/* Accuracy feedback */}
        {faceShape && (
          <motion.div {...fade(0.08)}>
            {feedback ? (
              <p className="font-sans text-[0.62rem] text-brown-mid/50 text-center tracking-widest">
                {feedback === "accurate" ? "Thanks — result confirmed ✓" : "Thanks for the feedback — try rescanning for better accuracy"}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <p className="font-sans text-[0.62rem] text-brown-mid/60 tracking-widest">Was this correct?</p>
                <button
                  onClick={() => submitFeedback("accurate")}
                  className="px-4 py-1.5 rounded-lg border border-brown-light/30 font-sans text-[0.62rem] tracking-widest text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors"
                >
                  Yes ✓
                </button>
                <button
                  onClick={() => submitFeedback("inaccurate")}
                  className="px-4 py-1.5 rounded-lg border border-brown-light/30 font-sans text-[0.62rem] tracking-widest text-brown-mid hover:border-brown-mid hover:text-brown-dark transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* All shapes grid */}
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

        {/* Shape guide list */}
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

        {/* ── NEW SECTIONS ── */}

        {extras && (
          <>
            {/* Glasses frames */}
            <motion.div {...fade(0.22)}>
              <Card>
                <SectionLabel>Glasses frames</SectionLabel>
                <div className="space-y-4">
                  <div>
                    <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/60 mb-2">Best for you</p>
                    <div className="flex flex-wrap gap-2">
                      {extras.glasses.best.map((frame) => (
                        <span
                          key={frame}
                          className="px-3 py-1 rounded-full bg-brown-light/15 font-sans text-xs text-brown-dark"
                        >
                          {frame}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-brown-light/15">
                    <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/60 mb-1.5">Avoid</p>
                    <p className="font-sans text-xs text-brown-mid/70 leading-snug">{extras.glasses.avoid}</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Earring guide */}
            <motion.div {...fade(0.26)}>
              <Card>
                <SectionLabel>Earring guide</SectionLabel>
                <div className="space-y-4">
                  <div>
                    <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/60 mb-2">Flattering styles</p>
                    <div className="flex flex-wrap gap-2">
                      {extras.earrings.best.map((style) => (
                        <span
                          key={style}
                          className="px-3 py-1 rounded-full bg-brown-light/15 font-sans text-xs text-brown-dark"
                        >
                          {style}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="font-sans text-xs text-brown-dark/70 leading-relaxed border-t border-brown-light/15 pt-3">
                    {extras.earrings.tip}
                  </p>
                </div>
              </Card>
            </motion.div>

            {/* Contour & blush */}
            <motion.div {...fade(0.30)}>
              <Card>
                <SectionLabel>Contour & blush</SectionLabel>
                <div className="space-y-3.5">
                  {[
                    { label: "Contour", value: extras.contour.contour },
                    { label: "Highlight", value: extras.contour.highlight },
                    { label: "Blush", value: extras.contour.blush },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3">
                      <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/50 w-16 flex-shrink-0 pt-0.5">{label}</p>
                      <p className="font-sans text-xs text-brown-dark/75 leading-snug flex-1">{value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Bindi guide — hidden for male users */}
            {!isMale && (
              <motion.div {...fade(0.34)}>
                <Card>
                  <div className="flex items-start justify-between mb-3">
                    <SectionLabel>Bindi guide</SectionLabel>
                    <span className="font-sans text-[0.52rem] tracking-widest uppercase text-brown-light bg-brown-light/10 rounded-full px-2 py-0.5 -mt-0.5">
                      Indian style
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/50 w-16 flex-shrink-0 pt-0.5">Shape</p>
                      <p className="font-sans text-xs text-brown-dark/75 leading-snug flex-1">{extras.bindi.shape}</p>
                    </div>
                    <div className="flex gap-3">
                      <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/50 w-16 flex-shrink-0 pt-0.5">Placement</p>
                      <p className="font-sans text-xs text-brown-dark/75 leading-snug flex-1">{extras.bindi.placement}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </>
        )}

        {/* CTA: Skin Analysis */}
        <motion.div {...fade(extras ? 0.38 : 0.25)}>
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
        <motion.div {...fade(extras ? 0.42 : 0.30)}>
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
