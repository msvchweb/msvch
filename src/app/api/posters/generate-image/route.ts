import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  ART_STYLES,
  POSTER_RATIOS,
  type PosterRatio,
} from "@/lib/poster-prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const RequestSchema = z.object({
  prompt: z.string().trim().min(1),
  ratio: z.enum(POSTER_RATIOS),
  artStyle: z.enum(ART_STYLES),
  mode: z.enum(["generate", "revise"]).default("generate"),
  revisionInstruction: z.string().trim().max(600).optional(),
  sourceImageDataUrl: z.string().trim().optional(),
});

interface OpenAIImageResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
  error?: { message?: string };
}

const DEFAULT_IMAGE_MODEL = "gpt-image-2";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        { status: 400 },
      );
    }

    const { prompt, ratio, mode, revisionInstruction, sourceImageDataUrl } = parsed.data;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    if (mode === "revise" && !sourceImageDataUrl) {
      return NextResponse.json(
        { error: "수정할 원본 이미지가 누락됐습니다." },
        { status: 400 },
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
    const endpoint =
      mode === "revise"
        ? "https://api.openai.com/v1/images/edits"
        : "https://api.openai.com/v1/images/generations";

    const response =
      mode === "revise"
        ? await callImageEdit({
            apiKey,
            endpoint,
            model,
            prompt: buildImagePrompt({ prompt, mode, revisionInstruction, ratio }),
            ratio,
            sourceImageDataUrl: sourceImageDataUrl!,
          })
        : await callImageGeneration({
            apiKey,
            endpoint,
            model,
            prompt: buildImagePrompt({ prompt, mode, revisionInstruction, ratio }),
            ratio,
          });

    const data = (await response.json()) as OpenAIImageResponse;

    if (!response.ok) {
      console.error("OpenAI Image API Error:", data);
      return NextResponse.json(
        { error: data.error?.message || "이미지 생성 중 오류가 발생했습니다." },
        { status: response.status },
      );
    }

    const imageBase64 = data.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json(
        { error: "이미지 데이터를 받지 못했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      imageBase64,
      mimeType: "image/png",
      imageUrl: `data:image/png;base64,${imageBase64}`,
      revisedPrompt: data.data?.[0]?.revised_prompt,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("posters/generate-image error", err);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function buildImagePrompt({
  prompt,
  mode,
  revisionInstruction,
  ratio,
}: {
  prompt: string;
  mode: "generate" | "revise";
  revisionInstruction?: string;
  ratio: PosterRatio;
}): string {
  const base = `${prompt}

Hard requirements:
- Generate a Korean church poster image suitable for ${ratio}.
- Reserve the bottom 14% of the canvas as clean empty space for a footer overlay.
- Do not place any subject, face, important detail, text, logo, watermark, letter, or number in the bottom footer band.
- Avoid grave imagery, gloomy tones, and specific religious figure faces.`;

  if (mode === "generate") return base;

  return `${base}

The attached image is the current poster draft. Keep its overall composition unless the user explicitly asks otherwise.

User revision request:
${revisionInstruction || "Create a cleaner, more polished version while preserving the original intent."}

Apply only the requested revision, keep the footer band clear, and return one complete final image.`;
}

async function callImageGeneration({
  apiKey,
  endpoint,
  model,
  prompt,
  ratio,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  ratio: PosterRatio;
}): Promise<Response> {
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size: sizeForRatio(ratio, model),
      quality: process.env.OPENAI_IMAGE_QUALITY ?? "high",
      output_format: "png",
    }),
  });
}

async function callImageEdit({
  apiKey,
  endpoint,
  model,
  prompt,
  ratio,
  sourceImageDataUrl,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  ratio: PosterRatio;
  sourceImageDataUrl: string;
}): Promise<Response> {
  const source = decodeDataUrlImage(sourceImageDataUrl);
  const normalized = await normalizeImage(source.buffer);
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", sizeForRatio(ratio, model));
  form.append("quality", process.env.OPENAI_IMAGE_QUALITY ?? "high");
  form.append("output_format", "png");
  form.append(
    "image[]",
    new Blob([Uint8Array.from(normalized)], { type: "image/png" }),
    "current-poster.png",
  );

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
}

function sizeForRatio(ratio: PosterRatio, model: string): string {
  if (model !== "gpt-image-2") {
    return ratio === "1:1" ? "1024x1024" : "1024x1536";
  }

  switch (ratio) {
    case "1:1":
      return "1024x1024";
    case "9:16":
      return "1024x1792";
    case "a4":
      return "1024x1456";
  }
}

function decodeDataUrlImage(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) {
    throw new Error("지원하지 않는 이미지 데이터 형식입니다.");
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
