"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const supabase = createClient();

  // 미들웨어에서 리디렉트된 원래 경로
  const rawNext = searchParams.get("next") ?? "/";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const initialError =
    searchParams.get("error") === "oauth"
      ? "Google 로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
      : "";

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError("Google 로그인을 시작하지 못했습니다.");
      setLoading(false);
    }
    // 성공 시 브라우저가 accounts.google.com 으로 이동하므로 여기서 중단.
  }

  const displayError = error || initialError;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-xl font-bold text-white shadow-lg shadow-primary-500/20">
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-1 text-sm text-gray-500">
            명성비전교회에 오신 것을 환영합니다
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-50"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          ) : (
            <>
              <GoogleGIcon size={20} />
              Google 계정으로 계속하기
            </>
          )}
        </button>

        {displayError && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {displayError}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          로그인하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
