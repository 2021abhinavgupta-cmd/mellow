import OpenAI from "openai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

let openaiClient: OpenAI | null = null;
function getClient() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

async function analyzeWithGemini(imageDataUrl: string): Promise<string> {
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
            { text: SKIN_PROMPT + "\n\nAnalyse this person's skin and return the full JSON." },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Gemini response");
  return match[0];
}

const SKIN_PROMPT = `You are an expert dermatologist and skin analyst. Analyse the skin in this close-up facial photo with clinical precision.

Return ONLY a JSON object with this exact structure (no markdown, no backticks):

{
  "overallCondition": "2-3 sentence honest overall skin assessment",
  "skinType": "Oily | Dry | Combination | Normal | Sensitive",
  "concerns": {
    "pores": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific observation about pore size, location, visibility"
    },
    "acne": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific observation: active breakouts, closed comedones, post-acne marks, cysts"
    },
    "darkSpots": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific: hyperpigmentation type, sun spots, post-inflammatory marks, location"
    },
    "texture": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific: roughness, bumps, uneven surface, smoothness"
    },
    "darkCircles": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific: pigmentation vs vascular, puffiness, hollowness"
    },
    "redness": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific: diffuse flush, rosacea, broken capillaries, irritation patches"
    },
    "oiliness": {
      "severity": "none | mild | moderate | significant",
      "notes": "specific zones: T-zone, cheeks, overall; shine level"
    }
  },
  "positives": ["3 genuine positive observations about their skin"],
  "recommendations": [
    "5 specific, actionable skincare recommendations ranked by priority"
  ],
  "routine": {
    "morning": [
      "4 steps in order: cleanser type → toner/essence → treatment → SPF"
    ],
    "evening": [
      "4-5 steps in order: double cleanse if needed → treatment → moisturiser → targeted serum"
    ]
  },
  "ingredients": {
    "use": ["5 specific ingredients that would help their concerns, with brief reason"],
    "avoid": ["3 ingredients to avoid based on their skin type/concerns"]
  }
}

IMPORTANT for Indian skin (Fitzpatrick III-V):
- Hyperpigmentation and post-inflammatory marks are extremely common — be specific about type
- Melasma is common in Indian women — note if visible
- Avoid recommending products that are too stripping for olive/brown skin
- Sunscreen recommendation must mention broad-spectrum SPF 50+ (mandatory for Indian climate)
- Vitamin C and niacinamide are particularly beneficial for hyperpigmentation in darker skin
- Be honest about severity — do not sugarcoat concerns, but also do not exaggerate`;

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = await req.json();
    if (!imageDataUrl) return Response.json({ error: "No image provided" }, { status: 400 });

    let jsonStr: string;

    if (process.env.OPENAI_API_KEY) {
      const client = getClient();
      const resp = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SKIN_PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
            ],
          },
        ],
      });
      jsonStr = resp.choices[0].message.content ?? "{}";
    } else if (process.env.GEMINI_API_KEY) {
      jsonStr = await analyzeWithGemini(imageDataUrl);
    } else {
      return Response.json({ error: "No AI API key configured" }, { status: 500 });
    }

    const data = JSON.parse(jsonStr);
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
