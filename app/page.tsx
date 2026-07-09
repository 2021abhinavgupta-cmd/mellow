"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import { Upload, Lock, Palette, Sparkles, Scissors, BookOpen, Camera } from "lucide-react";
import dynamic from "next/dynamic";

const FaceScanner = dynamic(() => import("@/app/components/FaceScanner"), { ssr: false });

const FACE_SHAPE_BLURB: Record<string, string> = {
  "Oval":               "Balanced proportions — forehead slightly wider than jaw, gently rounded chin.",
  "Round":              "Soft, full cheeks with similar face length and width. Gentle, curved jawline.",
  "Square":             "Strong, angular jaw roughly as wide as the forehead. Defined, structured look.",
  "Heart":              "Wide forehead and prominent cheekbones tapering to a narrow, pointed chin.",
  "Long":               "Face notably longer than wide, with similar forehead, cheekbone, and jaw width.",
  "Diamond":            "Wide cheekbones are the widest point — forehead and jaw both narrow.",
  "Rectangle":          "Long face with an angular jaw as wide as the forehead. Structured, strong.",
  "Triangle":           "Jaw wider than cheekbones and forehead — face widens toward the chin.",
  "Inverted Triangle":  "Wide forehead and temples tapering down to a narrow jaw and chin.",
};

const features = [
  {
    icon: Palette,
    title: "Color Analysis",
    desc: "Discover your seasonal palette, undertones, and colours that make you glow.",
  },
  {
    icon: Sparkles,
    title: "Makeup Guide",
    desc: "Curated looks that complement your features, skin tone, and bone structure.",
  },
  {
    icon: Scissors,
    title: "Hair Styles",
    desc: "Face-framing cuts and hues chosen for your unique facial geometry.",
  },
  {
    icon: BookOpen,
    title: "Style Guide",
    desc: "Wardrobe essentials and silhouettes tailored to your personal aesthetic.",
  },
];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: "easeOut" } as Transition,
});

