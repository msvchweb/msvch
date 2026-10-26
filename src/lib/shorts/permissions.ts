import type { NextRequest } from "next/server";
import { AuthError } from "@/lib/admin-auth";
import { createApiClient } from "@/lib/supabase/api";
export function hasShortsAccess(role?: string | null) {
  return role === "staff" || role === "admin" || role === "master";
}
export async function requireShortsAdmin(request?: NextRequest) {
  const supabase = await createApiClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthError("로그인이 필요합니다.", 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!hasShortsAccess(profile?.role))
    throw new AuthError("쇼츠 관리자 권한이 필요합니다.", 403);
  return { supabase, userId: user.id };
}
