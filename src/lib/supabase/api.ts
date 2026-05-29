import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service role 클라이언트.
 *
 * RLS 우회가 필요한 무인증 공개 라우트 (챗봇, 새가족 등록 등) 와
 * cron 잡에서 공용으로 사용. 호출자가 환경변수 누락에 대해 자체 처리할 수 있도록
 * 이 함수는 누락 시 Error 를 던진다.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Supabase service role 환경변수가 누락되었습니다");
  }
  return createBareClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
