import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";

interface AdminAuthResult {
  supabase: SupabaseClient;
  userId: string;
}

/** admin UI 에 접근 가능한 역할 — admin + staff + master */
export const STAFF_ROLES = ["admin", "staff", "master"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** role 이 staff/admin/master 면 true */
export function hasStaffAccess(
  role: string | null | undefined,
): role is StaffRole {
  return role === "admin" || role === "staff" || role === "master";
}

/** role 이 master 면 true (회원관리 전용 권한) */
export function hasMasterAccess(
  role: string | null | undefined,
): role is "master" {
  return role === "master";
}

/**
 * API 라우트에서 admin UI 권한을 검증한다 (admin/staff/master).
 * request 를 넘기면 Authorization: Bearer 헤더 기반 인증도 지원(모바일 앱 호환).
 * 실패 시 AuthError 를 throw 한다.
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

/**
 * API 라우트에서 master 권한을 검증한다 (회원 권한 변경 등 master 전용 작업).
 * 실패 시 AuthError 를 throw 한다.
 */
export async function requireMaster(
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

  if (!hasMasterAccess(profile?.role)) {
    throw new AuthError("master 권한이 필요합니다.", 403);
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
