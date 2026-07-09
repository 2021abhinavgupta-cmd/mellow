"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Lock } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";

interface Module {
  key: string;
  title: string;
  subtitle: string;
  path: string;
  done: boolean;
  locked?: boolean;
  lockedMsg?: string;
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: "easeOut" } as import("framer-motion").Transition,
});

export default function HubPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [undertone, setUndertone] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    const img = localStorage.getItem("mellow_image");
    if (!img) { router.replace("/"); return; }
    setPhoto(img);

    const analysisRaw = localStorage.getItem("mellow_analysis");
    const analysis: ColorAnalysis | null = analysisRaw ? JSON.parse(analysisRaw) : null;
    const hasAnalysis = !!analysis;

    if (analysis) {
      setSeason(analysis.season);
      setUndertone(analysis.undertone);
    }

    const hasFaceShape = !!(
      localStorage.getItem("mellow_face_shape") ||
      analysis?.hair?.faceShape
    );
    const hasSkin = !!localStorage.getItem("mellow_skin_analysis");
    const hasBody = !!localStorage.getItem("mellow_body_type");

    setModules([
      {
        key: "colour",
        title: "Colour Analysis",
        subtitle: analysis ? `${analysis.season} · ${analysis.undertone}` : "Season & palette",
        path: "/results",
        done: hasAnalysis,
      },
      {
        key: "makeup",
        title: "Makeup Guide",
        subtitle: "Eyeshadow, lips, blush & contour",
        path: "/results/makeup",
        done: hasAnalysis,
        locked: !hasAnalysis,
        lockedMsg: "Complete colour analysis first",
      },
      {
        key: "hair",
        title: "Hair Styles",
        subtitle: hasFaceShape
          ? `Face shape: ${localStorage.getItem("mellow_face_shape") ?? analysis?.hair?.faceShape ?? "detected"}`
          : "Flattering cuts for your face",
        path: "/results/hair",
        done: hasAnalysis,
        locked: !hasAnalysis,
        lockedMsg: "Complete colour analysis first",
      },
      {
        key: "style",
        title: "Style Guide",
        subtitle: hasBody
          ? `Body shape: ${localStorage.getItem("mellow_body_type")}`
          : "Outfit formula & flattering styles",
        path: "/results/style",
        done: hasAnalysis,
        locked: !hasAnalysis,
        lockedMsg: "Complete colour analysis first",
      },
      {
        key: "face",
        title: "Face Shape",
        subtitle: hasFaceShape
          ? (localStorage.getItem("mellow_face_shape") ?? analysis?.hair?.faceShape ?? "Detected")
          : "Scan for precise detection",
        path: hasFaceShape ? "/results/face" : "/face-scan",
        done: hasFaceShape,
      },
      {
        key: "skin",
        title: "Skin Analysis",
        subtitle: hasSkin ? "Routine, concerns & ingredients" : "Close-up skin scan",
        path: hasSkin ? "/results/skin" : "/skin-scan",
        done: hasSkin,
      },
      {
        key: "body",
        title: "Body Shape",
        subtitle: hasBody
          ? (localStorage.getItem("mellow_body_type") ?? "Measured")
          : "Measurements or camera scan",
        path: hasBody ? "/results/style" : "/body-scan",
        done: hasBody,
      },
    ]);
  }, [router]);

  if (!photo) return null;

  const doneCount = modules.filter(m => m.done).length;

  return (
    <div className="min-h-screen bg-cream pb-16">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur border-b border-brown-light/20 px-5 py-3 flex items-center justify-between">
        <span className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
          mellow
        </span>
        <button
          onClick={() => router.push("/")}
          className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid/60 hover:text-brown-mid transition-colors"
        >
          New Photo
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 space-y-5">

        {/* Hero */}
        <motion.div {...fade(0)} className="flex gap-4 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            className="w-16 h-16 rounded-2xl object-cover border border-brown-light/40 flex-shrink-0"
          />
          <div>
            {season ? (
              <>
                <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-0.5">
                  Your colour season
                </p>
                <h1 className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  {season}
                </h1>
                {undertone && (
                  <p className="font-sans text-[0.6rem] tracking-widest uppercase text-brown-mid/60 mt-0.5">
                    {undertone} undertone
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-0.5">
                  Your analysis
                </p>
                <h1 className="font-display text-3xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                  Dashboard
                </h1>
              </>
            )}
          </div>
        </motion.div>

        {/* Progress */}
        <motion.div {...fade(0.06)}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid">
              {doneCount} of {modules.length} complete
            </p>
            <p className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid/50">
              {Math.round((doneCount / modules.length) * 100)}%
            </p>
          </div>
          <div className="h-0.5 bg-brown-light/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brown-mid rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(doneCount / modules.length) * 100}%` }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Module cards */}
        <div className="space-y-3">
          {modules.map((mod, i) => (
            <motion.div key={mod.key} {...fade(0.1 + i * 0.05)}>
              <button
                onClick={() => !mod.locked && router.push(mod.path)}
                disabled={mod.locked}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-colors text-left group ${
                  mod.locked
                    ? "bg-brown-light/5 border-brown-light/15 opacity-50 cursor-not-allowed"
                    : mod.done
                    ? "bg-white/55 border-brown-light/25 hover:border-brown-mid/40"
                    : "bg-white/30 border-dashed border-brown-light/40 hover:border-brown-mid/40 hover:bg-white/45"
                }`}
              >
                {/* Status indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    mod.locked
                      ? "bg-brown-light/20"
                      : mod.done
                      ? "bg-brown-dark"
                      : "border-2 border-brown-light/40"
                  }`}
                >
                  {mod.locked ? (
                    <Lock className="w-3.5 h-3.5 text-brown-mid/40" strokeWidth={1.5} />
                  ) : mod.done ? (
                    <Check className="w-3.5 h-3.5 text-cream" strokeWidth={2} />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-sans text-sm font-medium leading-tight ${mod.done ? "text-brown-dark" : "text-brown-mid"}`}>
                    {mod.title}
                  </p>
                  <p className="font-sans text-[0.62rem] text-brown-mid/60 mt-0.5 truncate">
                    {mod.locked ? mod.lockedMsg : mod.subtitle}
                  </p>
                </div>

                {!mod.locked && (
                  <ArrowRight
                    className="w-4 h-4 text-brown-light group-hover:text-brown-mid group-hover:translate-x-0.5 transition-all flex-shrink-0"
                    strokeWidth={1.5}
                  />
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Start over */}
        <motion.div {...fade(0.1 + modules.length * 0.05 + 0.05)}>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 font-sans text-xs tracking-widest uppercase text-brown-mid/40 hover:text-brown-mid transition-colors"
          >
            Upload New Photo
          </button>
        </motion.div>
      </div>
    </div>
  );
}
