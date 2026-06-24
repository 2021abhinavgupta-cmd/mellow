// Skin tone analysis
// ITA formula: ChenglongMa/SkinToneClassifier (CIELAB color space)
// HSV skin masking: adapted from cirbuk/skin-detection (adaptive hue range)

export interface SkinToneResult {
  ita: number;         // Individual Typology Angle in degrees (high=fair, low=deep)
  fitzpatrick: number; // 1–6
  monk: number;        // 1–10 (Google Monk Skin Tone scale)
  hex: string;         // dominant skin hex e.g. "#8B6141"
  L: number; a: number; b: number; // CIELAB values
  label: string;       // human-readable e.g. "Medium-Olive (Fitzpatrick IV, Monk 6)"
}

// sRGB gamma decode
function toLinear(c255: number): number {
  const s = c255 / 255;
  return s > 0.04045 ? ((s + 0.055) / 1.055) ** 2.4 : s / 12.92;
}

// sRGB → XYZ D65
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
  ];
}

// XYZ → LAB (D65: Xn=0.95047, Yn=1.0, Zn=1.08883)
function xyzToLab(X: number, Y: number, Z: number): [number, number, number] {
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  return xyzToLab(...rgbToXyz(r, g, b));
}

// ITA = arctan((L* − 50) / b*) × 180/π
export function computeITA(L: number, bStar: number): number {
  return Math.atan2(L - 50, bStar) * (180 / Math.PI);
}

// LAB → approximate sRGB hex for display
function labToHex(L: number, a: number, b: number): string {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const f3 = (t: number) => t > 0.20689655 ? t ** 3 : (t - 16 / 116) / 7.787;
  const [X, Y, Z] = [0.95047 * f3(fx), 1.0 * f3(fy), 1.08883 * f3(fz)];
  const toGamma = (c: number) => Math.max(0, Math.min(255, Math.round(
    (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255
  )));
  const R = toGamma( X *  3.2404542 + Y * -1.5371385 + Z * -0.4985314);
  const G = toGamma(-X *  0.9692660 + Y *  1.8760108 + Z *  0.0415560);
  const B = toGamma( X *  0.0556434 + Y * -0.2040259 + Z *  1.0572252);
  return `#${[R, G, B].map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

function itaToFitzpatrick(ita: number): { scale: number; label: string } {
  if (ita > 55)  return { scale: 1, label: "Very Fair" };
  if (ita > 41)  return { scale: 2, label: "Fair" };
  if (ita > 28)  return { scale: 3, label: "Light-Medium" };
  if (ita > 10)  return { scale: 4, label: "Medium-Olive" };
  if (ita > -30) return { scale: 5, label: "Brown" };
  return { scale: 6, label: "Deep Brown" };
}

// Google Monk Skin Tone scale (10-step)
function itaToMonk(ita: number): number {
  if (ita > 55)  return 1;
  if (ita > 41)  return 2;
  if (ita > 31)  return 3;
  if (ita > 20)  return 4;
  if (ita > 10)  return 5;
  if (ita > 0)   return 6;
  if (ita > -12) return 7;
  if (ita > -22) return 8;
  if (ita > -32) return 9;
  return 10;
}

// HSV skin pixel filter (adapted from cirbuk/skin-detection adaptive masking)
// Accepts warm hue range H 0–42° or 338–360°, filters shadows + highlights + desaturated
function isSkinPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (max === 0) return false;
  const v = max / 255, s = delta / max;
  if (v < 0.18 || v > 0.91) return false; // too dark or blown-out specular
  if (s < 0.08 || s > 0.70) return false; // too gray or oversaturated
  let h = 0;
  if (delta > 0) {
    if (max === r)      h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else                h = (r - g) / delta + 4;
    h = h * 60;
  }
  return h <= 42 || h >= 338; // warm skin hue range
}

export function computeSkinToneFromLab(L: number, a: number, b: number): SkinToneResult {
  const ita = computeITA(L, b);
  const { scale: fitzpatrick, label: fLabel } = itaToFitzpatrick(ita);
  const monk = itaToMonk(ita);
  const fRoman = ["", "I", "II", "III", "IV", "V", "VI"][fitzpatrick];
  return {
    ita: Math.round(ita * 10) / 10,
    fitzpatrick, monk,
    hex: labToHex(L, a, b),
    L: Math.round(L * 10) / 10,
    a: Math.round(a * 10) / 10,
    b: Math.round(b * 10) / 10,
    label: `${fLabel} (Fitzpatrick ${fRoman}, Monk ${monk})`,
  };
}

// Sample skin tone from video at cheek landmarks
// Draws raw video frame (no landmark overlay) to temp canvas, samples 20×20px at each cheek
export function sampleSkinToneFromVideo(
  video: HTMLVideoElement,
  landmarks: { x: number; y: number; z: number }[],
): { L: number; a: number; b: number } | null {
  const W = video.videoWidth, H = video.videoHeight;
  if (W === 0 || H === 0 || landmarks.length < 426) return null;

  const cap = document.createElement("canvas");
  cap.width = W; cap.height = H;
  const ctx = cap.getContext("2d");
  if (!ctx) return null;
  // Draw raw frame WITHOUT mirroring — landmark coords are in this space
  ctx.drawImage(video, 0, 0);

  // Cheek sampling points: lm[116]=L outer cheek, lm[205]=L cheek, lm[345]=R outer, lm[425]=R cheek
  const samplePts = [landmarks[116], landmarks[205], landmarks[345], landmarks[425]];
  const labValues: [number, number, number][] = [];

  for (const lm of samplePts) {
    const cx = Math.round(lm.x * W);
    const cy = Math.round(lm.y * H);
    const HALF = 10;
    const x0 = Math.max(0, cx - HALF), y0 = Math.max(0, cy - HALF);
    const x1 = Math.min(W, cx + HALF), y1 = Math.min(H, cy + HALF);
    const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], bv = data[i + 2];
      if (isSkinPixel(r, g, bv)) labValues.push(rgbToLab(r, g, bv));
    }
  }

  if (labValues.length < 6) return null;

  // Median per channel (more robust than mean for skin — avoids shadow/specular outliers)
  const med = (arr: number[]) => { arr.sort((x, y) => x - y); return arr[Math.floor(arr.length / 2)]; };
  return {
    L: med(labValues.map(v => v[0])),
    a: med(labValues.map(v => v[1])),
    b: med(labValues.map(v => v[2])),
  };
}
