import OpenAI, { toFile } from "openai";
import { NextRequest } from "next/server";

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateOne(
  buffer: Buffer,
  key: string,
  prompt: string,
  retries = 2
): Promise<{ key: string; imageData: string | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const imageFile = await toFile(buffer, "photo.jpg", { type: "image/jpeg" });
      const response = await getClient().images.edit({
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
        // wait 14s then retry (rate limit resets each minute, limit is 5/min)
        await sleep(14000);
        continue;
      }
      throw err;
    }
  }
  return { key, imageData: null };
}

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, prompts } = (await req.json()) as {
      imageDataUrl: string;
      prompts: { key: string; prompt: string }[];
    };

    if (!imageDataUrl?.startsWith("data:image/")) {
      return Response.json({ error: "Invalid image" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const base64 = imageDataUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");

    // Sequential to respect 5 images/min rate limit
    const images: { key: string; imageData: string | null }[] = [];
    for (const { key, prompt } of prompts) {
      try {
        const result = await generateOne(buffer, key, prompt);
        images.push(result);
      } catch (err) {
        console.error(`[generate-visuals] ${key}:`, err);
        images.push({ key, imageData: null });
      }
    }

    return Response.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-visuals]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
