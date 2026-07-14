import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RequestSchema = z.object({
  title: z.string().trim().max(100).optional(),
  ratio: z.enum(["1:1", "4:5"]),
  prompt: z.string().trim().min(1).max(2000),
});

interface OpenAIImageResponse {
  data?: { b64_json?: string; revised_prompt?: string }[];
  error?: { message?: string };
}

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_IMAGE_QUALITY = "medium";
const DEFAULT_IMAGE_OUTPUT_FORMAT = "jpeg";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const model = process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
    const outputFormat = outputFormatForModel(model);
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: buildCardNewsBackgroundPrompt(parsed.data.prompt, parsed.data.ratio),
        size: sizeForRatio(parsed.data.ratio, model),
        quality: qualityForModel(model),
        ...outputOptionsForModel(model, outputFormat),
      }),
    });

    const data = await readOpenAIImageResponse(response);
    if (!response.ok) {
      console.error("card-news/generate-background OpenAI error", data);
      return NextResponse.json(
        { error: data.error?.message ?? "배경 이미지 생성 중 오류가 발생했습니다." },
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
      mimeType: mimeTypeForOutputFormat(outputFormat),
      imageUrl: `data:${mimeTypeForOutputFormat(outputFormat)};base64,${imageBase64}`,
      revisedPrompt: data.data?.[0]?.revised_prompt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("card-news/generate-background error", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

function buildCardNewsBackgroundPrompt(prompt: string, ratio: "1:1" | "4:5") {
  const ratioText =
    ratio === "1:1"
      ? "square 1:1 Instagram feed canvas"
      : "portrait 4:5 Instagram carousel feed canvas";
  return `${prompt}

Create a polished Korean church Instagram carousel background for a ${ratioText}.

Hard requirements:
- No text, no letters, no numbers, no logos, no watermarks.
- Leave generous calm open space for Korean text overlays.
- Keep the background reusable across multiple carousel pages.
- Use warm, hopeful, clean church-friendly visuals.
- Avoid faces, specific religious figure faces, grave imagery, and gloomy tones.
- Do not include page-specific event details or captions.`;
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

function isGptImageModel(model: string) {
  return model.startsWith("gpt-image-");
}

function qualityForModel(model: string) {
  if (!isGptImageModel(model)) return process.env.OPENAI_IMAGE_QUALITY ?? "standard";
  return process.env.OPENAI_IMAGE_QUALITY ?? DEFAULT_IMAGE_QUALITY;
}

function outputFormatForModel(model: string): "png" | "jpeg" | "webp" {
  if (!isGptImageModel(model)) return "png";
  const raw = process.env.OPENAI_IMAGE_OUTPUT_FORMAT ?? DEFAULT_IMAGE_OUTPUT_FORMAT;
  return raw === "png" || raw === "jpeg" || raw === "webp" ? raw : DEFAULT_IMAGE_OUTPUT_FORMAT;
}

function outputOptionsForModel(model: string, outputFormat: "png" | "jpeg" | "webp") {
  if (!isGptImageModel(model)) return {};
  const options: Record<string, string | number> = { output_format: outputFormat };
  if (outputFormat === "jpeg" || outputFormat === "webp") {
    options.output_compression = Number(process.env.OPENAI_IMAGE_OUTPUT_COMPRESSION ?? 85);
  }
  return options;
}

function mimeTypeForOutputFormat(format: "png" | "jpeg" | "webp") {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function sizeForRatio(ratio: "1:1" | "4:5", model: string) {
  if (model === "gpt-image-2") {
    return ratio === "1:1" ? "1024x1024" : "1024x1280";
  }
  return ratio === "1:1" ? "1024x1024" : "1024x1536";
}

