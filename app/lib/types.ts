export interface NamedSwatch {
  name: string;
  hex: string;
}

export interface SkinConcern {
  severity: "none" | "mild" | "moderate" | "significant";
  notes: string;
}

export interface SkinAnalysis {
  overallCondition: string;
  skinType: string;
  concerns: {
    pores: SkinConcern;
    acne: SkinConcern;
    darkSpots: SkinConcern;
    texture: SkinConcern;
    darkCircles: SkinConcern;
    redness: SkinConcern;
    oiliness: SkinConcern;
  };
  positives: string[];
  recommendations: string[];
  routine: {
    morning: string[];
    evening: string[];
  };
  ingredients: {
    use: string[];
    avoid: string[];
  };
}

export interface ColorAnalysis {
  season: string;
  seasonDescription: string;
  undertone: string;
  undertoneDescription: string;
  descriptors: string[];
  bestColors: string[];
  bestColorsNote: string;
  avoidColors: string[];
  bestNeutrals: string[];
  seasonalPalette: string[];
  makeup: {
    eyeshadow: { matte: NamedSwatch[]; shimmer: NamedSwatch[]; tip: string };
    lipstick: {
      nudes: NamedSwatch[];
      pinksAndRoses: NamedSwatch[];
      coralsAndBrowns: NamedSwatch[];
      tip: string;
    };
    blush: { shades: NamedSwatch[]; tip: string };
    highlightAndContour: { highlight: string[]; contour: string[]; tip: string };
  };
  skinTips: { title: string; desc: string }[];
  completeLook: { eyes: string; lips: string; blush: string; highlight: string };
  whatWorksWell: string[];
  traits: string[];
  enhances: string[];
  avoid: string[];
  styleTips: string[];
  hair: {
    faceShape: string;
    faceShapeDescription: string;
    faceShapeTraits: string[];
    mostFlattering: { name: string; description: string }[];
    otherOptions: string[];
    bangs: string[];
    updos: string[];
    bestParting: string;
    tips: string[];
    goal: string;
    observedHairType: string;
  };
  style: {
    bodyType: string;
    bodyTypeDescription: string;
    keyFeatures: string[];
    whatFlattens: string[];
    everyday: { bestStyles: string[]; bestColors: string[] };
    office: { bestStyles: string[]; bestColors: string[] };
    occasional: { bestStyles: string[]; bestColors: string[] };
    necklines: string[];
    prints: { name: string; tip: string }[];
    fabrics: string[];
    avoid: string[];
    outfitFormula: string;
    quickTips: string[];
    jewellery: {
      bestMetals: string[];
      neckStyles: string[];
      earringStyles: string[];
      banglesAndBracelets: string[];
      tip: string;
    };
  };
}
