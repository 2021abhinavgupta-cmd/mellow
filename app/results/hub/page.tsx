"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Lock, RefreshCw } from "lucide-react";
import type { ColorAnalysis } from "@/app/lib/types";

interface Module {
  key: string;
  title: string;
  subtitle: string;
  path: string;
  done: boolean;
  locked?: boolean;
  lockedMsg?: string;
  genderOnly?: "male" | "female";
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: "easeOut" } as import("framer-motion").Transition,
});

function buildModules(analysis: ColorAnalysis | null, isMale: boolean): Module[] {
  const hasAnalysis = !!analysis;
  const faceShapeStored = localStorage.getItem("mellow_face_shape");
  const hasFaceShape = !!(faceShapeStored || analysis?.hair?.faceShape);
  const faceConf = localStorage.getItem("mellow_face_shape_confidence");
  const skinRaw = localStorage.getItem("mellow_skin_analysis");
  const hasSkin = !!(() => { try { return skinRaw && JSON.parse(skinRaw)?.skinType; } catch { return false; } })();
  const bodyType = localStorage.getItem("mellow_body_type");
  const hasBody = !!bodyType;

  return [
    {
      key: "colour",
      title: "Colour Analysis",
      subtitle: analysis ? `${analysis.season} · ${analysis.undertone}` : "Season & palette",
      path: "/results",
      done: hasAnalysis,
    },
    {
      key: "makeup",
      title: isMale ? "Grooming Guide" : "Makeup Guide",
      subtitle: isMale ? "Beard, skincare & fragrance" : "Eyeshadow, lips, blush & contour",
      path: isMale ? "/results/grooming" : "/results/makeup",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "hair",
      title: "Hair Styles",
      subtitle: hasFaceShape
        ? `Face shape: ${faceShapeStored ?? analysis?.hair?.faceShape ?? "detected"}`
        : "Flattering cuts for your face",
      path: "/results/hair",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "style",
      title: "Style Guide",
      subtitle: hasBody ? `Body shape: ${bodyType}` : "Outfit formula & flattering styles",
      path: "/results/style",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "occasions",
      title: "Indian Occasions",
      subtitle: "Festival, wedding & daily Indian wear",
      path: "/results/occasions",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "nails",
      title: "Nail Colours",
      subtitle: "Season-matched polish picks",
      path: "/results/nails",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "fragrance",
      title: "Fragrance Guide",
      subtitle: "Scent families & Indian attars",
      path: "/results/fragrance",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "accessories",
      title: "Accessories",
      subtitle: "Bags, belts, shoes & dupattas",
      path: "/results/accessories",
      done: hasAnalysis,
      locked: !hasAnalysis,
      lockedMsg: "Complete colour analysis first",
    },
    {
      key: "face",
      title: "Face Shape",
      subtitle: hasFaceShape
        ? `${faceShapeStored ?? analysis?.hair?.faceShape ?? "Detected"}${faceConf === "Low" ? " · Low confidence" : ""}`
        : "Scan for precise detection",
      path: hasFaceShape ? "/results/face" : "/",
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
      subtitle: hasBody ? (bodyType ?? "Measured") : "Measurements or camera scan",
      path: hasBody ? "/results/style" : "/body-scan",
      done: hasBody,
    },
  ];
}

interface HubInit {
  photo: string | null;
  gender: string;
  season: string | null;
  undertone: string | null;
  modules: Module[];
  skinDone: boolean;
}

function initHub(): HubInit {
  if (typeof window === "undefined") {
    return { photo: null, gender: "female", season: null, undertone: null, modules: [], skinDone: false };
  }
  const photo = localStorage.getItem("mellow_image");
  const g = localStorage.getItem("mellow_gender") ?? "female";
  let analysis: ColorAnalysis | null = null;
  try {
    const raw = localStorage.getItem("mellow_analysis");
    if (raw) analysis = JSON.parse(raw) as ColorAnalysis;
  } catch { /* ignore */ }
  let skinDone = false;
  try {
    const skinRaw = localStorage.getItem("mellow_skin_analysis");
    skinDone = !!(skinRaw && JSON.parse(skinRaw)?.skinType);
  } catch { /* ignore */ }
  return {
    photo,
    gender: g,
    season: analysis?.season ?? null,
    undertone: analysis?.undertone ?? null,
    modules: buildModules(analysis, g === "male"),
    skinDone,
  };
}

export default function HubPage() {
  const router = useRouter();
  const [{ photo, gender, season, undertone, modules, skinDone }] = useState(initHub);
  const [prevDone, setPrevDone] = useState<Record<string, boolean>>({});
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) { router.replace("/"); return; }
    const doneMap = Object.fromEntries(modules.map(m => [m.key, m.done]));
    setPrevDone(prev => {
      const newlyDone = modules.find(m => m.done && !prev[m.key]);
      if (newlyDone) setJustUnlocked(newlyDone.key);
      return doneMap;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!photo) return null;

  const visibleModules = modules.filter(m => !m.genderOnly || m.genderOnly === gender);
  const doneCount = visibleModules.filter(m => m.done).length;
  const totalCount = visibleModules.length;

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
              {doneCount} of {totalCount} complete
            </p>
            <p className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid/50">
              {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
            </p>
          </div>
          <div className="h-0.5 bg-brown-light/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brown-mid rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Rescan prompt — show when skin scan missing */}
        {!skinDone && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <button
                onClick={() => router.push("/skin-scan")}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-brown-dark/5 border border-brown-light/25 rounded-xl hover:border-brown-mid/40 transition-colors group"
              >
                <RefreshCw className="w-4 h-4 text-brown-mid flex-shrink-0" strokeWidth={1.5} />
                <div className="text-left flex-1">
                  <p className="font-sans text-xs font-medium text-brown-dark">Complete your skin scan</p>
                  <p className="font-sans text-[0.6rem] text-brown-mid/60">Takes 4 seconds — close-up camera</p>
                </div>
                <ArrowRight className="w-4 h-4 text-brown-light group-hover:text-brown-mid transition-colors flex-shrink-0" strokeWidth={1.5} />
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Module cards */}
        <div className="space-y-3">
          {visibleModules.map((mod, i) => {
            const isJustUnlocked = justUnlocked === mod.key;
            return (
              <motion.div
                key={mod.key}
                {...fade(0.1 + i * 0.04)}
              >
                <motion.div
                  animate={isJustUnlocked ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
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
                    <motion.div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        mod.locked
                          ? "bg-brown-light/20"
                          : mod.done
                          ? "bg-brown-dark"
                          : "border-2 border-brown-light/40"
                      }`}
                      animate={isJustUnlocked && mod.done ? { backgroundColor: ["#C9A882", "#4A3728"] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {mod.locked ? (
                        <Lock className="w-3.5 h-3.5 text-brown-mid/40" strokeWidth={1.5} />
                      ) : mod.done ? (
                        <Check className="w-3.5 h-3.5 text-cream" strokeWidth={2} />
                      ) : null}
                    </motion.div>

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
              </motion.div>
            );
          })}
        </div>

        {/* Start over */}
        <motion.div {...fade(0.1 + visibleModules.length * 0.04 + 0.05)}>
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
