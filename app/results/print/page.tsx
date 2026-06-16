"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, CheckCircle2, XCircle, Scissors, Sparkles } from "lucide-react";
import type { ColorAnalysis, NamedSwatch } from "@/app/lib/types";

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid mb-3">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white/55 border border-brown-light/25 rounded-2xl p-5 ${className}`}>{children}</div>;
}

function Dot({ hex, size = "w-8 h-8" }: { hex: string; size?: string }) {
  return <div className={`${size} rounded-full border border-black/10 flex-shrink-0`} style={{ backgroundColor: hex }} />;
}

function LipSwatch({ name, hex }: NamedSwatch) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-6 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
      <span className="font-sans text-[0.5rem] text-brown-mid text-center leading-tight max-w-[48px]">{name}</span>
    </div>
  );
}

function NamedDot({ name, hex }: NamedSwatch) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-9 h-9 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
      <span className="font-sans text-[0.5rem] text-brown-mid text-center leading-tight max-w-[40px]">{name}</span>
    </div>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-brown-light/30">
      <span className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>mellow</span>
      <span className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">{title}</span>
    </div>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
}

// ── Section 1: Colour Analysis ────────────────────────────────────────────────

function ColourSection({ photo, a }: { photo: string; a: ColorAnalysis }) {
  return (
    <section style={{ pageBreakAfter: "always" }} className="pb-8">
      <PageHeader title="Colour Analysis" />

      {/* Hero */}
      <div className="flex gap-5 items-start mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-24 h-24 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
        <div>
          <p className="font-sans text-[0.52rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Personal Colour Analysis</p>
          <h2 className="font-display text-5xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{a.season}</h2>
          <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid mt-1 mb-2">{(a.descriptors ?? []).join(" · ")}</p>
          <p className="font-sans text-xs text-brown-mid leading-relaxed max-w-md">{a.seasonDescription}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Best Colors + Undertone */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Best Colors</SectionLabel>
            <div className="space-y-1.5">
              {chunk(a.bestColors ?? [], 5).map((row, ri) => (
                <div key={ri} className="flex gap-1.5">{row.map((hex, ci) => <Dot key={`bc-${ri}-${ci}`} hex={hex} size="w-7 h-7" />)}</div>
              ))}
            </div>
            <p className="font-sans text-[0.62rem] text-brown-mid mt-3 leading-relaxed">{a.bestColorsNote}</p>
          </Card>
          <Card>
            <SectionLabel>Your Undertone</SectionLabel>
            <p className="font-sans text-sm font-medium tracking-[0.12em] uppercase text-brown-dark mb-2">{a.undertone}</p>
            <p className="font-sans text-[0.62rem] text-brown-mid leading-relaxed">{a.undertoneDescription}</p>
          </Card>
        </div>

        {/* Style Guide */}
        <Card>
          <SectionLabel>Style Guide</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: "♥", label: "Enhances", items: a.enhances },
              { icon: "✕", label: "Avoid", items: a.avoid },
              { icon: "✦", label: "Style Tips", items: a.styleTips },
            ].map(({ icon, label, items }) => (
              <div key={label}>
                <p className="font-sans text-[0.55rem] tracking-[0.18em] uppercase text-brown-dark font-medium mb-2 flex items-center gap-1">
                  <span className="text-brown-mid">{icon}</span> {label}
                </p>
                <ul className="space-y-1.5">
                  {(items ?? []).map((item) => (
                    <li key={item} className="font-sans text-[0.62rem] text-brown-mid leading-relaxed flex gap-1.5">
                      <span className="text-brown-light flex-shrink-0">•</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {/* Seasonal Palette + Neutrals */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Best Neutrals</SectionLabel>
            <div className="flex gap-2 mb-2">
              {(a.bestNeutrals ?? []).map((hex, i) => <Dot key={`bn-${i}`} hex={hex} size="w-8 h-8" />)}
            </div>
            <p className="font-sans text-[0.62rem] text-brown-mid leading-relaxed">Wardrobe base colours — layer accent tones on top.</p>
          </Card>
          <Card>
            <SectionLabel>Full Seasonal Palette</SectionLabel>
            <div className="space-y-1.5">
              {chunk(a.seasonalPalette ?? [], 8).map((row, ri) => (
                <div key={ri} className="flex gap-1 flex-wrap">
                  {row.map((hex, ci) => <div key={`sp-${ri}-${ci}`} className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: hex }} />)}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Traits */}
        <div className="text-center pt-1">
          <p className="font-sans text-[0.55rem] tracking-[0.28em] uppercase text-brown-mid mb-2">How Your Colouring Reads</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {(a.traits ?? []).map((trait) => (
              <span key={trait} className="font-sans text-[0.62rem] tracking-widest uppercase text-brown-mid border border-brown-light/50 rounded-full px-4 py-1.5">
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section 2: Makeup ─────────────────────────────────────────────────────────

function MakeupSection({ photo, a }: { photo: string; a: ColorAnalysis }) {
  const m = a.makeup;
  return (
    <section style={{ pageBreakAfter: "always" }} className="pb-8">
      <PageHeader title="Makeup Analysis" />

      {/* Hero */}
      <div className="flex gap-5 items-start mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-24 h-24 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
        <div>
          <p className="font-sans text-[0.52rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your Personal Makeup Palette</p>
          <h2 className="font-display text-5xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{a.season}</h2>
          <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid mt-1 mb-2">{(a.descriptors ?? []).join(" · ")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Eyeshadows */}
        <Card>
          <SectionLabel>Eyeshadows</SectionLabel>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="font-sans text-[0.52rem] tracking-[0.18em] uppercase text-brown-mid mb-2">Matte Shades</p>
              <div className="flex gap-2.5 flex-wrap">
                {(m?.eyeshadow?.matte ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
              </div>
            </div>
            <div>
              <p className="font-sans text-[0.52rem] tracking-[0.18em] uppercase text-brown-mid mb-2">Shimmer Shades</p>
              <div className="flex gap-2.5 flex-wrap">
                {(m?.eyeshadow?.shimmer ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
              </div>
            </div>
          </div>
          {m?.eyeshadow?.tip && (
            <p className="font-sans text-[0.62rem] text-brown-mid mt-3 pt-3 border-t border-brown-light/20 leading-relaxed">{m.eyeshadow.tip}</p>
          )}
        </Card>

        {/* Lipstick */}
        <Card>
          <SectionLabel>Lipstick Colors</SectionLabel>
          <div className="space-y-3">
            {([
              { label: "Nudes", items: m?.lipstick?.nudes },
              { label: "Pinks & Roses", items: m?.lipstick?.pinksAndRoses },
              { label: "Corals & Browns", items: m?.lipstick?.coralsAndBrowns },
            ] as { label: string; items: NamedSwatch[] | undefined }[]).map(({ label, items }) => (
              <div key={label}>
                <p className="font-sans text-[0.52rem] tracking-[0.18em] uppercase text-brown-mid mb-2">{label}</p>
                <div className="flex gap-3 flex-wrap">
                  {(items ?? []).map((s) => <LipSwatch key={s.name} {...s} />)}
                </div>
              </div>
            ))}
          </div>
          {m?.lipstick?.tip && (
            <p className="font-sans text-[0.62rem] text-brown-mid mt-3 pt-3 border-t border-brown-light/20 leading-relaxed">{m.lipstick.tip}</p>
          )}
        </Card>

        {/* Blush + Highlight/Contour */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Blush Shades</SectionLabel>
            <div className="flex gap-2.5 flex-wrap mb-3">
              {(m?.blush?.shades ?? []).map((s) => <NamedDot key={s.name} {...s} />)}
            </div>
            {m?.blush?.tip && <p className="font-sans text-[0.62rem] text-brown-mid pt-3 border-t border-brown-light/20 leading-relaxed">{m.blush.tip}</p>}
          </Card>
          <Card>
            <SectionLabel>Highlight & Contour</SectionLabel>
            <div className="flex gap-5 mb-2">
              <div>
                <p className="font-sans text-[0.5rem] tracking-[0.12em] uppercase text-brown-mid mb-1.5">Highlight</p>
                <div className="flex gap-1.5">{(m?.highlightAndContour?.highlight ?? []).map((hex, i) => <Dot key={`hl-${i}`} hex={hex} size="w-7 h-7" />)}</div>
              </div>
              <div>
                <p className="font-sans text-[0.5rem] tracking-[0.12em] uppercase text-brown-mid mb-1.5">Contour</p>
                <div className="flex gap-1.5">{(m?.highlightAndContour?.contour ?? []).map((hex, i) => <Dot key={`ct-${i}`} hex={hex} size="w-7 h-7" />)}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Complete Look + Skin Tips */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Complete Look Example</SectionLabel>
            <div className="space-y-2">
              {[
                { emoji: "👁", label: "Eyes", val: a.completeLook?.eyes },
                { emoji: "💋", label: "Lips", val: a.completeLook?.lips },
                { emoji: "🌸", label: "Blush", val: a.completeLook?.blush },
                { emoji: "✨", label: "Highlight", val: a.completeLook?.highlight },
              ].map(({ emoji, label, val }) => val && (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-sm">{emoji}</span>
                  <div>
                    <span className="font-sans text-[0.55rem] tracking-[0.12em] uppercase text-brown-mid">{label}: </span>
                    <span className="font-sans text-[0.62rem] text-brown-dark">{val}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel>Skin Tips</SectionLabel>
            <div className="space-y-2">
              {(a.skinTips ?? []).map((tip) => (
                <div key={tip.title}>
                  <p className="font-sans text-[0.62rem] font-medium text-brown-dark">{tip.title}</p>
                  <p className="font-sans text-[0.58rem] text-brown-mid leading-relaxed">{tip.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ── Section 3: Hair ───────────────────────────────────────────────────────────

function HairSection({ photo, a, hairImages }: { photo: string; a: ColorAnalysis; hairImages: Record<string, string | null> }) {
  const h = a.hair;
  if (!h) return null;
  return (
    <section style={{ pageBreakAfter: "always" }} className="pb-8">
      <PageHeader title="Hair Styles" />

      {/* Hero */}
      <div className="flex gap-5 items-start mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-24 h-24 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
        <div>
          <p className="font-sans text-[0.52rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Hairstyle Analysis</p>
          <h2 className="font-display text-5xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{h.faceShape}</h2>
          <p className="font-sans text-[0.55rem] tracking-[0.2em] uppercase text-brown-mid mt-1 mb-2">{h.observedHairType}</p>
          <p className="font-sans text-xs text-brown-mid leading-relaxed max-w-md">{h.faceShapeDescription}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Hairstyle images */}
        <Card>
          <SectionLabel>Most Flattering Hairstyles</SectionLabel>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(h.mostFlattering ?? []).slice(0, 3).map((style, i) => (
              <div key={`mf-${i}`} className="flex flex-col gap-1.5">
                <div className="rounded-xl overflow-hidden border border-brown-light/25" style={{ aspectRatio: "3/4" }}>
                  {hairImages[`mf-${i}`] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hairImages[`mf-${i}`]!} alt={style.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brown-light/10 flex items-center justify-center">
                      <Scissors className="w-5 h-5 text-brown-light" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <p className="font-sans text-[0.58rem] font-medium text-brown-dark text-center uppercase tracking-wide">{style.name}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-brown-light/20">
            {(h.mostFlattering ?? []).slice(0, 3).map((style, i) => (
              <div key={`desc-${i}`} className="flex items-start gap-2">
                <span className="font-display text-lg text-brown-light leading-none mt-0.5 flex-shrink-0" style={{ fontStyle: "italic" }}>{i + 1}</span>
                <div>
                  <p className="font-sans text-[0.62rem] font-medium text-brown-dark">{style.name}</p>
                  <p className="font-sans text-[0.58rem] text-brown-mid leading-relaxed">{style.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Other options + Bangs + Updos */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <SectionLabel>Other Options</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {(h.otherOptions ?? []).map((opt, i) => (
                <div key={`oo-${i}`} className="flex items-center gap-1.5">
                  <Scissors className="w-3 h-3 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-[0.62rem] text-brown-dark">{opt}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel>Bangs</SectionLabel>
            <ul className="space-y-1.5">
              {(h.bangs ?? []).map((b, i) => (
                <li key={`bg-${i}`} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-[0.62rem] text-brown-dark">{b}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>Updos</SectionLabel>
            <ul className="space-y-1.5">
              {(h.updos ?? []).map((u, i) => (
                <li key={`ud-${i}`} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-[0.62rem] text-brown-dark">{u}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Parting + Tips */}
        <Card>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <SectionLabel>Best Parting</SectionLabel>
              <p className="font-sans text-sm font-medium text-brown-dark">{h.bestParting}</p>
            </div>
            <div>
              <SectionLabel>Hair Tips</SectionLabel>
              <ul className="space-y-1.5">
                {(h.tips ?? []).map((tip, i) => (
                  <li key={`ht-${i}`} className="flex items-start gap-1.5">
                    <span className="text-brown-light flex-shrink-0">•</span>
                    <span className="font-sans text-[0.62rem] text-brown-mid leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* Goal */}
        <div className="text-center pt-1">
          <p className="font-sans text-[0.55rem] tracking-[0.28em] uppercase text-brown-mid mb-2">Your Hair Goal</p>
          <p className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>{h.goal}</p>
        </div>
      </div>
    </section>
  );
}

// ── Section 4: Style ──────────────────────────────────────────────────────────

const OCCASION_LABELS = {
  everyday: { label: "Everyday", subtitle: "Casual · Chic · Effortless" },
  office: { label: "Office", subtitle: "Polished · Professional · Sharp" },
  occasional: { label: "Occasions", subtitle: "Elevated · Graceful · Memorable" },
} as const;

type OccasionKey = keyof typeof OCCASION_LABELS;
const OCCASIONS: OccasionKey[] = ["everyday", "office", "occasional"];

function StyleSection({ photo, a, styleImages }: { photo: string; a: ColorAnalysis; styleImages: Record<string, string | null> }) {
  const s = a.style;
  if (!s) return null;
  return (
    <section className="pb-8">
      <PageHeader title="Style Guide" />

      {/* Hero */}
      <div className="flex gap-5 items-start mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-24 h-24 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0" />
        <div>
          <p className="font-sans text-[0.52rem] tracking-[0.3em] uppercase text-brown-mid mb-1">Your Style Guide</p>
          <h2 className="font-display text-5xl text-brown-dark leading-tight" style={{ fontStyle: "italic", fontWeight: 300 }}>{s.bodyType}</h2>
          <p className="font-sans text-xs text-brown-mid leading-relaxed max-w-md mt-2">{s.bodyTypeDescription}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Key Features + What Flatters */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Your Shape</SectionLabel>
            <ul className="space-y-1.5">
              {(s.keyFeatures ?? []).map((f, i) => (
                <li key={`kf-${i}`} className="flex items-start gap-1.5">
                  <span className="text-brown-light flex-shrink-0 mt-0.5">•</span>
                  <span className="font-sans text-[0.62rem] text-brown-dark leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionLabel>What Flatters You</SectionLabel>
            <ul className="space-y-1.5">
              {(s.whatFlattens ?? []).map((f, i) => (
                <li key={`wf-${i}`} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-brown-mid flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="font-sans text-[0.62rem] text-brown-dark leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* All 3 occasions side by side */}
        <Card>
          <SectionLabel>Outfit Categories</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            {OCCASIONS.map((key) => {
              const data = s[key];
              const img = styleImages[key];
              return (
                <div key={key}>
                  <p className="font-sans text-[0.58rem] tracking-[0.18em] uppercase text-brown-dark font-medium mb-2">{OCCASION_LABELS[key].label}</p>
                  {/* Image */}
                  <div className="rounded-xl overflow-hidden border border-brown-light/25 mb-2" style={{ aspectRatio: "3/4" }}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={OCCASION_LABELS[key].label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-brown-light/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-brown-light" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  {/* Styles */}
                  <ul className="space-y-1 mb-2">
                    {(data?.bestStyles ?? []).map((st, i) => (
                      <li key={`st-${key}-${i}`} className="font-sans text-[0.58rem] text-brown-mid leading-relaxed flex gap-1">
                        <span className="text-brown-light flex-shrink-0">•</span>{st}
                      </li>
                    ))}
                  </ul>
                  {/* Colors */}
                  <div className="flex gap-1 flex-wrap">
                    {(data?.bestColors ?? []).map((hex, i) => (
                      <div key={`oc-${key}-${i}`} className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Necklines + Prints */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Necklines That Flatter</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {(s.necklines ?? []).map((n, i) => (
                <span key={`nl-${i}`} className="font-sans text-[0.62rem] text-brown-mid border border-brown-light/40 rounded-full px-3 py-1">{n}</span>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel>Prints & Patterns</SectionLabel>
            <ul className="space-y-2">
              {(s.prints ?? []).map((p, i) => (
                <li key={`pr-${i}`}>
                  <p className="font-sans text-[0.62rem] font-medium text-brown-dark">{p.name}</p>
                  <p className="font-sans text-[0.58rem] text-brown-mid leading-relaxed">{p.tip}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Fabrics + Avoid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <SectionLabel>Fabrics That Flatter</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {(s.fabrics ?? []).map((f, i) => (
                <span key={`fb-${i}`} className="font-sans text-[0.62rem] text-brown-mid border border-brown-light/40 rounded-full px-3 py-1">{f}</span>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel>What to Avoid</SectionLabel>
            <ul className="space-y-1.5">
              {(s.avoid ?? []).map((av, i) => (
                <li key={`av-${i}`} className="flex items-start gap-1.5">
                  <XCircle className="w-3 h-3 text-brown-light flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="font-sans text-[0.62rem] text-brown-mid leading-snug">{av}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Outfit Formula */}
        <div className="border border-brown-light/40 rounded-2xl p-5 bg-brown-dark/[0.03]">
          <SectionLabel>Your Outfit Formula</SectionLabel>
          <p className="font-display text-2xl sm:text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>{s.outfitFormula}</p>
        </div>

        {/* Quick Tips */}
        <Card>
          <SectionLabel>Quick Style Tips</SectionLabel>
          <div className="grid grid-cols-3 gap-4">
            {(s.quickTips ?? []).map((tip, i) => (
              <div key={`qt-${i}`} className="flex items-start gap-2">
                <span className="font-display text-xl text-brown-light leading-none" style={{ fontStyle: "italic" }}>{i + 1}</span>
                <p className="font-sans text-[0.62rem] text-brown-mid leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center font-display text-xl text-brown-dark/40 pt-4" style={{ fontStyle: "italic", fontWeight: 300 }}>
          Dress for the person you are becoming.
        </p>
      </div>
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PrintAllPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ColorAnalysis | null>(null);
  const [hairImages, setHairImages] = useState<Record<string, string | null>>({});
  const [styleImages, setStyleImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const img = localStorage.getItem("mellow_image");
    const ana = localStorage.getItem("mellow_analysis");
    if (!img || !ana) { router.replace("/results"); return; }
    setPhoto(img);
    setAnalysis(JSON.parse(ana) as ColorAnalysis);

    try {
      const hi = sessionStorage.getItem("mellow_hair_images");
      if (hi) setHairImages(JSON.parse(hi) as Record<string, string | null>);
    } catch { /* ignore */ }

    try {
      const si = sessionStorage.getItem("mellow_style_images");
      if (si) setStyleImages(JSON.parse(si) as Record<string, string | null>);
    } catch { /* ignore */ }
  }, []);

  if (!analysis || !photo) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Controls — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-brown-light/30 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-brown-mid hover:text-brown-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-sans text-xs tracking-widest uppercase">Back</span>
        </button>
        <div className="text-center">
          <p className="font-sans text-[0.55rem] tracking-[0.25em] uppercase text-brown-mid">All 4 pages combined</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-brown-dark text-cream rounded-xl hover:bg-brown-mid transition-colors font-sans text-xs tracking-widest uppercase"
        >
          <Printer className="w-3.5 h-3.5" strokeWidth={1.5} />
          Save as PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        <ColourSection photo={photo} a={analysis} />
        <MakeupSection photo={photo} a={analysis} />
        <HairSection photo={photo} a={analysis} hairImages={hairImages} />
        <StyleSection photo={photo} a={analysis} styleImages={styleImages} />
      </div>
    </div>
  );
}
