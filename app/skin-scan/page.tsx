"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const SkinScanner = dynamic(() => import("@/app/components/SkinScanner"), { ssr: false });

export default function SkinScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(async (imageDataUrl: string) => {
    setScanning(false);
    setAnalyzing(true);
    setError(null);

    try {
      const cached = localStorage.getItem("mellow_skin_analysis");
      if (!cached) {
        const res = await fetch("/api/analyze-skin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
        localStorage.setItem("mellow_skin_analysis", JSON.stringify(data));
      }
      router.push("/results/skin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setAnalyzing(false);
    }
  }, [router]);

  if (scanning) {
    return (
      <SkinScanner
        onCapture={handleCapture}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      {analyzing ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            className="w-16 h-16 rounded-full border-2 border-brown-light mx-auto"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <p className="font-display text-2xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
            Analysing your skin…
          </p>
          <p className="font-sans text-xs text-brown-mid tracking-widest">
            Reading texture, tone, and concerns
          </p>
        </motion.div>
      ) : error ? (
        <div className="text-center space-y-4">
          <p className="font-sans text-sm text-brown-mid">{error}</p>
          <button
            onClick={() => setScanning(true)}
            className="px-8 py-3 bg-brown-dark text-cream rounded-full font-sans text-xs tracking-widest uppercase hover:bg-brown-mid transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-xs"
        >
          <div>
            <p className="font-sans text-[0.58rem] tracking-[0.3em] uppercase text-brown-mid mb-2">
              Skin Analysis
            </p>
            <h1 className="font-display text-4xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
              Scan Your Skin
            </h1>
          </div>
          <p className="font-sans text-sm text-brown-mid leading-relaxed">
            A close-up scan that reads your skin texture, pores, spots, and concerns to give you a personalised analysis.
          </p>
          <button
            onClick={() => setScanning(true)}
            className="w-full py-4 bg-brown-dark text-cream rounded-2xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-mid transition-colors"
          >
            Start Skin Scan
          </button>
          <button
            onClick={() => router.back()}
            className="font-sans text-xs text-brown-mid/60 tracking-widest uppercase"
          >
            Back
          </button>
        </motion.div>
      )}
    </div>
  );
}
