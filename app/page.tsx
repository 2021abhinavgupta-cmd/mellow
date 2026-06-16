"use client";

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, type Transition } from "framer-motion";
import { Upload, Lock, Palette, Sparkles, Scissors, BookOpen } from "lucide-react";

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
  const [image, setImage] = useState<string | null>(null);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [dragging, setDragging] = useState(false);
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
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const compressed = await compressImage(raw);
      setImage(compressed);
      setGender(null);
    };
    reader.readAsDataURL(file);
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
    sessionStorage.removeItem("mellow_hair_images");
    sessionStorage.removeItem("mellow_style_images");
    localStorage.setItem("mellow_image", image);
    localStorage.setItem("mellow_gender", gender);
    router.push("/results");
  }, [image, gender, router]);

  return (
    <main className="min-h-screen bg-cream">
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
          className="font-display text-[3.5rem] md:text-[5.5rem] text-brown-dark leading-[1.05] max-w-3xl"
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

        {/* Upload area */}
        <motion.div {...fadeUp(0.65)} className="mt-14 w-full max-w-md">
          {!image ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed px-10 py-16 transition-all duration-300 ${
                dragging
                  ? "border-brown-mid bg-brown-light/10"
                  : "border-brown-light bg-white/50 hover:bg-white/80 hover:border-brown-mid"
              }`}
            >
              {/* Corner brackets */}
              <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-brown-light" />
              <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-brown-light" />
              <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-brown-light" />
              <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-brown-light" />

              <div className="flex flex-col items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-brown-light/20 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-brown-mid" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="font-display text-xl text-brown-dark" style={{ fontWeight: 400 }}>
                    Drop your portrait here
                  </p>
                  <p className="font-sans text-sm text-brown-mid mt-1.5">
                    or click to browse — JPG, PNG, WEBP
                  </p>
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
          ) : (
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              {/* Corner brackets on preview */}
              <span className="absolute top-3 left-3 w-6 h-6 border-t border-l border-white/60 z-10" />
              <span className="absolute top-3 right-3 w-6 h-6 border-t border-r border-white/60 z-10" />
              <span className="absolute bottom-3 left-3 w-6 h-6 border-b border-l border-white/60 z-10" />
              <span className="absolute bottom-3 right-3 w-6 h-6 border-b border-r border-white/60 z-10" />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="Your portrait"
                className="w-full h-80 object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImage(null);
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
