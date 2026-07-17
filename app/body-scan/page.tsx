"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, Ruler } from "lucide-react";
import dynamic from "next/dynamic";
import {
  classifyFromMeasurements,
  BODY_SHAPE_DESCRIPTIONS,
  type BodyShape,
  type Measurements,
} from "@/app/lib/bodyShape";

const BodyScanner = dynamic(() => import("@/app/components/BodyScanner"), { ssr: false });

type Mode = "choose" | "measure" | "camera" | "result";

export default function BodyScanPage() {
  const router = useRouter();
  const [mode,      setMode]      = useState<Mode>("choose");
  const [unit,      setUnit]      = useState<"cm" | "in">("cm");
  const [bust,      setBust]      = useState("");
  const [waist,     setWaist]     = useState("");
  const [hip,       setHip]       = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    shape: BodyShape;
    confident: boolean;
    source: "measured" | "scanned";
  } | null>(null);

  const saveAndContinue = useCallback((shape: BodyShape) => {
    localStorage.setItem("mellow_body_type", shape);
    if (sessionStorage.getItem("mellow_from_checklist") === "1") {
      sessionStorage.removeItem("mellow_from_checklist");
      router.push("/");
    } else {
      router.push("/results");
    }
  }, [router]);

  const handleMeasureSubmit = () => {
    const b = parseFloat(bust);
    const w = parseFloat(waist);
    const h = parseFloat(hip);

    if (!b || !w || !h || b <= 0 || w <= 0 || h <= 0) {
      setFormError("Enter valid measurements for all three fields.");
      return;
    }

    // Sanity: minimum plausible values
    const minBust  = unit === "cm" ? 60 : 24;
    const minWaist = unit === "cm" ? 50 : 20;
    const minHip   = unit === "cm" ? 60 : 24;
    if (b < minBust || w < minWaist || h < minHip) {
      setFormError(`Values seem too small — check you are measuring in ${unit}.`);
      return;
    }

    setFormError(null);
    const m: Measurements = { bust: b, waist: w, hip: h, unit };
    localStorage.setItem("mellow_measurements", JSON.stringify(m));
    const shape = classifyFromMeasurements(m);
    setResult({ shape, confident: true, source: "measured" });
    setMode("result");
  };

  const handleScanCapture = useCallback((shape: BodyShape, confident: boolean) => {
    setResult({ shape, confident, source: "scanned" });
    setMode("result");
  }, []);

  if (mode === "camera") {
    return (
      <BodyScanner
        onCapture={handleScanCapture}
        onClose={() => setMode("choose")}
      />
    );
  }

  const goBack = () => {
    if (mode === "choose" || mode === "result") router.back();
    else setMode("choose");
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur border-b border-brown-light/20 px-5 py-3 flex items-center gap-3">
        <button
          onClick={goBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brown-light/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
        </button>
        <p className="font-sans text-[0.58rem] tracking-[0.28em] uppercase text-brown-mid">
          Body Analysis
        </p>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-8">
        <AnimatePresence mode="wait">

          {/* ── CHOOSE MODE ──────────────────────────────────────────────── */}
          {mode === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <div className="text-center mb-8">
                <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">
                  Step 2 of 2 · Body Analysis
                </p>
                <h1
                  className="font-display text-4xl text-brown-dark"
                  style={{ fontStyle: "italic", fontWeight: 300 }}
                >
                  Body Shape
                </h1>
                <p className="font-sans text-sm text-brown-mid leading-relaxed mt-3 max-w-xs mx-auto">
                  Get a precise body shape classification beyond what the AI can infer from your photo.
                </p>
              </div>

              <div className="space-y-4 flex-1">
                {/* Measure — primary */}
                <button
                  onClick={() => setMode("measure")}
                  className="w-full flex items-start gap-4 p-5 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-cream/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Ruler className="w-5 h-5 text-cream" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[0.58rem] tracking-widest uppercase text-cream/60 mb-0.5">
                      Most accurate
                    </p>
                    <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>
                      Enter Measurements
                    </p>
                    <p className="font-sans text-xs text-cream/60 mt-1 leading-relaxed">
                      Bust, waist & hip — takes under a minute
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-cream/60 group-hover:translate-x-1 transition-transform self-center flex-shrink-0"
                    strokeWidth={1.5}
                  />
                </button>

                {/* Camera — secondary */}
                <button
                  onClick={() => setMode("camera")}
                  className="w-full flex items-start gap-4 p-5 bg-white/55 border border-brown-light/25 rounded-2xl hover:border-brown-mid transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-brown-light/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Camera className="w-5 h-5 text-brown-mid" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid/60 mb-0.5">
                      Quick estimate
                    </p>
                    <p className="font-display text-xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                      Camera Scan
                    </p>
                    <p className="font-sans text-xs text-brown-mid/60 mt-1 leading-relaxed">
                      Stand in front of camera — AI estimates from proportions
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-brown-light group-hover:translate-x-1 transition-transform self-center flex-shrink-0"
                    strokeWidth={1.5}
                  />
                </button>

                <button
                  onClick={() => {
                    if (sessionStorage.getItem("mellow_from_checklist") === "1") {
                      localStorage.setItem("mellow_body_type", "AI Estimate");
                      sessionStorage.removeItem("mellow_from_checklist");
                      router.push("/");
                    } else {
                      router.push("/results");
                    }
                  }}
                  className="w-full py-3 font-sans text-xs tracking-widest uppercase text-brown-mid/50 hover:text-brown-mid transition-colors"
                >
                  Skip — use AI estimate
                </button>
              </div>
            </motion.div>
          )}

          {/* ── MEASURE FORM ─────────────────────────────────────────────── */}
          {mode === "measure" && (
            <motion.div
              key="measure"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <div className="text-center mb-6">
                <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">
                  Enter your
                </p>
                <h2
                  className="font-display text-4xl text-brown-dark"
                  style={{ fontStyle: "italic", fontWeight: 300 }}
                >
                  Measurements
                </h2>
              </div>

              {/* Unit toggle */}
              <div className="flex gap-1 p-1 bg-brown-light/10 rounded-xl mb-6">
                {(["cm", "in"] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`flex-1 py-2 rounded-lg font-sans text-[0.62rem] tracking-widest uppercase transition-colors ${
                      unit === u ? "bg-brown-dark text-cream" : "text-brown-mid hover:text-brown-dark"
                    }`}
                  >
                    {u === "cm" ? "Centimetres" : "Inches"}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="space-y-3 mb-5">
                {[
                  { label: "Bust",  hint: "Fullest part of chest",        value: bust,  set: setBust  },
                  { label: "Waist", hint: "Narrowest part of torso",      value: waist, set: setWaist },
                  { label: "Hips",  hint: "Fullest part of hips & seat",  value: hip,   set: setHip   },
                ].map(({ label, hint, value, set }) => (
                  <div
                    key={label}
                    className="bg-white/55 border border-brown-light/25 rounded-2xl px-4 py-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-sans text-[0.6rem] font-medium tracking-widest uppercase text-brown-dark">
                        {label}
                      </p>
                      <p className="font-sans text-[0.58rem] text-brown-mid/60">{hint}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={unit === "cm" ? "e.g. 90" : "e.g. 36"}
                        value={value}
                        onChange={e => set(e.target.value)}
                        className="flex-1 bg-transparent font-display text-2xl text-brown-dark placeholder-brown-light/40 outline-none"
                        style={{ fontStyle: "italic", fontWeight: 300 }}
                      />
                      <span className="font-sans text-xs text-brown-mid">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {formError && (
                <p className="font-sans text-xs text-brown-mid text-center mb-4">{formError}</p>
              )}

              <button
                onClick={handleMeasureSubmit}
                className="w-full py-4 bg-brown-dark text-cream rounded-2xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-mid transition-colors"
              >
                Find My Shape
              </button>

              <p className="font-sans text-[0.58rem] text-brown-mid/40 text-center mt-4 leading-relaxed">
                Measurements stay on your device — never sent to a server.
              </p>
            </motion.div>
          )}

          {/* ── RESULT ───────────────────────────────────────────────────── */}
          {mode === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col items-center text-center"
            >
              <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-1">
                Your body shape
              </p>
              <h2
                className="font-display text-5xl text-brown-dark mb-3"
                style={{ fontStyle: "italic", fontWeight: 300 }}
              >
                {result.shape}
              </h2>

              {/* Confidence badge */}
              <span
                className="font-sans text-[0.58rem] tracking-widest uppercase px-3 py-1 rounded-full border mb-6"
                style={{
                  color: result.source === "measured" ? "#8B6347" : result.confident ? "#8B6347" : "#C9A882",
                  borderColor: result.source === "measured" ? "#8B6347" : result.confident ? "#8B6347" : "#C9A882",
                }}
              >
                {result.source === "measured"
                  ? "Based on measurements"
                  : result.confident
                  ? "Camera estimate — high confidence"
                  : "Camera estimate — enter measurements for precision"}
              </span>

              {/* Description */}
              <div className="bg-white/55 border border-brown-light/25 rounded-2xl p-5 text-left mb-5 w-full">
                <p className="font-sans text-xs text-brown-mid leading-relaxed">
                  {BODY_SHAPE_DESCRIPTIONS[result.shape]}
                </p>
              </div>

              {/* Prompt to refine if camera gave low-confidence result */}
              {!result.confident && result.source === "scanned" && (
                <button
                  onClick={() => setMode("measure")}
                  className="w-full py-3 border border-brown-mid/40 rounded-xl font-sans text-xs tracking-widest uppercase text-brown-mid hover:border-brown-dark hover:text-brown-dark transition-colors mb-4"
                >
                  Refine with Measurements
                </button>
              )}

              {/* Primary CTA */}
              <button
                onClick={() => saveAndContinue(result.shape)}
                className="w-full flex items-center justify-between px-6 py-4 bg-brown-dark text-cream rounded-2xl hover:bg-brown-mid transition-colors group"
              >
                <div className="text-left">
                  <p className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-cream/60 mb-0.5">View</p>
                  <p className="font-display text-xl" style={{ fontStyle: "italic", fontWeight: 300 }}>
                    Style Guide
                  </p>
                </div>
                <ArrowRight
                  className="w-5 h-5 text-cream/70 group-hover:translate-x-1 transition-transform"
                  strokeWidth={1.5}
                />
              </button>

              <button
                onClick={() => setMode("choose")}
                className="mt-4 font-sans text-xs text-brown-mid/50 tracking-widest uppercase hover:text-brown-mid transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
