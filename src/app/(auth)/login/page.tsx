"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";
import { KakaoIcon } from "@/components/icons/KakaoIcon";

type Provider = "google" | "kakao";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const supabase = createClient();

  // 미들웨어에서 리디렉트된 원래 경로
  const rawNext = searchParams.get("next") ?? "/";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const errorCode = searchParams.get("error");
  const initialError =
    errorCode === "email_exists"
      ? "이미 다른 방법으로 가입된 이메일입니다. 처음 가입하신 방법(Google 또는 카카오)으로 로그인해 주세요."
      : errorCode === "oauth"
        ? "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
        : "";

  async function handleOAuth(provider: Provider) {
    setLoading(true);
    setActiveProvider(provider);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (oauthError) {
      const label = provider === "kakao" ? "카카오" : "Google";
      setError(`${label} 로그인을 시작하지 못했습니다.`);
      setLoading(false);
      setActiveProvider(null);
    }
    // 성공 시 브라우저가 외부 OAuth 페이지로 이동하므로 여기서 중단.
  }

  const displayError = error || initialError;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/icon.png"
            alt="명성비전교회"
            width={56}
            height={56}
            priority
            className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover shadow-lg shadow-primary-500/20"
          />
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-1 text-sm text-gray-500">
            명성비전교회에 오신 것을 환영합니다
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOAuth("kakao")}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] py-3 text-sm font-medium text-[#191919] shadow-sm transition-all hover:brightness-95 hover:shadow-md disabled:opacity-50"
        >
          {loading && activeProvider === "kakao" ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : (
            <>
              <KakaoIcon size={20} />
              카카오로 계속하기
            </>
          )}
        </button>

        <div className="my-3 text-center text-xs text-gray-400">또는</div>

        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-50"
        >
          {loading && activeProvider === "google" ? (
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
