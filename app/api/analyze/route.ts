import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

let openaiClient: OpenAI | null = null;
function getClient() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

let geminiClient: GoogleGenerativeAI | null = null;
function getGeminiClient() {
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return geminiClient;
}

async function analyzeWithGemini(imageDataUrl: string): Promise<string> {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const base64 = imageDataUrl.split(",")[1];
  const mimeType = imageDataUrl.includes("image/png") ? "image/png" : "image/jpeg";
  const result = await model.generateContent([
    { text: SYSTEM_PROMPT + "\n\nAnalyse this person's colouring and return the full JSON." },
    { inlineData: { mimeType, data: base64 } },
  ]);
  return result.response.text();
}

const SYSTEM_PROMPT = `You are a professional personal colour and makeup analyst specialising in seasonal colour theory.
Analyse the person's face — skin tone, undertone, eye colour, hair colour — and return detailed, specific, actionable makeup and colour guidance.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:

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
      { "name": "e.g. Soft Layers", "description": "1 sentence why this works for their face shape" },
      { "name": "...", "description": "..." },
      { "name": "...", "description": "..." },
      { "name": "...", "description": "..." }
    ],
    "otherOptions": ["4 hairstyle names that also suit them"],
    "bangs": ["2 bang styles e.g. Curtain Bangs, Side-Swept Bangs"],
    "updos": ["3 updo options e.g. Loose Bun, Half-Up Half-Down"],
    "bestParting": "e.g. Deep Side Part",
    "tips": ["4 practical hair tips specific to their face shape and hair type"],
    "goal": "e.g. Soft, Voluminous & Framed",
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
    "quickTips": ["3 practical style tips"]
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = (await req.json()) as { imageDataUrl: string };

    if (!imageDataUrl?.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image data" }, { status: 400 });
    }

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await getClient().chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
                { type: "text", text: "Analyse this person's colouring and return the full JSON makeup and colour analysis." },
              ],
            },
          ],
          max_tokens: 5000,
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
    const geminiText = await analyzeWithGemini(imageDataUrl);
    return Response.json(JSON.parse(geminiText));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
