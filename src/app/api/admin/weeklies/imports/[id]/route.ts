/**
 * GET /api/admin/weeklies/imports/[id]
 *
 * 비동기 변환·파싱 상태 폴링용 (.hwp Phase 2 흐름).
 * 응답: WeeklyImportRecord — status / result / error 정보.
 *
 * 인증: requireAdmin + admin/master 추가 가드 (037 매트릭스와 일치).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { hasAdminAccess } from "@/lib/role-utils";
import type {
  WeeklyImportRecord,
  WeeklyImportResult,
  WeeklyImportSourceFormat,
  WeeklyImportStatus,
} from "@/types/weekly-import";

interface DbRow {
  id: string;
  file_name: string;
  source_format: WeeklyImportSourceFormat;
  status: WeeklyImportStatus;
  error_message: string | null;
  parsed_json: WeeklyImportResult | null;
  created_at: string;
  updated_at: string;
}

function toDto(row: DbRow): WeeklyImportRecord {
  return {
    id: row.id,
    fileName: row.file_name,
    sourceFormat: row.source_format,
    status: row.status,
    errorMessage: row.error_message,
    result: row.parsed_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<WeeklyImportRecord | ErrorResponse>> {
  try {
    const { supabase, userId } = await requireAdmin(request);
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

    const { id } = await params;
    const { data, error } = await supabase
      .from("weekly_imports")
      .select(
        "id, file_name, source_format, status, error_message, parsed_json, created_at, updated_at",
      )
      .eq("id", id)
      .single<DbRow>();

    if (error || !data) {
      return NextResponse.json<ErrorResponse>(
        { error: "import 행을 찾지 못했습니다." },
        { status: 404 },
      );
    }
    return NextResponse.json<WeeklyImportRecord>(toDto(data));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json<ErrorResponse>(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("[imports/[id] GET] error", err);
    return NextResponse.json<ErrorResponse>(
      { error: "서버 오류" },
      { status: 500 },
    );
  }
}
