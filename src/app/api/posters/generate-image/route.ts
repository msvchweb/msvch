import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  ART_STYLES,
  ART_STYLE_DEFS,
  POSTER_RATIOS,
  type ArtStyle,
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

    const { prompt, ratio, artStyle, mode, revisionInstruction, sourceImageDataUrl } =
      parsed.data;
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

    const imageInputs: { buffer: Buffer; mimeType: string; filename: string }[] = [];
    if (mode === "revise" && sourceImageDataUrl) {
      imageInputs.push({
        ...decodeDataUrlImage(sourceImageDataUrl),
        filename: "current-poster.png",
      });
    }
    imageInputs.push(await loadStyleSampleImage(artStyle));

    const form = new FormData();
    form.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1");
    form.append("prompt", buildImagePrompt({ prompt, mode, revisionInstruction, ratio }));
    form.append("size", sizeForRatio(ratio));
    form.append("quality", process.env.OPENAI_IMAGE_QUALITY ?? "high");
    form.append("output_format", "png");

    for (const image of imageInputs) {
      const normalized = await normalizeImage(image.buffer);
      const bytes = Uint8Array.from(normalized);
      form.append(
        "image[]",
        new Blob([bytes], { type: "image/png" }),
        image.filename.replace(/\.[^.]+$/, ".png"),
      );
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
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

Use the attached style sample image only as a visual style reference. Do not copy its text, logos, people, characters, or exact objects.

Hard requirements:
- Generate a Korean church poster image suitable for ${ratio}.
- Reserve the bottom 14% of the canvas as clean empty space for a footer overlay.
- Do not place any subject, face, important detail, text, logo, watermark, letter, or number in the bottom footer band.
- Avoid grave imagery, gloomy tones, and specific religious figure faces.`;

  if (mode === "generate") return base;

  return `${base}

The first attached image is the current poster draft. Keep its overall composition unless the user explicitly asks otherwise. The second attached image is the style sample.

User revision request:
${revisionInstruction || "Create a cleaner, more polished version while preserving the original intent."}

Apply only the requested revision, keep the footer band clear, and return one complete final image.`;
}

function sizeForRatio(ratio: PosterRatio): "1024x1024" | "1024x1536" {
  return ratio === "1:1" ? "1024x1024" : "1024x1536";
}

async function loadStyleSampleImage(
  artStyle: ArtStyle,
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const sampleSrc = ART_STYLE_DEFS[artStyle].sampleSrc;
  const filePath = path.join(process.cwd(), "public", sampleSrc.replace(/^\//, ""));
  const buffer = await readFile(filePath);
  return {
    buffer,
    mimeType: mimeTypeFromPath(sampleSrc),
    filename: path.basename(sampleSrc),
  };
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

function mimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
