import OpenAI, { toFile } from "openai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

// ── OpenAI client ─────────────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// ── Gemini image generation via v1beta (imagegeneration models live here) ────

async function generateWithGemini(
  base64: string,
  mimeType: string,
  key: string,
  prompt: string
): Promise<{ key: string; imageData: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini image error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgPart = parts.find((p: any) => p.inline_data?.mime_type?.startsWith("image/"));
  if (imgPart?.inline_data) {
    return { key, imageData: `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}` };
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
