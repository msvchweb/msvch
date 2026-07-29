/**
 * GET /api/admin/cron/cleanup-weekly-imports
 *
 * Vercel Cron — 매일 04:00 KST (19:00 UTC).
 * 7일 초과한 weekly_imports 행과 그에 매달린 Storage 객체를 함께 삭제 (Q4=B).
 *
 * 인증: x-cron-secret 헤더 또는 Authorization: Bearer (Vercel Cron 호환).
 */

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/api";
import { timingSafeEqual } from "crypto";
import { deleteObject } from "@/lib/r2/client";
import { weeklyImportKey } from "@/lib/r2/keys";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 7;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

interface CleanupSummary {
  scanned: number;
  storage_removed: number;
  rows_removed: number;
  error?: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<CleanupSummary | { error: string }>> {
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase 환경변수 누락" },
      { status: 500 },
    );
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: selectErr } = await supabase
    .from("weekly_imports")
    .select("id, file_path, source_format")
    .lt("created_at", cutoff);

  if (selectErr) {
    return NextResponse.json(
      { error: `select 실패: ${selectErr.message}` },
      { status: 500 },
    );
  }

  const oldRows = (rows ?? []) as {
    id: string;
    file_path: string;
    source_format: "hwp" | "hwpx";
  }[];

  // 1) Storage 정리 — 원본 + (있다면) 변환된 .hwpx 모두
  const keys: string[] = [];
  for (const r of oldRows) {
    if (r.file_path) keys.push(r.file_path);
    if (r.source_format === "hwp") {
      // 변환된 .hwpx 가 같은 폴더에 있을 수 있음
      keys.push(weeklyImportKey(r.id, "hwpx"));
    }
  }
  // R2 DeleteObject 는 없는 키에도 성공을 돌려주므로 개별 실패만 세면 된다.
  let storageRemoved = 0;
  for (const key of keys) {
    try {
      await deleteObject(key);
      storageRemoved++;
    } catch (e) {
      console.error("[cleanup-weekly-imports] R2 삭제 실패", key, e);
    }
  }

  // 2) DB 행 삭제
  let rowsRemoved = 0;
  if (oldRows.length > 0) {
    const ids = oldRows.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("weekly_imports")
      .delete()
      .in("id", ids);
    if (delErr) {
      return NextResponse.json(
        {
          scanned: oldRows.length,
          storage_removed: storageRemoved,
          rows_removed: 0,
          error: `delete 실패: ${delErr.message}`,
        },
        { status: 500 },
      );
    }
    rowsRemoved = oldRows.length;
  }

  return NextResponse.json<CleanupSummary>({
    scanned: oldRows.length,
    storage_removed: storageRemoved,
    rows_removed: rowsRemoved,
  });
}
