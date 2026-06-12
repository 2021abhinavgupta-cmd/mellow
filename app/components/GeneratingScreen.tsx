"use client";

import { motion } from "framer-motion";

interface Props {
  photo: string;
  title: string;
  analysisLoaded: boolean;
  genDone: number;
  genTotal: number;
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
        done
          ? "bg-brown-dark"
          : active
          ? "border border-brown-mid bg-brown-light/20"
          : "border border-brown-light/40 bg-transparent"
      }`}>
        {done && (
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-cream" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {active && (
          <motion.div
            className="w-2 h-2 rounded-full bg-brown-mid"
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      <span className={`font-sans text-xs leading-snug transition-colors duration-300 ${
        done ? "text-brown-dark" : active ? "text-brown-mid" : "text-brown-light"
      }`}>
        {label}
      </span>
    </div>
  );
}

export function GeneratingScreen({ photo, title, analysisLoaded, genDone, genTotal }: Props) {
  const generating = analysisLoaded && genDone < genTotal;
  const allDone = analysisLoaded && (genTotal === 0 || genDone >= genTotal);
  const pct = genTotal > 0 ? Math.round((genDone / genTotal) * 100) : 0;

  const headline = !analysisLoaded
    ? "Loading your analysis…"
    : generating
    ? `Creating visual ${genDone + 1} of ${genTotal}…`
    : "Finalising…";

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8 px-6">
      {/* Photo */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-brown-light/40" />
        {!allDone && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-brown-mid"
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {allDone && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-brown-dark"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </div>

      {/* Title + status */}
      <div className="text-center">
        <p className="font-sans text-[0.55rem] tracking-[0.3em] uppercase text-brown-mid mb-2">{title}</p>
        <motion.p
          key={headline}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="font-display text-2xl text-brown-dark"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          {headline}
        </motion.p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3.5">
        <Step done={analysisLoaded} active={!analysisLoaded} label="Loading your analysis" />
        {genTotal > 0 && (
          <Step
            done={genDone >= genTotal && analysisLoaded}
            active={generating}
            label={`Generating personalised visuals (${genDone} / ${genTotal})`}
          />
        )}
      </div>

      {/* Progress bar */}
      {analysisLoaded && genTotal > 0 && (
        <div className="w-full max-w-xs">
          <div className="bg-brown-light/20 rounded-full h-1 overflow-hidden">
            <motion.div
              className="bg-brown-mid h-1 rounded-full origin-left"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
          <p className="font-sans text-[0.58rem] text-brown-mid/50 text-center mt-2">{pct}%</p>
        </div>
      )}
    </div>
  );
}
