/**
 * POST /api/admin/weeklies/import-hwpx
 *
 * 한컴 .hwpx 주보를 업로드하면 ZIP+XML 파싱 → 표 매핑 + Gemini 자유 텍스트 구조화로
 * WeeklyImportResult 를 반환한다. 결과는 weekly_imports 테이블에 보존되며,
 * 클라이언트(검수 모달) 가 사용자 확인 후 WeeklyForm 폼 state 에 patch 한다.
 *
 * 자동 저장 안 함 (Q2=A). 사용자가 명시적으로 "저장" 버튼을 눌러야 weeklies 에 반영된다.
 *
 * 인증: admin/master (037 매트릭스). Storage 'weeklies' 버킷 INSERT 권한과 동일.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { hasAdminAccess } from "@/lib/role-utils";
import { parseHwpxBuffer, isZipMagic } from "@/lib/hwpx-parser";
import {
  extractWeeklyFromHwpx,
  GeminiUnavailableError,
} from "@/lib/weekly-import-extractor";
import type { WeeklyImportResult } from "@/types/weekly-import";

export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = new Set(["hwpx"]);

interface SuccessResponse {
  importId: string;
  result: WeeklyImportResult;
}

interface ErrorResponse {
  error: string;
  hint?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    const { supabase, userId } = await requireAdmin(request);

    // 추가 가드: weekly_imports RLS 가 admin/master 만 허용 (037 매트릭스)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single<{ role: string }>();
    if (!hasAdminAccess(profile?.role)) {
      return NextResponse.json<ErrorResponse>(
        { error: "admin 이상의 권한이 필요합니다." },
        { status: 403 },
      );
    }

    const fd = await request.formData();
    const fileField = fd.get("file");
    if (!fileField || typeof fileField === "string") {
      return NextResponse.json<ErrorResponse>(
        { error: "file 필드가 비어있습니다." },
        { status: 400 },
      );
    }
    const file = fileField as File;

    // ── 파일 검증 ─────────────────────────────────────────
    if (file.size === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "빈 파일입니다." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json<ErrorResponse>(
        { error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 10MB).` },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "hwp") {
      return NextResponse.json<ErrorResponse>(
        {
          error: ".hwp 파일은 별도 변환이 필요합니다.",
          hint: "POST /api/admin/weeklies/import-hwp 로 업로드하거나, 한컴오피스에서 '다른 이름으로 저장 → .hwpx' 로 저장한 뒤 다시 시도해 주세요.",
        },
        { status: 422 },
      );
    }
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json<ErrorResponse>(
        { error: ".hwpx 파일만 허용됩니다." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isZipMagic(buffer)) {
      return NextResponse.json<ErrorResponse>(
        { error: ".hwpx 형식이 아닙니다 (ZIP 매직 불일치)." },
        { status: 400 },
      );
    }

    // ── weekly_imports 행 생성 (status='parsing') ─────────
    const importId = crypto.randomUUID();
    const storagePath = `imports/${importId}.hwpx`;
    const fileName = file.name.slice(0, 300);

    const { error: insertErr } = await supabase
      .from("weekly_imports")
      .insert({
        id: importId,
        uploaded_by: userId,
        file_name: fileName,
        file_path: storagePath,
        source_format: "hwpx",
        status: "parsing",
      });

    if (insertErr) {
      return NextResponse.json<ErrorResponse>(
        { error: `import 행 생성 실패: ${insertErr.message}` },
        { status: 500 },
      );
    }

    // ── Storage 업로드 ────────────────────────────────────
    const { error: storageErr } = await supabase.storage
      .from("weeklies")
      .upload(storagePath, buffer, {
        contentType:
          "application/vnd.hancom.hwpx+zip",
        upsert: true,
      });
    if (storageErr) {
      await supabase
        .from("weekly_imports")
        .update({ status: "failed", error_message: `storage: ${storageErr.message}` })
        .eq("id", importId);
      return NextResponse.json<ErrorResponse>(
        { error: `Storage 업로드 실패: ${storageErr.message}` },
        { status: 500 },
      );
    }

    // ── 파싱 + 추출 ───────────────────────────────────────
    let result: WeeklyImportResult;
    try {
      const raw = parseHwpxBuffer(buffer);
      result = await extractWeeklyFromHwpx(raw);

      await supabase
        .from("weekly_imports")
        .update({
          status: "parsed",
          parsed_json: result,
          raw_text_excerpt: raw.rawTextExcerpt,
          error_message: null,
        })
        .eq("id", importId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error("[import-hwpx] parse fail", err);
      await supabase
        .from("weekly_imports")
        .update({ status: "failed", error_message: msg.slice(0, 2000) })
        .eq("id", importId);

      if (err instanceof GeminiUnavailableError) {
        return NextResponse.json<ErrorResponse>(
          { error: "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요." },
          { status: 503 },
        );
      }
      return NextResponse.json<ErrorResponse>(
        { error: `주보 파싱 실패: ${msg}` },
        { status: 422 },
      );
    }

    return NextResponse.json<SuccessResponse>({ importId, result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json<ErrorResponse>(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("[import-hwpx] unexpected error", err);
    return NextResponse.json<ErrorResponse>(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
