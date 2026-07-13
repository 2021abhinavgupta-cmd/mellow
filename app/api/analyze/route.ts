import OpenAI from "openai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

let openaiClient: OpenAI | null = null;
function getClient() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// Direct REST call to v1 (not v1beta) for stable model access
async function analyzeWithGemini(imageDataUrl: string, systemPrompt: string): Promise<string> {
  const base64 = imageDataUrl.split(",")[1];
  const mimeType = imageDataUrl.includes("image/png") ? "image/png" : "image/jpeg";
  const apiKey = process.env.GEMINI_API_KEY;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt + "\n\nAnalyse this person's colouring and return the full JSON." },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  // strip markdown fences if model wraps JSON
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

interface SkinTonePayload {
  ita: number; fitzpatrick: number; monk: number;
  hex: string; L: number; a: number; b: number; label: string;
}

function skinToneBlock(st: SkinTonePayload): string {
  const fRoman = ["", "I", "II", "III", "IV", "V", "VI"][st.fitzpatrick] ?? st.fitzpatrick;
  return `
MEASURED SKIN TONE — pixel-sampled from client camera (trust this over visual estimation):
  Fitzpatrick: ${fRoman} — ${st.label.split("(")[0].trim()}
  Monk Scale:  ${st.monk}/10
  ITA:         ${st.ita}° (higher = fairer; Indian range typically -10° to +28°)
  CIELAB:      L*=${st.L}  a*=${st.a}  b*=${st.b}
  Dominant hex: ${st.hex}
Use these values to set the exact colour season, undertone, and season palette — do NOT override them with a guess.
`;
}

function buildSystemPrompt(gender: "male" | "female", skinTone?: SkinTonePayload, ageRange?: string) {
  const isMale = gender === "male";
  const hairExamples = isMale
    ? "Textured Crop, Side Part, Pompadour, Fade, Crew Cut, Quiff, Slick Back, French Crop, Undercut, Buzz Cut"
    : "Soft Layers, Beach Waves, Bob, Lob, Curtain Bangs, Collarbone Cut";
  const styleExamples = isMale
    ? "everyday: Slim-fit chinos + fitted tee; office: Tailored suit + Oxford shirt; occasions: Tuxedo / Sherwani"
    : "everyday: High-waisted jeans + wrap top; office: Tailored trousers + blouse; occasions: Wrap dress / gown";

  return `You are a professional personal colour, makeup, and style analyst specialising in seasonal colour theory.
The person in this photo is ${isMale ? "MALE" : "FEMALE"}. Use this gender for ALL recommendations — never suggest styles for the opposite gender.
${ageRange ? `AGE GROUP: ${ageRange} — calibrate ALL recommendations to this age range. Younger users (Under 25): trend-forward styles, bold experimenting. Mid-range (25–35): polished modern, versatile. (35–45): sophisticated, effortless. Mature (45+): elegant, refined, flattering cuts over trends. Adjust hairstyle maturity, makeup intensity, and clothing silhouette accordingly.` : ""}
${skinTone ? skinToneBlock(skinTone) : ""}

HAIR — recommend only ${isMale ? "men's" : "women's"} hairstyles. Examples: ${hairExamples}.
${isMale ? "Do NOT suggest: buns, half-up half-down, updos meant for women, long feminine styles." : "Do NOT suggest: fades, undercuts, crew cuts, or men's cuts."}

STYLE — suggest ${isMale ? "men's" : "women's"} clothing only. Examples: ${styleExamples}.
${isMale ? "Outfit images should show the man in masculine attire (shirts, trousers, suits, kurtas)." : "Outfit images should show the woman in feminine attire (dresses, skirts, blouses, sarees)."}

TARGET AUDIENCE: Indian. Prioritise Indian clothing (kurta, salwar, saree, lehenga for women; kurta-pyjama, sherwani for men), gold jewellery, Indian occasions (festivals, weddings).

GROOMING — ${isMale ? "include the grooming object with beard style recommendations for this face shape, skincare routine, and fragrance notes." : 'set grooming to null — not applicable for female users.'}

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:`;}

