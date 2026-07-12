import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  ART_STYLES,
  POSTER_CATEGORIES,
  POSTER_RATIOS,
  type PosterRatio,
} from "@/lib/poster-prompts";
import { logPosterUsage } from "@/lib/poster-usage-logs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RequestSchema = z.object({
  prompt: z.string().trim().min(1),
  ratio: z.enum(POSTER_RATIOS),
  artStyle: z.enum(ART_STYLES),
  mode: z.enum(["generate", "revise"]).default("generate"),
  revisionInstruction: z.string().trim().max(600).optional(),
  sourceImageDataUrl: z.string().trim().optional(),
  sourceImageDataUrls: z.array(z.string().trim()).max(6).optional(),
  includeFooterContent: z.boolean().optional(),
  posterTitle: z.string().trim().max(100).optional(),
  posterCategory: z.enum(POSTER_CATEGORIES).optional(),
});

interface OpenAIImageResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
  error?: { message?: string };
}

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_IMAGE_QUALITY = "medium";
const DEFAULT_IMAGE_OUTPUT_FORMAT = "jpeg";

type ImageOutputFormat = "png" | "jpeg" | "webp";

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin(request);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        { status: 400 },
      );
    }

    const {
      prompt,
      ratio,
      mode,
      revisionInstruction,
      sourceImageDataUrl,
      sourceImageDataUrls,
      includeFooterContent,
      posterTitle,
      posterCategory,
    } = parsed.data;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const sourceImages = sourceImageDataUrls?.length
      ? sourceImageDataUrls
      : sourceImageDataUrl
        ? [sourceImageDataUrl]
        : [];

    if (mode === "revise" && sourceImages.length === 0) {
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
            prompt: buildImagePrompt({ prompt, mode, revisionInstruction, ratio, includeFooterContent }),
            ratio,
            sourceImageDataUrls: sourceImages,
          })
        : await callImageGeneration({
            apiKey,
            endpoint,
            model,
            prompt: buildImagePrompt({ prompt, mode, revisionInstruction, ratio, includeFooterContent }),
            ratio,
          });

    const data = await readOpenAIImageResponse(response);

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

    await logPosterUsage({
      supabase,
      userId,
      action: mode === "revise" ? "revise_image" : "generate_image",
      posterTitle,
      posterCategory,
      posterRatio: ratio,
    });

    return NextResponse.json({
      imageBase64,
      mimeType: mimeTypeForOutputFormat(outputFormatForModel(model)),
      imageUrl: `data:${mimeTypeForOutputFormat(outputFormatForModel(model))};base64,${imageBase64}`,
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
  includeFooterContent,
}: {
  prompt: string;
  mode: "generate" | "revise";
  revisionInstruction?: string;
  ratio: PosterRatio;
  includeFooterContent?: boolean;
}): string {
  const footerInstruction = includeFooterContent
    ? `- Integrate a polished, readable church footer naturally at the bottom of the poster.
- Use the attached reference images for the church logo and QR code when provided.
- Footer content must include church name "명성비전교회", phone "02-534-0691", and address "서울 동작구 사당로 16바길 9".
- Do not invent a different church name, phone number, address, logo, or QR code.`
    : `- Reserve the bottom 14% of the canvas as clean empty space for a footer overlay.
- Do not place any subject, face, important detail, text, logo, watermark, letter, or number in the bottom footer band.`;

  const base = `${prompt}

Hard requirements:
- Generate a Korean church poster image suitable for ${ratio}.
${footerInstruction}
- Avoid grave imagery, gloomy tones, and specific religious figure faces.`;

  if (mode === "generate") return base;

  return `${base}

Use the attached image or images as visual references. If one attached image is the current poster draft, keep its overall composition unless the user explicitly asks otherwise.

User revision request:
${revisionInstruction || "Create a cleaner, more polished version while preserving the original intent."}

Apply only the requested revision and return one complete final image.`;
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
      quality: qualityForModel(model),
      ...outputOptionsForModel(model),
    }),
  });
}

async function callImageEdit({
  apiKey,
  endpoint,
  model,
  prompt,
  ratio,
  sourceImageDataUrls,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  ratio: PosterRatio;
  sourceImageDataUrls: string[];
}): Promise<Response> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", sizeForRatio(ratio, model));
  form.append("quality", qualityForModel(model));
  const outputOptions = outputOptionsForModel(model);
  for (const [key, value] of Object.entries(outputOptions)) {
    form.append(key, String(value));
  }
  for (const [index, sourceImageDataUrl] of sourceImageDataUrls.entries()) {
    const source = decodeDataUrlImage(sourceImageDataUrl);
    const normalized = await normalizeImage(source.buffer);
    form.append(
      "image[]",
      new Blob([Uint8Array.from(normalized)], { type: "image/png" }),
      `source-${index + 1}.png`,
    );
  }

  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
}

async function readOpenAIImageResponse(response: Response): Promise<OpenAIImageResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as OpenAIImageResponse;
  } catch {
    return {
      error: {
        message:
          response.status === 504
            ? "이미지 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
            : `OpenAI 이미지 응답을 해석하지 못했습니다. (${response.status})`,
      },
    };
  }
}

function isGptImageModel(model: string): boolean {
  return model.startsWith("gpt-image-");
}

function qualityForModel(model: string): string {
  if (!isGptImageModel(model)) return process.env.OPENAI_IMAGE_QUALITY ?? "standard";
  return process.env.OPENAI_IMAGE_QUALITY ?? DEFAULT_IMAGE_QUALITY;
}

function outputFormatForModel(model: string): ImageOutputFormat {
  if (!isGptImageModel(model)) return "png";
  const raw = process.env.OPENAI_IMAGE_OUTPUT_FORMAT ?? DEFAULT_IMAGE_OUTPUT_FORMAT;
  return raw === "png" || raw === "jpeg" || raw === "webp" ? raw : DEFAULT_IMAGE_OUTPUT_FORMAT;
}

function outputOptionsForModel(model: string): Record<string, string | number> {
  if (!isGptImageModel(model)) return {};
  const outputFormat = outputFormatForModel(model);
  const options: Record<string, string | number> = {
    output_format: outputFormat,
  };
  if (outputFormat === "jpeg" || outputFormat === "webp") {
    options.output_compression = Number(process.env.OPENAI_IMAGE_OUTPUT_COMPRESSION ?? 85);
  }
  return options;
}

function mimeTypeForOutputFormat(format: ImageOutputFormat): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
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
