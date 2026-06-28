import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  callGeminiWithFallbackMultimodal,
  GeminiUnavailableError,
} from "@/lib/gemini";
import {
  POSTER_CATEGORIES,
  POSTER_RATIOS,
  COLOR_PALETTES,
  ART_STYLES,
  MOODS,
  MOTIFS,
  PEOPLE_HANDLINGS,
  REFERENCE_ASPECTS,
  ART_STYLE_DEFS,
  buildMetaPromptForGemini,
  buildKoreanSummary,
  type PromptBuilderInput,
} from "@/lib/poster-prompts";
import { logPosterUsage } from "@/lib/poster-usage-logs";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_REFERENCE_BYTES = 5 * 1024 * 1024; // 5 MB 원본 한도

const PayloadSchema = z.object({
  category: z.enum(POSTER_CATEGORIES),
  ratio: z.enum(POSTER_RATIOS),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(100),

  schedules: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  location: z.string().trim().max(120).optional(),
  audience: z.string().trim().max(120).optional(),
  extraLines: z.array(z.string().trim().min(1).max(150)).max(12).optional(),

  colorPalette: z.enum(COLOR_PALETTES),
  artStyle: z.enum(ART_STYLES),
  mood: z.enum(MOODS),
  motifs: z.array(z.enum(MOTIFS)).max(8),
  peopleHandling: z.enum(PEOPLE_HANDLINGS),
  peopleCount: z.number().int().min(1).max(30).optional(),
  moodKeywords: z.string().trim().max(200).optional(),
  includeText: z.boolean(),

  referenceAspect: z.enum(REFERENCE_ASPECTS).optional(),
});

interface BuildPromptResponse {
  englishPrompt: string;
  koreanSummary: string;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin(request);

    // ── multipart 파싱 ─────────────────────────────────────
    const fd = await request.formData();
    const payloadStr = fd.get("payload");
    if (typeof payloadStr !== "string") {
      return NextResponse.json({ error: "payload 가 누락됐습니다." }, { status: 400 });
    }
    let payloadJson: unknown;
    try {
      payloadJson = JSON.parse(payloadStr);
    } catch {
      return NextResponse.json({ error: "payload JSON 이 올바르지 않습니다." }, { status: 400 });
    }
    const parsed = PayloadSchema.safeParse(payloadJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }
    const input: PromptBuilderInput = parsed.data;

    // ── 참고 이미지 처리 ───────────────────────────────────
    const referenceField = fd.get("reference");
    let userReferenceImage: { base64: string; mimeType: string } | undefined;

    if (referenceField && typeof referenceField !== "string" && referenceField.size > 0) {
      const file = referenceField as File;
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `참고 이미지가 아닙니다 (${file.type || "unknown"}).` },
          { status: 400 },
        );
      }
      if (file.size > MAX_REFERENCE_BYTES) {
        return NextResponse.json(
          { error: `참고 이미지가 너무 큽니다 (max 5MB).` },
          { status: 413 },
        );
      }
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        userReferenceImage = await compressReferenceImage(buf);
      } catch (e) {
        console.error("posters/build-prompt sharp error", e);
        return NextResponse.json(
          { error: "참고 이미지 처리 중 오류가 발생했습니다." },
          { status: 500 },
        );
      }
    }

    const styleSampleImage = await loadStyleSampleImage(input.artStyle);
    const referenceImages = [styleSampleImage, userReferenceImage].filter(
      (image): image is { base64: string; mimeType: string } => Boolean(image),
    );

    // ── Gemini 호출 ────────────────────────────────────────
    const metaPrompt = buildMetaPromptForGemini(input, {
      hasStyleSampleImage: Boolean(styleSampleImage),
      hasUserReferenceImage: Boolean(userReferenceImage),
    });
    const englishPrompt = await callGeminiWithFallbackMultimodal(metaPrompt, referenceImages);

    const cleaned = sanitizePromptOutput(englishPrompt);

    const body: BuildPromptResponse = {
      englishPrompt: cleaned,
      koreanSummary: buildKoreanSummary(input),
    };
    await logPosterUsage({
      supabase,
      userId,
      action: "build_prompt",
      posterTitle: input.title,
      posterCategory: input.category,
      posterRatio: input.ratio,
    });
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("posters/build-prompt error", err);
    return NextResponse.json(
      { error: "프롬프트 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

async function compressReferenceImage(
  buf: Buffer,
): Promise<{ base64: string; mimeType: string }> {
  const compressed = await sharp(buf)
    .rotate()
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return {
    base64: compressed.toString("base64"),
    mimeType: "image/jpeg",
  };
}

async function loadStyleSampleImage(
  artStyle: PromptBuilderInput["artStyle"],
): Promise<{ base64: string; mimeType: string } | undefined> {
  const sampleSrc = ART_STYLE_DEFS[artStyle].sampleSrc;
  const relativePath = sampleSrc.replace(/^\//, "");
  const filePath = path.join(process.cwd(), "public", relativePath.replace(/^images[\\/]/, "images/"));
  try {
    const buf = await readFile(filePath);
    return await compressReferenceImage(buf);
  } catch (e) {
    console.error("posters/build-prompt style sample load error", sampleSrc, e);
    return undefined;
  }
}

/** 모델이 종종 끼우는 머리말/따옴표/마크다운 구두를 제거. */
function sanitizePromptOutput(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(
    /^(Here(?:'s| is| are)?[^\n]*?:\s*\n+|Sure[^\n]*?\n+|Below(?:'s| is)?[^\n]*?:\s*\n+)/i,
    "",
  );
  return s.trim();
}
