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

function ColorDots({ hexes }: { hexes: string[] }) {
  return (
    <div className="flex gap-2 mt-3">
      {hexes.map((hex, i) => (
        <div key={`cd-${i}`} className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full border border-brown-light/30" style={{ backgroundColor: hex }} />
          <p className="font-sans text-[0.5rem] text-brown-light">{hex}</p>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 font-sans text-xs text-brown-dark leading-snug">
          <span className="text-brown-light flex-shrink-0 mt-0.5">—</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

export default function AccessoriesPage() {
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
  const acc = analysis.accessories;

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
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">Accessories</p>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="text-center">
          <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Styled for</p>
          <h1 className="font-display text-5xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            {analysis.season}
          </h1>
          {acc?.tip && (
            <p className="font-sans text-sm text-brown-mid mt-3 leading-relaxed max-w-sm mx-auto">{acc.tip}</p>
          )}
        </motion.div>

        {/* Handbag */}
        {acc?.handbag && (
          <motion.div {...fade(0.08)}>
            <Card>
              <SectionLabel>Handbag shapes</SectionLabel>
              <BulletList items={acc.handbag.shapes} />
              {acc.handbag.colors.length > 0 && (
                <>
                  <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mt-4 mb-1">Accent colours</p>
                  <ColorDots hexes={acc.handbag.colors} />
                </>
              )}
            </Card>
          </motion.div>
        )}

        {/* Sunglasses */}
        {acc?.sunglasses && acc.sunglasses.length > 0 && (
          <motion.div {...fade(0.14)}>
            <Card>
              <SectionLabel>Sunglasses frames</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {acc.sunglasses.map((frame, i) => (
                  <span
                    key={`sg-${i}`}
                    className="px-3 py-1.5 bg-brown-light/10 border border-brown-light/25 rounded-full font-sans text-xs text-brown-dark"
                  >
                    {frame}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Belt */}
        {acc?.belt && (
          <motion.div {...fade(0.20)}>
            <Card>
              <SectionLabel>Belts</SectionLabel>
              <BulletList items={acc.belt.styles} />
              {acc.belt.tip && (
                <p className="font-sans text-[0.65rem] text-brown-mid/70 mt-3 leading-snug">{acc.belt.tip}</p>
              )}
            </Card>
          </motion.div>
        )}

        {/* Scarf / Dupatta */}
        {acc?.scarf && (
          <motion.div {...fade(0.26)}>
            <Card>
              <SectionLabel>Scarf &amp; dupatta</SectionLabel>
              <BulletList items={acc.scarf.styles} />
              {acc.scarf.colors.length > 0 && (
                <>
                  <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mt-4 mb-1">Colour direction</p>
                  <ColorDots hexes={acc.scarf.colors} />
                </>
              )}
            </Card>
          </motion.div>
        )}

        {/* Shoes */}
        {acc?.shoes && (
          <motion.div {...fade(0.32)}>
            <Card>
              <SectionLabel>Footwear</SectionLabel>
              <BulletList items={acc.shoes.heelTypes} />
              {acc.shoes.colors.length > 0 && (
                <>
                  <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mt-4 mb-1">Shoe colours</p>
                  <ColorDots hexes={acc.shoes.colors} />
                </>
              )}
            </Card>
          </motion.div>
        )}

        {!acc && (
          <motion.div {...fade(0.08)}>
            <Card>
              <p className="font-sans text-xs text-brown-mid/70 text-center leading-relaxed">
                Re-upload your photo to unlock personalised accessory recommendations.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Hub CTA */}
        <motion.div {...fade(0.38)}>
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
