/**
 * R2 업로드/삭제 권한 판정.
 *
 * Supabase Storage 시절에는 `storage.objects` 의 RLS 가 권한을 막아줬지만
 * R2 에는 RLS 가 없다. 그래서 **기존 RLS 정책을 이 파일에서 1:1로 재현한다.**
 * 여기가 원본 정책과 어긋나면 곧바로 권한 우회 취약점이 된다.
 *
 * | prefix         | 원본 RLS                                                  | 마이그레이션 |
 * |----------------|-----------------------------------------------------------|--------------|
 * | gallery        | `is_staff()`                                              | 002 → 015    |
 * | weeklies       | `is_staff()`                                              | 003 → 015    |
 * | blog-images    | `is_staff()`                                              | 009 → 016    |
 * | poster-images  | `is_staff()`                                              | 026          |
 * | shorts         | `is_staff()` (+ service_role)                             | 005 → 015    |
 * | board-images   | 로그인 AND (`is_admin_or_master()` OR `board_members` 존재) | 025          |
 *
 * shorts 의 service_role 경로는 self-hosted 러너 스크립트가 R2 자격증명으로
 * 직접 업로드하므로 이 라우트를 타지 않는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError, requireAdmin } from "@/lib/admin-auth";
import { getViewerContext } from "@/lib/boards";
import { createApiClient } from "@/lib/supabase/api";
import type { NextRequest } from "next/server";
import type { StoragePrefix } from "@/types/storage";

/** `is_staff()` 로 충분한 prefix 들. */
const STAFF_ONLY_PREFIXES: readonly StoragePrefix[] = [
  "gallery",
  "weeklies",
  "blog-images",
  "poster-images",
  "shorts",
];

export interface StorageAuthResult {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * 해당 prefix 에 쓰기(업로드/삭제)를 해도 되는지 검증한다.
 * 실패 시 AuthError 를 던진다 (라우트에서 status 로 변환).
 */
export async function requireStorageWriteAccess(
  request: NextRequest,
  prefix: StoragePrefix,
): Promise<StorageAuthResult> {
  if (STAFF_ONLY_PREFIXES.includes(prefix)) {
    const { supabase, userId } = await requireAdmin(request);
    return { supabase, userId };
  }

  // board-images — 마이그레이션 025 정책과 동일하게 판정한다.
  const supabase = await createApiClient(request);
  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  if (!userId) {
    throw new AuthError("로그인이 필요합니다.", 401);
  }
  if (isAdminOrMaster) {
    return { supabase, userId };
  }

  const { count, error } = await supabase
    .from("board_members")
    .select("profile_id", { count: "exact", head: true })
    .eq("profile_id", userId);

  if (error) {
    throw new AuthError("권한을 확인하지 못했습니다.", 500);
  }
  if (!count || count === 0) {
    throw new AuthError("게시판 멤버만 이미지를 올릴 수 있습니다.", 403);
  }

  return { supabase, userId };
}