export default function Home() {
  const router = useRouter();
  const [image,        setImage]        = useState<string | null>(null);
  const [gender,       setGender]       = useState<"male" | "female" | null>(null);
  const [faceShape,    setFaceShape]    = useState<string | null>(null);
  const [skinToneHex,  setSkinToneHex]  = useState<string | null>(null);
  const [showScanner,  setShowScanner]  = useState(false);
  const [pendingScanner, setPendingScanner] = useState(false);
  const [fromScan,     setFromScan]     = useState(false);
  const [dragging,     setDragging]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback((dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = dataUrl;
    }), []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPendingScanner(false);
    setFromScan(false);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const compressed = await compressImage(raw);
      setImage(compressed);
      setFaceShape(null);   // uploaded photo — no scan data
      setSkinToneHex(null);
      setGender(null);
    };
    reader.readAsDataURL(file);
  }, [compressImage]);

  const handleScanCapture = useCallback(async (dataUrl: string, shape: string) => {
    const compressed = await compressImage(dataUrl);
    setImage(compressed);
    setFaceShape(shape);
    setFromScan(true);
    // Read hex that FaceScanner already wrote to localStorage
    try {
      const raw = localStorage.getItem("mellow_skin_tone");
      if (raw) setSkinToneHex(JSON.parse(raw).hex ?? null);
    } catch { /* ignore */ }
    setShowScanner(false);
  }, [compressImage]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const analyze = useCallback(() => {
    if (!image || !gender) return;
    localStorage.removeItem("mellow_analysis");
    localStorage.removeItem("mellow_skin_analysis");
    sessionStorage.removeItem("mellow_hair_images");
    sessionStorage.removeItem("mellow_style_images");
    localStorage.setItem("mellow_image", image);
    localStorage.setItem("mellow_gender", gender);
    if (faceShape) {
      localStorage.setItem("mellow_face_shape", faceShape);
    } else {
      localStorage.removeItem("mellow_face_shape");
    }
    router.push("/results");
  }, [image, gender, faceShape, router]);

  return (
    <main className="min-h-screen bg-cream">
      {showScanner && (
        <FaceScanner
          gender={gender ?? "female"}
          onCapture={handleScanCapture}
          onClose={() => setShowScanner(false)}
        />
      )}
      {/* Nav */}
      <motion.nav
        {...fadeUp(0)}
        className="flex items-center justify-between px-8 py-7 md:px-16"
      >
        <span
          className="font-display text-[2rem] text-brown-dark tracking-wide"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          mellow
        </span>
        <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-brown-mid">
          Personal Style AI
        </span>
      </motion.nav>

      {/* Decorative rule */}
      <motion.div
        {...fadeUp(0.1)}
        className="mx-8 md:mx-16 border-t border-brown-light/40"
      />

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-20">
        <motion.p
          {...fadeUp(0.25)}
          className="font-sans text-[0.65rem] tracking-[0.35em] uppercase text-brown-mid mb-8"
        >
          AI-Powered Beauty Analysis
        </motion.p>

        <motion.h1
          {...fadeUp(0.35)}
          className="font-display text-[2.8rem] sm:text-[3.5rem] md:text-[5.5rem] text-brown-dark leading-[1.05] max-w-3xl"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          Discover Your
          <br />
          Natural Radiance
        </motion.h1>

        <motion.p
          {...fadeUp(0.5)}
          className="mt-7 text-brown-mid font-sans text-base md:text-lg max-w-sm leading-relaxed"
        >
          Upload a portrait and receive a full style analysis — colour season, makeup, hair, and wardrobe — in seconds.
        </motion.p>

        {/* Upload / Scan area */}
        <motion.div {...fadeUp(0.65)} className="mt-14 w-full max-w-md">
          {!image && (
            <>
              {/* PRIMARY: face scan — or gender picker before scan */}
              {!pendingScanner ? (
                <button
                  onClick={() => setPendingScanner(true)}
                  className="w-full relative cursor-pointer rounded-2xl border-2 border-brown-mid bg-white/60 hover:bg-white/85 hover:border-brown-dark transition-all duration-300 px-10 py-12 flex flex-col items-center gap-5 group"
                >
                  <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                  <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                  <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                  <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/50 group-hover:border-brown-dark/50 transition-colors" />
                  <div className="w-16 h-16 rounded-full bg-brown-dark flex items-center justify-center">
                    <Camera className="w-7 h-7 text-cream" strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl text-brown-dark" style={{ fontWeight: 400 }}>
                      Scan Your Face
                    </p>
                    <p className="font-sans text-sm text-brown-mid mt-1.5 leading-relaxed">
                      Camera detects face shape & captures your photo automatically
                    </p>
                  </div>
                </button>
              ) : (
                <div className="w-full relative rounded-2xl border-2 border-brown-mid bg-white/60 px-10 py-12 flex flex-col items-center gap-5">
                  <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/50" />
                  <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/50" />
                  <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/50" />
                  <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/50" />
                  <div className="text-center">
                    <p className="font-display text-2xl text-brown-dark" style={{ fontWeight: 400 }}>
                      Before we scan
                    </p>
                    <p className="font-sans text-sm text-brown-mid mt-1.5">
                      I am —
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {(["female", "male"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => { setGender(g); setShowScanner(true); setPendingScanner(false); }}
                        className="py-3 rounded-xl font-sans text-sm tracking-[0.15em] uppercase border border-brown-light bg-white/50 text-brown-mid hover:bg-brown-dark hover:text-cream hover:border-brown-dark transition-all duration-200"
                      >
                        {g === "female" ? "Female" : "Male"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPendingScanner(false)}
                    className="font-sans text-xs text-brown-mid/60 hover:text-brown-mid transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              )}

              {/* SECONDARY: upload */}
              <div className="mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 border-t border-brown-light/30" />
                  <span className="font-sans text-[0.6rem] tracking-[0.25em] uppercase text-brown-light">or upload a photo</span>
                  <div className="flex-1 border-t border-brown-light/30" />
                </div>

                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => inputRef.current?.click()}
                  className={`relative cursor-pointer rounded-2xl border border-dashed px-8 py-8 transition-all duration-300 ${
                    dragging
                      ? "border-brown-mid bg-brown-light/10"
                      : "border-brown-light bg-white/40 hover:bg-white/70 hover:border-brown-mid"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brown-light/20 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-5 h-5 text-brown-mid" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-sans text-sm text-brown-dark font-medium">Drop portrait here</p>
                      <p className="font-sans text-xs text-brown-mid mt-0.5">or click to browse — JPG, PNG, WEBP</p>
                    </div>
                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onChange}
                  />
                </div>
              </div>
            </>
          )}

          {/* Scan result card — no photo, just face shape + skin tone */}
          {image && fromScan && (
            <div className="relative rounded-2xl bg-white/60 border border-brown-light px-8 py-10 flex flex-col items-center gap-5">
              <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-mid/30" />
              <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-mid/30" />
              <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-mid/30" />
              <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-mid/30" />

              <div className="w-12 h-12 rounded-full bg-brown-dark/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-brown-dark" strokeWidth={1.5} />
              </div>

              {faceShape && (
                <div className="text-center">
                  <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid mb-2">Face Shape</p>
                  <p className="font-display text-4xl text-brown-dark" style={{ fontStyle: "italic", fontWeight: 300 }}>
                    {faceShape}
                  </p>
                  {FACE_SHAPE_BLURB[faceShape] && (
                    <p className="font-sans text-xs text-brown-mid/70 mt-2 max-w-[220px] mx-auto leading-relaxed">
                      {FACE_SHAPE_BLURB[faceShape]}
                    </p>
                  )}
                </div>
              )}

              {skinToneHex && (
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: skinToneHex }} />
                  <span className="font-sans text-sm text-brown-mid">Skin tone {skinToneHex}</span>
                </div>
              )}

              <button
                onClick={() => { setImage(null); setFaceShape(null); setSkinToneHex(null); setFromScan(false); setGender(null); }}
                className="font-sans text-xs text-brown-mid/60 hover:text-brown-mid transition-colors"
              >
                ← Rescan
              </button>
            </div>
          )}

          {/* Photo preview — upload path only */}
          {image && !fromScan && (
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-white/60 z-10" />
              <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-white/60 z-10" />
              <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-white/60 z-10" />
              <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-white/60 z-10" />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Your portrait" className="w-full h-80 object-cover" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImage(null);
                  setFaceShape(null);
                  setSkinToneHex(null);
                }}
                className="absolute top-3 right-10 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-brown-dark font-sans z-10 hover:bg-white transition-colors"
              >
                Change
              </button>
            </div>
          )}

          {image && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-5 space-y-4"
            >
              {/* Gender picker */}
              <div>
                <p className="font-sans text-[0.6rem] tracking-[0.3em] uppercase text-brown-mid text-center mb-3">
                  I am
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(["female", "male"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`py-3 rounded-xl font-sans text-sm tracking-[0.15em] uppercase transition-all duration-200 border ${
                        gender === g
                          ? "bg-brown-dark text-cream border-brown-dark"
                          : "bg-white/50 text-brown-mid border-brown-light hover:bg-white/80 hover:border-brown-mid"
                      }`}
                    >
                      {g === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={analyze}
                disabled={!gender}
                className="w-full bg-brown-dark text-cream py-4 rounded-xl font-sans tracking-[0.2em] text-sm uppercase hover:bg-brown-mid transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze My Style
              </button>
            </motion.div>
          )}

          {/* Privacy badge */}
          <motion.div
            {...fadeUp(0.8)}
            className="mt-5 flex items-center justify-center gap-2 text-brown-mid/70"
          >
            <Lock className="w-3 h-3" strokeWidth={1.5} />
            <span className="font-sans text-xs tracking-wide">
              Your photo is never stored
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* Divider with ornament */}
      <motion.div
        {...fadeUp(0.85)}
        className="flex items-center gap-4 mx-8 md:mx-16 mb-16"
      >
        <div className="flex-1 border-t border-brown-light/40" />
        <span className="font-display text-brown-light text-xl" style={{ fontStyle: "italic" }}>
          what you&apos;ll receive
        </span>
        <div className="flex-1 border-t border-brown-light/40" />
      </motion.div>

      {/* Feature cards */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 + i * 0.1, ease: "easeOut" }}
              className="group bg-white/40 rounded-2xl p-7 border border-brown-light/25 hover:bg-white/70 hover:border-brown-light/50 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-full bg-brown-light/15 flex items-center justify-center mb-5 group-hover:bg-brown-light/25 transition-colors">
                <f.icon className="w-5 h-5 text-brown-mid" strokeWidth={1.5} />
              </div>
              <h3
                className="font-display text-xl text-brown-dark mb-2"
                style={{ fontWeight: 400 }}
              >
                {f.title}
              </h3>
              <p className="font-sans text-sm text-brown-mid leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        {...fadeUp(1.2)}
        className="border-t border-brown-light/30 px-8 md:px-16 py-8 flex items-center justify-between"
      >
        <span
          className="font-display text-xl text-brown-dark/60"
          style={{ fontStyle: "italic", fontWeight: 300 }}
        >
          mellow
        </span>
        <span className="font-sans text-xs text-brown-mid/60 tracking-wide">
          © 2026 · Powered by AI
        </span>
      </motion.footer>
    </main>
  );
}
