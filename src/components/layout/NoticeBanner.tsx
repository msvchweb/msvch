"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const NOTICE_MESSAGES: Record<string, string> = {
  no_admin: "관리자 권한이 필요한 페이지입니다.",
  no_login: "로그인이 필요합니다.",
};

function NoticeBannerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const noticeKey = searchParams.get("notice");

  useEffect(() => {
    if (!noticeKey) return;
    const text = NOTICE_MESSAGES[noticeKey];
    if (!text) return;

    setMessage(text);
    setVisible(true);

    // 5초 후 자동 닫기 + URL 에서 ?notice 제거 (뒤로가기 시 재표시 방지)
    const hideTimer = setTimeout(() => setVisible(false), 5000);
    const cleanTimer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("notice");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 5500);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(cleanTimer);
    };
  }, [noticeKey, pathname, router, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-xl backdrop-blur">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}

export function NoticeBanner() {
  return (
    <Suspense fallback={null}>
      <NoticeBannerInner />
    </Suspense>
  );
}
