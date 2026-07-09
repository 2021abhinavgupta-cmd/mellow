export type BodyShape =
  | "Hourglass"
  | "Pear"
  | "Inverted Triangle"
  | "Apple"
  | "Oval"
  | "Rectangle";

export interface Measurements {
  bust: number;
  waist: number;
  hip: number;
  unit: "cm" | "in";
}

export const BODY_SHAPE_DESCRIPTIONS: Record<BodyShape, string> = {
  Hourglass:
    "Bust and hips are balanced with a defined waist — the most versatile shape. Fitted styles, wrap dresses, and belted silhouettes all work beautifully.",
  Pear:
    "Hips wider than shoulders with a defined waist. A-line skirts, structured tops, and boat necklines balance proportions elegantly.",
  "Inverted Triangle":
    "Shoulders broader than hips. Styles that add volume at the hips and soften the shoulders — flared skirts, wide-leg trousers — create balance.",
  Apple:
    "Fuller midsection with narrower hips. Empire waists, wrap dresses, and V-necklines lengthen and streamline the silhouette.",
  Oval:
    "Midsection is the widest point. Vertical lines, wrap styles, and monochromatic outfits draw the eye up and down for a streamlined look.",
  Rectangle:
    "Proportions are balanced throughout. Ruffles, peplums, belts, and layering create shape and definition.",
};

function toCm(m: Measurements) {
  const f = m.unit === "in" ? 2.54 : 1;
  return { bust: m.bust * f, waist: m.waist * f, hip: m.hip * f };
}

export function classifyFromMeasurements(m: Measurements): BodyShape {
  const { bust, waist, hip } = toCm(m);

  const hipToBust   = hip  / bust;
  const bustToHip   = bust / hip;
  const waistToBust = waist / bust;
  const waistToHip  = waist / hip;

  // Hourglass: bust ≈ hips (≤5%), defined waist (≤75% of bust)
  if (Math.abs(hipToBust - 1) <= 0.05 && waistToBust <= 0.75) return "Hourglass";

  // Pear: hips clearly wider
  if (hipToBust > 1.05 && waistToHip <= 0.87) return "Pear";

  // Inverted Triangle: bust clearly wider
  if (bustToHip > 1.05) return "Inverted Triangle";

  // Oval: waist is the widest point
  if (waist > bust && waist > hip) return "Oval";

  // Apple: waist nearly as wide as both bust and hip
  if (waistToBust > 0.80 && waistToHip > 0.80) return "Apple";

  return "Rectangle";
}

// From MediaPipe PoseLandmarker — shoulder/hip pixel widths only.
// Can confidently detect Pear / Inverted Triangle.
// Balanced proportions default to Rectangle (can't distinguish Hourglass/Apple without waist).
export function classifyFromPose(
  shoulderPx: number,
  hipPx: number,
): { shape: BodyShape; confident: boolean } {
  const ratio = shoulderPx / hipPx;
  if (ratio > 1.10) return { shape: "Inverted Triangle", confident: true };
  if (ratio < 0.90) return { shape: "Pear", confident: true };
  return { shape: "Rectangle", confident: false };
}
