/**
 * 미디어선교부 회의록 import — Layer 2 (이미지 재업로드) + Layer 3(a) (블록→마크다운) + AI 정리.
 *
 * 입력: parseHwpxBlocks() 의 HwpxBlockDoc (등장 순서 보존 블록 + BinData 바이너리).
 * 출력: MediaImportResult (검수 모달이 받는 DTO). 저장은 하지 않는다.
 *
 * 마커 규약은 네이버 블로그/BlogContent 와 동일한 [IMG:{publicUrl}] 을 재사용한다.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callGeminiWithFallback,
  GeminiUnavailableError,
} from "@/lib/gemini";
import { MAX_BLOG_IMAGE_SIZE } from "@/lib/validation";
import type { HwpxBlock, HwpxBlockDoc } from "@/lib/hwpx-parser";
import type { MediaImportResult } from "@/types/media-board";

export { GeminiUnavailableError };

const STORAGE_BUCKET = "board-images";

/** 파일 시그니처(매직 바이트)로 이미지 mime/확장자 추정. board-images 허용 타입만. */
function detectImage(
  buffer: Buffer,
): { mimeType: string; ext: string } | null {
  if (buffer.length < 4) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mimeType: "image/png", ext: "png" };
  }
  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mimeType: "image/gif", ext: "gif" };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: "image/webp", ext: "webp" };
  }
  return null;
}

