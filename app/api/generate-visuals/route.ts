import OpenAI, { toFile } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

// ── OpenAI client ─────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// ── Gemini client ─────────────────────────────────────────────────────────────

let geminiClient: GoogleGenerativeAI | null = null;
function getGemini() {
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return geminiClient;
}

async function generateWithGemini(
  base64: string,
  mimeType: string,
  key: string,
  prompt: string
): Promise<{ key: string; imageData: string | null }> {
  const model = getGemini().getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["image", "text"] } as any,
  });

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ]);

  const imagePart = result.response.candidates?.[0]?.content?.parts?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.inlineData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  if (imagePart?.inlineData?.data) {
    const { mimeType: outMime, data } = imagePart.inlineData;
    return { key, imageData: `data:${outMime};base64,${data}` };
  }
  return { key, imageData: null };
}

// ── OpenAI generation with retry ──────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithOpenAI(
  buffer: Buffer,
  key: string,
  prompt: string,
  retries = 1
): Promise<{ key: string; imageData: string | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const imageFile = await toFile(buffer, "photo.jpg", { type: "image/jpeg" });
      const response = await getOpenAI().images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt,
        n: 1,
        size: "1024x1024",
      });
      const b64 = response.data?.[0]?.b64_json;
      return { key, imageData: b64 ? `data:image/png;base64,${b64}` : null };
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < retries) {
        await sleep(14000);
        continue;
      }
      throw err;
    }
  }
  return { key, imageData: null };
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, prompts } = (await req.json()) as {
      imageDataUrl: string;
      prompts: { key: string; prompt: string }[];
    };

    if (!imageDataUrl?.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image" }, { status: 400 });
    }

    const base64 = imageDataUrl.split(",")[1];
    const mimeType = imageDataUrl.includes("image/png") ? "image/png" : "image/jpeg";
    const buffer = Buffer.from(base64, "base64");

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;

    const images: { key: string; imageData: string | null }[] = [];

    for (const { key, prompt } of prompts) {
      let result: { key: string; imageData: string | null } = { key, imageData: null };

      // Try OpenAI first
      if (hasOpenAI) {
        try {
          result = await generateWithOpenAI(buffer, key, prompt);
        } catch (err) {
          console.warn(`[generate-visuals] OpenAI failed for ${key}, trying Gemini:`, err instanceof Error ? err.message : err);
        }
      }

      // Gemini fallback if OpenAI failed or unavailable
      if (!result.imageData && hasGemini) {
        try {
          result = await generateWithGemini(base64, mimeType, key, prompt);
        } catch (err) {
          console.error(`[generate-visuals] Gemini also failed for ${key}:`, err instanceof Error ? err.message : err);
        }
      }

      images.push(result);
    }

    return Response.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-visuals]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
