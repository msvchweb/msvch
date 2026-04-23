import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";

interface AdminAuthResult {
  supabase: SupabaseClient;
  userId: string;
}

/** admin UI 에 접근 가능한 역할 — admin + staff */
export const STAFF_ROLES = ["admin", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** role 이 staff 또는 admin 이면 true */
export function hasStaffAccess(
  role: string | null | undefined,
): role is StaffRole {
  return role === "admin" || role === "staff";
}

/**
 * API 라우트에서 admin UI 권한을 검증한다 (admin 또는 staff).
 * request 를 넘기면 Authorization: Bearer 헤더 기반 인증도 지원(모바일 앱 호환).
 * 실패 시 AuthError 를 throw 한다.
 *
 * 함수명은 호환성을 위해 유지하지만, 실제로는 staff 도 통과한다.
 * admin 전용 작업이 필요하면 별도 헬퍼(requireStrictAdmin 등)를 추가하라.
 */
export async function requireAdmin(
  request?: NextRequest,
): Promise<AdminAuthResult> {
  const supabase = await createApiClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("로그인이 필요합니다.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!hasStaffAccess(profile?.role)) {
    throw new AuthError("관리자 권한이 필요합니다.", 403);
  }

  return { supabase, userId: user.id };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
