/**
 * POST /api/admin/weeklies/import-hwp-finalize
 *
 * GitHub Actions(hwp-convert.yml) 가 .hwp → .hwpx 변환 + Storage 업로드를 마친 뒤
 * 본 라우트를 호출해 파싱·구조화 파이프라인을 재진입시킨다.
 *
 * 인증: `Authorization: Bearer <CRON_SECRET>` 또는 `x-cron-secret` 헤더.
 *       (사용자 세션 인증 없음 — runner 는 익명 컨텍스트)
 *
 * 흐름:
 *   1) Service role 로 Storage 'weeklies/imports/{importId}.hwpx' 다운로드
 *   2) parseHwpxBuffer + extractWeeklyFromHwpx
 *   3) weekly_imports.status='parsed' + parsed_json 갱신
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/api";
import { parseHwpxBuffer, isZipMagic } from "@/lib/hwpx-parser";
import {
  extractWeeklyFromHwpx,
  GeminiUnavailableError,
} from "@/lib/weekly-import-extractor";

export const maxDuration = 60;

interface SuccessResponse {
  importId: string;
  status: "parsed";
}

interface ErrorResponse {
  error: string;
}

function checkCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header =
    request.headers.get("authorization") ?? request.headers.get("x-cron-secret") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  return provided === expected;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  if (!checkCronSecret(request)) {
    return NextResponse.json<ErrorResponse>(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { importId?: string };
  try {
    const parsed = (await request.json()) as { importId?: string };
    body = parsed;
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "잘못된 요청 본문" },
      { status: 400 },
    );
  }
  const importId = body.importId;
  if (!importId || typeof importId !== "string") {
    return NextResponse.json<ErrorResponse>(
      { error: "importId 누락" },
      { status: 400 },
    );
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json<ErrorResponse>(
      { error: "Supabase 환경변수 누락" },
      { status: 500 },
    );
  }

  // ── 행 + Storage 객체 로드 ─────────────────────────────
  const { data: row, error: rowErr } = await supabase
    .from("weekly_imports")
    .select("id, file_path, source_format, status")
    .eq("id", importId)
    .single<{
      id: string;
      file_path: string;
      source_format: "hwp" | "hwpx";
      status: string;
    }>();

  if (rowErr || !row) {
    return NextResponse.json<ErrorResponse>(
      { error: `import 행을 찾지 못함: ${rowErr?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  // 변환된 .hwpx 경로 — `imports/{importId}.hwpx` (Actions runner 가 업로드한 위치)
  const hwpxPath = `imports/${importId}.hwpx`;

  const { data: blob, error: dlErr } = await supabase.storage
    .from("weeklies")
    .download(hwpxPath);
  if (dlErr || !blob) {
    await supabase
      .from("weekly_imports")
      .update({
        status: "failed",
        error_message: `변환된 .hwpx 를 찾지 못했습니다: ${dlErr?.message ?? "missing"}`,
      })
      .eq("id", importId);
    return NextResponse.json<ErrorResponse>(
      { error: ".hwpx 다운로드 실패" },
      { status: 500 },
    );
  }

  const arrayBuf = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (!isZipMagic(buffer)) {
    await supabase
      .from("weekly_imports")
      .update({
        status: "failed",
        error_message: "변환된 파일이 .hwpx(ZIP) 형식이 아닙니다.",
      })
      .eq("id", importId);
    return NextResponse.json<ErrorResponse>(
      { error: "변환 결과가 .hwpx 가 아닙니다." },
      { status: 422 },
    );
  }

  await supabase
    .from("weekly_imports")
    .update({ status: "parsing", error_message: null })
    .eq("id", importId);

  try {
    const raw = parseHwpxBuffer(buffer);
    const result = await extractWeeklyFromHwpx(raw);
    await supabase
      .from("weekly_imports")
      .update({
        status: "parsed",
        parsed_json: result,
        raw_text_excerpt: raw.rawTextExcerpt,
        error_message: null,
      })
      .eq("id", importId);
    return NextResponse.json<SuccessResponse>({ importId, status: "parsed" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[import-hwp-finalize] parse fail", err);
    await supabase
      .from("weekly_imports")
      .update({ status: "failed", error_message: msg.slice(0, 2000) })
      .eq("id", importId);

    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json<ErrorResponse>(
        { error: "AI 서버가 일시적으로 혼잡합니다." },
        { status: 503 },
      );
    }
    return NextResponse.json<ErrorResponse>(
      { error: `파싱 실패: ${msg}` },
      { status: 422 },
    );
  }
}