const BASE_SCHEMA = `

{
  "season": "e.g. Soft Autumn",
  "seasonDescription": "2–3 warm sentences: what makes this season unique, what their colouring projects, overall vibe",
  "undertone": "e.g. Warm Neutral",
  "undertoneDescription": "1–2 sentences on their specific undertone",
  "descriptors": ["exactly 5 one-word descriptors"],

  "bestColors": ["15 hex codes — colours that flatter across clothing, makeup & accessories"],
  "bestColorsNote": "1 sentence: why these specific colours work for them",
  "avoidColors": ["8 hex codes to avoid"],
  "bestNeutrals": ["5 hex codes — best wardrobe neutrals"],
  "seasonalPalette": ["24 hex codes — full seasonal palette, 8 per row"],

  "makeup": {
    "eyeshadow": {
      "matte": [
        { "name": "e.g. Warm Taupe", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "shimmer": [
        { "name": "e.g. Champagne Gold", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "tip": "1 sentence: specific eyeshadow guidance for their eye colour and season"
    },
    "lipstick": {
      "nudes": [
        { "name": "e.g. Peach Nude", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "pinksAndRoses": [
        { "name": "e.g. Dusty Rose", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "coralsAndBrowns": [
        { "name": "e.g. Warm Coral", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "tip": "1 sentence: which lipstick family flatters them most and why"
    },
    "blush": {
      "shades": [
        { "name": "e.g. Peach", "hex": "#..." },
        { "name": "...", "hex": "#..." },
        { "name": "...", "hex": "#..." }
      ],
      "tip": "1 sentence: blush placement or shade guidance for their skin tone"
    },
    "highlightAndContour": {
      "highlight": ["3 hex codes — highlight shades"],
      "contour": ["2 hex codes — contour shades"],
      "tip": "1 sentence: highlighting and contouring guidance"
    }
  },

  "skinTips": [
    { "title": "e.g. Dewy, Not Matte", "desc": "Short sentence: why and how" },
    { "title": "...", "desc": "..." },
    { "title": "...", "desc": "..." },
    { "title": "...", "desc": "..." }
  ],

  "completeLook": {
    "eyes": "e.g. Warm brown lid with gold shimmer on inner corner",
    "lips": "e.g. Warm rose nude",
    "blush": "e.g. Peachy rose on the apples",
    "highlight": "e.g. Soft champagne gold on cheekbones"
  },

  "whatWorksWell": ["4 specific bullet points on what works"],
  "traits": ["3 perception descriptors — how their colouring reads to others"],
  "enhances": ["3 bullet points: colours/styles that enhance them"],
  "avoid": ["3 bullet points: what to avoid and why"],
  "styleTips": ["3 specific style tips"],

  "hair": {
    "faceShape": "e.g. Oval",
    "faceShapeDescription": "1–2 sentences: what defines this face shape and why certain styles work",
    "faceShapeTraits": ["3 short traits e.g. Softens Face", "Adds Volume", "Frames Features"],
    "mostFlattering": [
      { "name": "gender-appropriate style e.g. Textured Crop (male) or Soft Layers (female)", "description": "1 sentence why this works for their face shape" },
      { "name": "...", "description": "..." },
      { "name": "...", "description": "..." },
      { "name": "...", "description": "..." }
    ],
    "otherOptions": ["4 gender-appropriate hairstyle names that also suit them"],
    "bangs": ["2 fringe/bang styles appropriate for their gender — for men use e.g. Textured Fringe, Side-Swept; for women e.g. Curtain Bangs, Side-Swept Bangs"],
    "updos": ["3 styling options — for men e.g. Slicked Back, Pomaded Look, Natural Texture; for women e.g. Loose Bun, Half-Up Half-Down"],
    "bestParting": "e.g. Deep Side Part or No Part (Textured) — gender-appropriate",
    "tips": ["4 practical hair tips specific to their face shape, hair type, and gender"],
    "goal": "e.g. Clean, Textured & Sharp (male) or Soft, Voluminous & Framed (female)",
    "observedHairType": "e.g. Wavy, Medium Density"
  },

  "style": {
    "bodyType": "e.g. Pear (Triangle)",
    "bodyTypeDescription": "1–2 sentences: key characteristics of this body type",
    "keyFeatures": ["4 key features e.g. Shoulders narrower than hips"],
    "whatFlattens": ["4 things that flatter this body type"],
    "everyday": {
      "bestStyles": ["4 casual everyday styles e.g. High-waisted jeans, Wrap tops"],
      "bestColors": ["5 hex codes — best everyday colours from their season"]
    },
    "office": {
      "bestStyles": ["4 office-appropriate styles e.g. Tailored trousers, A-line skirts"],
      "bestColors": ["5 hex codes — best office colours from their season"]
    },
    "occasional": {
      "bestStyles": ["4 occasion wear styles e.g. Wrap dress, Off-shoulder gown"],
      "bestColors": ["5 hex codes — best occasion colours from their season"]
    },
    "necklines": ["4 flattering neckline styles e.g. V-Neck, Sweetheart"],
    "prints": [
      { "name": "e.g. Florals", "tip": "1 sentence: how to wear this print" },
      { "name": "...", "tip": "..." },
      { "name": "...", "tip": "..." }
    ],
    "fabrics": ["3 flattering fabric types e.g. Chiffon, Satin"],
    "avoid": ["4 things to avoid and why"],
    "outfitFormula": "e.g. Fitted top + High-waist bottom + Open jacket + Minimal accessories",
    "quickTips": ["3 practical style tips"],
    "jewellery": {
      "bestMetals": ["2–3 metals e.g. 22k Gold, Rose Gold — for males: Gold chain, Steel watch"],
      "neckStyles": ["3 necklace/chain styles that suit their neckline and face — for males: e.g. Thin gold chain, Dog tag"],
      "earringStyles": ["3 earring styles — for males: e.g. Stud only, Skip if not applicable"],
      "banglesAndBracelets": ["2 bangle/bracelet styles — for males: e.g. Leather cuff, Steel bracelet"],
      "tip": "1 sentence: overall jewellery direction for their season and colouring"
    }
  },

  "nails": {
    "bestPolish": [
      { "name": "e.g. Warm Terracotta", "hex": "#..." },
      { "name": "...", "hex": "#..." },
      { "name": "...", "hex": "#..." },
      { "name": "...", "hex": "#..." },
      { "name": "...", "hex": "#..." },
      { "name": "...", "hex": "#..." }
    ],
    "frenchTip": ["2 hex codes — French tip base and tip colour variations for their season"],
    "avoid": ["2 nail polish shades/families to avoid for their undertone"],
    "tip": "1 sentence: overall nail direction — finish, colour family, occasion notes"
  },

  "fragrance": {
    "families": ["3 scent families that suit their season e.g. Warm Spicy, Woody Oriental, Soft Floral Amber"],
    "notes": ["5 key fragrance notes e.g. Sandalwood, Rose Oud, Amber, Cardamom, Jasmine"],
    "indianAttars": ["2 Indian attar or Indian perfume recommendations e.g. Rose Attar, Oud Al Hindi, Mogra Attar"],
    "seasonal": ["2 season-specific suggestions e.g. heavier oud in winter, lighter floral musk in monsoon"],
    "tip": "1 sentence: fragrance philosophy — warm/cool, intensity, occasion"
  },

  "accessories": {
    "handbag": {
      "shapes": ["3 flattering bag shapes for their body type e.g. Structured tote, Hobo bag, Crossbody"],
      "colors": ["3 hex codes — best handbag accent colours from their palette"]
    },
    "belt": {
      "styles": ["2 belt styles that flatter their waist and body type"],
      "tip": "1 sentence: belt direction for their body shape"
    },
    "sunglasses": ["3 frame shapes for their face shape e.g. Aviator, Cat-eye, Round"],
    "scarf": {
      "styles": ["2 dupatta or scarf draping styles that suit their body and face"],
      "colors": ["3 hex codes — scarf accent colours"]
    },
    "shoes": {
      "heelTypes": ["2 heel types or flat styles that complement their body proportions"],
      "colors": ["3 hex codes — shoe neutral and accent colours"]
    },
    "tip": "1 sentence: overall accessory direction — mix metals, scale, occasion"
  },

  "indianOccasions": {
    "festival": {
      "outfits": ["3 festive outfit styles e.g. Silk kurta with palazzo, Embroidered anarkali, Banarasi saree"],
      "colors": ["4 hex codes — festive palette from their season, suitable for Indian festivities"],
      "makeup": "1 sentence: festival makeup direction for their skin tone"
    },
    "weddingGuest": {
      "outfits": ["3 wedding guest outfit styles e.g. Georgette lehenga, Silk saree, Sharara set"],
      "colors": ["4 hex codes — wedding guest palette — rich, celebration-appropriate"],
      "makeup": "1 sentence: wedding guest makeup direction"
    },
    "casualIndian": {
      "outfits": ["3 everyday Indian wear styles e.g. Cotton kurta-churidar, Salwar kameez, Linen co-ord"],
      "colors": ["4 hex codes — everyday Indian wear palette — lighter, wearable tones"]
    }
  },

  "grooming": null
}

GROOMING OBJECT (populate only when gender is MALE, set null for female):
{
  "beardStyles": [
    { "name": "e.g. Short Boxed Beard", "description": "1 sentence: why this suits their face shape" },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ],
  "noBeardOptions": ["2 clean-shave or stubble options e.g. Heavy Stubble, Clean-Shaved with defined edges"],
  "skincare": ["4 practical grooming and skincare steps for a man — moisturiser, SPF, beard care, etc."],
  "fragranceNotes": ["3 masculine fragrance notes that suit their season e.g. Vetiver, Cedar, Bergamot"],
  "tip": "1 sentence: overall grooming direction for their colouring and face shape"
}`;

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, gender, skinTone, ageRange } = (await req.json()) as {
      imageDataUrl: string; gender?: string; skinTone?: SkinTonePayload; ageRange?: string;
    };

    if (!imageDataUrl?.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image data" }, { status: 400 });
    }

    const safeGender: "male" | "female" = gender === "male" ? "male" : "female";
    const systemPrompt = buildSystemPrompt(safeGender, skinTone, ageRange) + BASE_SCHEMA;

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await getClient().chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
                { type: "text", text: "Analyse this person's colouring and return the full JSON makeup and colour analysis." },
              ],
            },
          ],
          max_tokens: 7000,
        });
        const content = response.choices[0].message.content ?? "{}";
        return Response.json(JSON.parse(content));
      } catch (openaiErr) {
        console.warn("[analyze] OpenAI failed, falling back to Gemini:", openaiErr instanceof Error ? openaiErr.message : openaiErr);
      }
    }

    // Gemini fallback
    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: "No API keys configured" }, { status: 500 });
    }
    const geminiText = await analyzeWithGemini(imageDataUrl, systemPrompt);
    return Response.json(JSON.parse(geminiText));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
