"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";

interface Props {
  season: string;
  undertone: string;
  bestColors: string[];
  seasonalPalette: string[];
  faceShape?: string | null;
  onClose: () => void;
}

export default function ShareCard({ season, undertone, bestColors, seasonalPalette, faceShape, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#FAF6F0";
    ctx.fillRect(0, 0, W, H);

    // Subtle top border stripe
    ctx.fillStyle = "#C9A882";
    ctx.fillRect(0, 0, W, 3);

    // ── Wordmark ──
    ctx.fillStyle = "#8B6347";
    ctx.font = "italic 300 52px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("mellow", W / 2, 82);

    // ── Label ──
    ctx.fillStyle = "rgba(139,99,71,0.55)";
    ctx.font = "300 18px 'DM Sans', Arial, sans-serif";
    ctx.letterSpacing = "0.22em";
    ctx.fillText("PERSONAL COLOUR ANALYSIS", W / 2, 130);
    ctx.letterSpacing = "0";

    // ── Season name ──
    ctx.fillStyle = "#4A3728";
    ctx.font = "italic 300 96px Georgia, serif";
    ctx.fillText(season, W / 2, 248);

    // ── Undertone pill ──
    const pillText = undertone.toUpperCase() + " UNDERTONE";
    ctx.font = "300 17px Arial, sans-serif";
    const pillW = ctx.measureText(pillText).width + 48;
    const pillX = (W - pillW) / 2;
    const pillY = 272;
    const pillH = 36;
    const pillR = pillH / 2;
    ctx.beginPath();
    ctx.moveTo(pillX + pillR, pillY);
    ctx.lineTo(pillX + pillW - pillR, pillY);
    ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR, pillR);
    ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
    ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH, pillR);
    ctx.lineTo(pillX + pillR, pillY + pillH);
    ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR, pillR);
    ctx.lineTo(pillX, pillY + pillR);
    ctx.arcTo(pillX, pillY, pillX + pillR, pillY, pillR);
    ctx.closePath();
    ctx.strokeStyle = "rgba(139,99,71,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(139,99,71,0.55)";
    ctx.font = "300 15px Arial, sans-serif";
    ctx.letterSpacing = "0.18em";
    ctx.fillText(pillText, W / 2, pillY + 23);
    ctx.letterSpacing = "0";

    // ── Best Colours label ──
    ctx.fillStyle = "rgba(139,99,71,0.55)";
    ctx.font = "300 15px Arial, sans-serif";
    ctx.letterSpacing = "0.2em";
    ctx.fillText("BEST COLOURS", W / 2, 352);
    ctx.letterSpacing = "0";

    // ── Best colour swatches (15 circles, 3 rows of 5) ──
    const swatchR = 46;
    const swatchGap = 22;
    const rowsB = 3;
    const colsB = 5;
    const totalSwatchW = colsB * swatchR * 2 + (colsB - 1) * swatchGap;
    const bStartX = (W - totalSwatchW) / 2 + swatchR;
    const bStartY = 380 + swatchR;
    for (let r = 0; r < rowsB; r++) {
      for (let c = 0; c < colsB; c++) {
        const idx = r * colsB + c;
        if (idx >= bestColors.length) break;
        const cx = bStartX + c * (swatchR * 2 + swatchGap);
        const cy = bStartY + r * (swatchR * 2 + swatchGap);
        ctx.beginPath();
        ctx.arc(cx, cy, swatchR, 0, Math.PI * 2);
        ctx.fillStyle = bestColors[idx];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ── Palette label ──
    const palStartY = bStartY + rowsB * (swatchR * 2 + swatchGap) - swatchGap + 36;
    ctx.fillStyle = "rgba(139,99,71,0.55)";
    ctx.font = "300 15px Arial, sans-serif";
    ctx.letterSpacing = "0.2em";
    ctx.fillText("SEASONAL PALETTE", W / 2, palStartY);
    ctx.letterSpacing = "0";

    // ── Seasonal palette swatches (24 circles, 3 rows of 8) ──
    const spR = 28;
    const spGap = 12;
    const spCols = 8;
    const spRows = 3;
    const totalSpW = spCols * spR * 2 + (spCols - 1) * spGap;
    const spStartX = (W - totalSpW) / 2 + spR;
    const spStartY = palStartY + 28 + spR;
    for (let r = 0; r < spRows; r++) {
      for (let c = 0; c < spCols; c++) {
        const idx = r * spCols + c;
        if (idx >= seasonalPalette.length) break;
        const cx = spStartX + c * (spR * 2 + spGap);
        const cy = spStartY + r * (spR * 2 + spGap);
        ctx.beginPath();
        ctx.arc(cx, cy, spR, 0, Math.PI * 2);
        ctx.fillStyle = seasonalPalette[idx];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ── Face shape (if present) ──
    const faceY = spStartY + spRows * (spR * 2 + spGap) - spGap + 36;
    if (faceShape) {
      ctx.fillStyle = "rgba(139,99,71,0.4)";
      ctx.font = "300 15px Arial, sans-serif";
      ctx.letterSpacing = "0.2em";
      ctx.fillText("FACE SHAPE", W / 2, faceY);
      ctx.letterSpacing = "0";
      ctx.fillStyle = "#4A3728";
      ctx.font = "italic 300 34px Georgia, serif";
      ctx.fillText(faceShape, W / 2, faceY + 40);
    }

    // ── Bottom divider + watermark ──
    ctx.strokeStyle = "rgba(201,168,130,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, H - 68);
    ctx.lineTo(W - 80, H - 68);
    ctx.stroke();

    ctx.fillStyle = "rgba(139,99,71,0.35)";
    ctx.font = "300 14px Arial, sans-serif";
    ctx.letterSpacing = "0.12em";
    ctx.fillText("mellow — personal style ai", W / 2, H - 38);
    ctx.letterSpacing = "0";

    setReady(true);
  }, [season, undertone, bestColors, seasonalPalette, faceShape]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `mellow-${season.toLowerCase().replace(/\s+/g, "-")}-colour-card.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-cream rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brown-light/20">
          <p className="font-sans text-[0.58rem] tracking-widest uppercase text-brown-mid">Your colour card</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-brown-light/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-brown-dark" strokeWidth={1.5} />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="px-4 pt-4 pb-2">
          <canvas
            ref={canvasRef}
            className="w-full rounded-2xl border border-brown-light/20"
            style={{ aspectRatio: "1/1", display: "block" }}
          />
        </div>

        {/* Actions */}
        <div className="px-4 pb-5 pt-3">
          <button
            onClick={handleDownload}
            disabled={!ready}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brown-dark text-cream rounded-2xl font-sans text-xs tracking-[0.2em] uppercase hover:bg-brown-mid transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2} />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
