import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth 리디렉트 콜백 (웹 전용).
 *
 * 흐름:
 *   1. Supabase 가 ?code=... 를 붙여 이 URL 로 리디렉트
 *   2. exchangeCodeForSession 으로 쿠키 세션 설정
 *   3. ?next 로 복귀, 실패 시 /login?error=oauth
 *
 * 모바일 앱은 이 라우트를 쓰지 않음 — 네이티브 SDK 로 직접 세션 획득.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";

  // open redirect 방지: 자체 도메인 내부 경로만 허용
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth code exchange failed:", error.message);
    // 트리거에서 동일 이메일 중복을 막은 경우 — 사용자에게 처음 가입 방법으로 안내
    if (error.message?.includes("EMAIL_ALREADY_REGISTERED")) {
      return NextResponse.redirect(`${origin}/login?error=email_exists`);
    }
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
