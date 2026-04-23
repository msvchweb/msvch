import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * API 라우트용 Supabase 클라이언트.
 *
 * - 요청에 `Authorization: Bearer <access_token>` 헤더가 있으면 그 토큰을 사용 (모바일 앱).
 * - 없으면 쿠키 기반 세션 (웹 브라우저).
 *
 * 두 경로 모두 auth.uid() 와 RLS 가 동일하게 동작하므로,
 * 이후 모바일 앱이 생겨도 API 라우트 수정이 필요 없다.
 */
export async function createApiClient(
  request?: NextRequest,
): Promise<SupabaseClient> {
  const authHeader = request?.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    return createBareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component boundary — 쿠키 쓰기 실패 무시
          }
        },
      },
    },
  );
}
