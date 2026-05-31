/**
 * POST /api/media-board/import-hwpx
 *
 * 미디어선교부 회의록 .hwpx 업로드 → ZIP+XML 블록 추출 → 이미지 board-images 재업로드
 * → 마크다운 직렬화 → Gemini 회의록 정리. 결과(MediaImportResult)만 반환하고 저장은 안 한다.
 * 사용자가 검수 모달에서 확정하면 기존 POST /api/boards/[id]/posts 로 등록한다.
 *
 * 원본 .hwpx 는 Storage 에 보관하지 않는다 (메모리에서만 파싱).
 *
 * 인증: createApiClient(request) — Bearer 헤더/쿠키 모두 지원(모바일 호환).
 * 권한: 로그인 + (미디어선교부 전용 게시판 멤버 OR admin/master). RLS 가 게이트.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMediaDeptBoard } from "@/lib/boards";
import { parseHwpxBlocks, isZipMagic } from "@/lib/hwpx-parser";
import {
  importMeetingNote,
  GeminiUnavailableError,
} from "@/lib/media-board-import";
import type {
  MediaImportResponse,
  MediaImportApiError,
} from "@/types/media-board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB (파서 가드와 동일)

export async function POST(
  request: NextRequest,
): Promise<NextResponse<MediaImportResponse | MediaImportApiError>> {
  const supabase = await createApiClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<MediaImportApiError>(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  // 전용 게시판 조회 — RLS 가 멤버/admin 에게만 row 를 노출하므로 권한 게이트를 겸한다.
  const board = await getMediaDeptBoard(supabase);
  if (!board) {
    return NextResponse.json<MediaImportApiError>(
      {
        error: "미디어선교부 게시판 접근 권한이 없습니다.",
        hint: "전용 게시판 멤버 또는 관리자만 회의록을 업로드할 수 있습니다.",
      },
      { status: 403 },
    );
  }

  // ── 파일 검증 ─────────────────────────────────────────
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return NextResponse.json<MediaImportApiError>(
      { error: "multipart/form-data 형식이 아닙니다." },
      { status: 400 },
    );
  }

  const fileField = fd.get("file");
  if (!fileField || typeof fileField === "string") {
    return NextResponse.json<MediaImportApiError>(
      { error: "file 필드가 비어있습니다." },
      { status: 400 },
    );
  }
  const file = fileField;

  if (file.size === 0) {
    return NextResponse.json<MediaImportApiError>(
      { error: "빈 파일입니다." },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json<MediaImportApiError>(
      {
        error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 25MB).`,
      },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "hwp") {
    return NextResponse.json<MediaImportApiError>(
      {
        error: ".hwp(구형) 파일은 지원하지 않습니다.",
        hint: "한컴오피스에서 '다른 이름으로 저장 → .hwpx' 로 저장한 뒤 다시 시도해 주세요.",
      },
      { status: 422 },
    );
  }
  if (ext !== "hwpx") {
    return NextResponse.json<MediaImportApiError>(
      { error: ".hwpx 파일만 허용됩니다." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isZipMagic(buffer)) {
    return NextResponse.json<MediaImportApiError>(
      { error: ".hwpx 형식이 아닙니다 (ZIP 매직 불일치)." },
      { status: 400 },
    );
  }

  // ── 블록 추출 + 이미지 재업로드 + AI 정리 (원본 미보관) ─────
  try {
    const blockDoc = parseHwpxBlocks(buffer);
    const result = await importMeetingNote(
      blockDoc,
      supabase,
      board.id,
      user.id,
      file.name.slice(0, 300),
    );
    return NextResponse.json<MediaImportResponse>({ result });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json<MediaImportApiError>(
        { error: "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[media-board/import-hwpx] parse fail", err);
    return NextResponse.json<MediaImportApiError>(
      { error: `회의록 파싱 실패: ${msg}` },
      { status: 422 },
    );
  }
}