/** GFM 표 셀 이스케이프 — `|` 와 개행 제거/치환 */
function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/** HwpxTable → GFM 마크다운 표 */
function tableToMarkdown(rows: { text: string }[][], colCount: number): string {
  if (rows.length === 0 || colCount === 0) return "";
  const norm = (row: { text: string }[]): string[] => {
    const cells = row.map((c) => escapeTableCell(c.text));
    while (cells.length < colCount) cells.push("");
    return cells.slice(0, colCount);
  };
  const header = norm(rows[0]);
  const sep = header.map(() => "---");
  const bodyRows = rows.slice(1).map(norm);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...bodyRows.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

interface UploadResult {
  /** binItemId → public URL (이미지 매핑 성공분) */
  urlByBinItem: Map<string, string>;
  /** 등장 순서 fallback 정렬용 — 업로드된 URL 목록(BinData 정렬 순서) */
  orderedUrls: string[];
  warnings: string[];
}

/**
 * Layer 2 — BinData 이미지 바이너리를 board-images 버킷에 재업로드.
 * 5MB 초과(서버 압축 불가)·미지원 포맷은 스킵 + warning. 등장 순서 fallback 용 정렬 목록도 반환.
 */
async function uploadImages(
  doc: HwpxBlockDoc,
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<UploadResult> {
  const urlByBinItem = new Map<string, string>();
  const orderedUrls: string[] = [];
  const warnings: string[] = [];

  // binEntries 는 같은 Buffer 를 여러 키(경로/파일명/stem)로 가리키므로 Buffer 기준 중복 제거.
  const seen = new Set<Buffer>();
  const uniqueEntries: { keys: string[]; data: Buffer }[] = [];
  for (const [key, data] of doc.binEntries.entries()) {
    if (seen.has(data)) {
      const existing = uniqueEntries.find((u) => u.data === data);
      if (existing) existing.keys.push(key);
      continue;
    }
    seen.add(data);
    uniqueEntries.push({ keys: [key], data });
  }

  for (const entry of uniqueEntries) {
    const detected = detectImage(entry.data);
    if (!detected) {
      warnings.push("지원하지 않는 이미지 형식이 있어 일부 그림이 누락됐습니다.");
      continue;
    }
    if (entry.data.length > MAX_BLOG_IMAGE_SIZE) {
      warnings.push(
        "5MB 를 초과하는 이미지가 있어 누락됐습니다. (회의록 본문 텍스트·표는 보존)",
      );
      continue;
    }

    const path = `${boardId}/${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${detected.ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, entry.data, { contentType: detected.mimeType });
    if (upErr) {
      warnings.push(`이미지 업로드 실패: ${upErr.message}`);
      continue;
    }
    const { data: pub } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    const url = pub.publicUrl;
    orderedUrls.push(url);
    for (const key of entry.keys) {
      urlByBinItem.set(key, url);
    }
  }

  return { urlByBinItem, orderedUrls, warnings };
}

/**
 * Layer 3(a) — 블록 시퀀스를 마크다운으로 직렬화.
 * 이미지 블록은 binItemId 로 업로드 URL 을 찾고, 못 찾으면 등장 순서 fallback.
 */
function serializeBlocks(
  blocks: HwpxBlock[],
  upload: UploadResult,
): { markdown: string; imageUrls: string[]; warnings: string[] } {
  const lines: string[] = [];
  const imageUrls: string[] = [];
  const warnings: string[] = [];
  let fallbackCursor = 0;

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      lines.push(block.text);
      continue;
    }
    if (block.kind === "table") {
      const md = tableToMarkdown(block.rows, block.colCount);
      if (md) lines.push(md);
      continue;
    }
    // image — binItemId 직접 매칭 시도 → 실패 시 등장 순서 fallback
    let url = upload.urlByBinItem.get(block.binItemId);
    if (!url) {
      // 키 후보: 끝 토큰(파일명/stem) 으로도 시도
      const tail = block.binItemId.slice(block.binItemId.lastIndexOf("/") + 1);
      url = upload.urlByBinItem.get(tail);
    }
    if (!url) {
      url = upload.orderedUrls[fallbackCursor];
      fallbackCursor += 1;
    }
    if (url) {
      lines.push(`[IMG:${url}]`);
      imageUrls.push(url);
    } else {
      warnings.push("일부 그림을 본문에 삽입하지 못했습니다.");
    }
  }

  return {
    markdown: lines.join("\n\n").trim(),
    imageUrls,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
//  AI 정리 (Gemini)
// ─────────────────────────────────────────────────────────────

const MediaImportAiSchema = z.object({
  title: z.string().min(1).max(150),
  markdown: z.string().min(1).max(30000),
});

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export function buildMeetingNotePrompt(markdown: string): string {
  return `당신은 한국 교회 미디어선교부의 회의록을 정리하는 전문가입니다.
아래는 한컴오피스 회의록(.hwpx)에서 추출한 본문입니다. 표는 GFM 마크다운 표(|...|), 그림은 [IMG:...] 마커로 위치가 표시되어 있습니다.

[추출 본문]
${markdown.slice(0, 20000)}

[정리 규칙]
1. 문단 다듬기·맞춤법 교정·항목 정형화만 하세요. 본문에 없는 내용을 만들지 마세요(환각 금지).
2. [중요] 표(| --- |) 구조와 이미지 마커 [IMG:...] 는 "절대로" 그대로 유지해야 합니다. 표를 목록(-)이나 일반 텍스트로 변환하지 마세요.
3. 이미지 마커 [IMG:...] 는 반드시 한 줄에 하나씩 단독으로 배치하세요(앞뒤에 빈 줄 추가 권장). 마커 내부의 URL은 절대 수정하지 마세요.
4. 회의록답게 제목(##), 목록(-), 강조(**굵게**) 정도의 가벼운 마크다운만 사용하세요.
5. title 은 회의록 제목으로 어울리는 짧은 한 줄(날짜·주제 포함 가능).

JSON 만 응답하세요. 추가 설명 X.

{
  "title": "회의록 제목",
  "markdown": "정리된 본문 마크다운"
}`;
}

/** 자동 제목 폴백 — 첫 문단/파일명 기반 */
function autoTitle(fileName: string, blocks: HwpxBlock[]): string {
  const firstPara = blocks.find((b) => b.kind === "paragraph");
  if (firstPara && firstPara.kind === "paragraph") {
    const t = firstPara.text.trim().slice(0, 80);
    if (t.length > 0) return t;
  }
  const stem = fileName.replace(/\.[^.]+$/, "").trim();
  return stem.length > 0 ? stem.slice(0, 80) : "회의록";
}

/**
 * 전체 파이프라인 — HwpxBlockDoc → 이미지 업로드 → 마크다운 직렬화 → AI 정리 → MediaImportResult.
 * AI 실패/혼잡 시 원문 마크다운 + 자동 제목으로 폴백(aiApplied:false).
 */
export async function importMeetingNote(
  doc: HwpxBlockDoc,
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
  fileName: string,
): Promise<MediaImportResult> {
  const stats = {
    paragraphs: doc.blocks.filter((b) => b.kind === "paragraph").length,
    tables: doc.blocks.filter((b) => b.kind === "table").length,
    images: doc.blocks.filter((b) => b.kind === "image").length,
  };

  const upload = await uploadImages(doc, supabase, boardId, userId);
  const serialized = serializeBlocks(doc.blocks, upload);
  const warnings = [...upload.warnings, ...serialized.warnings];

  const baseMarkdown = serialized.markdown || "(본문이 비어 있습니다.)";

  // AI 정리 시도
  let aiApplied = false;
  let finalMarkdown = baseMarkdown;
  let suggestedTitle = autoTitle(fileName, doc.blocks);

  try {
    const raw = await callGeminiWithFallback(buildMeetingNotePrompt(baseMarkdown));
    const stripped = stripCodeFence(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      parsed = null;
    }
    const result = MediaImportAiSchema.safeParse(parsed);
    if (result.success) {
      // 이미지 마커가 AI 응답에서 사라졌는지 검사 — 사라졌으면 보존 위해 원문 유지
      const aiUrlCount = (result.data.markdown.match(/\[IMG:/g) ?? []).length;
      if (aiUrlCount >= serialized.imageUrls.length) {
        finalMarkdown = result.data.markdown;
        suggestedTitle = result.data.title;
        aiApplied = true;
      } else {
        warnings.push(
          "AI 정리 중 일부 그림 마커가 사라져 원문을 유지했습니다.",
        );
      }
    } else {
      warnings.push("AI 응답 형식이 올바르지 않아 원문을 사용합니다.");
    }
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      warnings.push("AI 서버 혼잡으로 원문을 그대로 사용합니다.");
    } else {
      warnings.push("AI 정리에 실패하여 원문을 그대로 사용합니다.");
    }
  }

  return {
    suggestedTitle,
    markdown: finalMarkdown,
    imageUrls: serialized.imageUrls,
    stats,
    aiApplied,
    warnings,
  };
}
