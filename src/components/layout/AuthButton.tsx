"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

interface Props {
  /**
   * desktop = 헤더 우측 pill 스타일 (gray, inline)
   * menu    = 햄버거 메뉴 안 행 스타일 (full width, 좌측 아이콘)
   */
  variant: "desktop" | "menu";
  /** menu 변형에서 액션 후 부모 메뉴를 닫기 위한 콜백 */
  onAction?: () => void;
}

export function AuthButton({ variant, onAction }: Props) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState<boolean>(false);

  // /admin · /auth 안에서는 로그아웃 후 미들웨어가 다시 /login 으로 보낼 수 있음
  // → 안전하게 / 로 폴백
  const safeNext =
    pathname.startsWith("/admin") || pathname.startsWith("/auth")
      ? "/"
      : pathname;

  async function handleLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    onAction?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
    // useMe 의 onAuthStateChange 구독으로 헤더는 즉시 갱신됨
  }

  if (variant === "desktop") {
    const cls =
      "flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200";
    if (!me.authenticated) {
      return (
        <Link
          href={`/login?next=${encodeURIComponent(safeNext)}`}
          className={cls}
          aria-label="로그인"
        >
          <LogIn size={16} />
          로그인
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className={cn(cls, "disabled:opacity-50")}
        aria-label="로그아웃"
      >
        <LogOut size={16} />
        {busy ? "..." : "로그아웃"}
      </button>
    );
  }

  // variant === "menu" — 햄버거 메뉴 행
  const menuCls =
    "flex w-full items-center gap-2 py-3 text-[0.95rem] font-medium text-gray-800";
  if (!me.authenticated) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(safeNext)}`}
        onClick={onAction}
        className={menuCls}
        aria-label="로그인"
      >
        <LogIn size={16} className="text-gray-500" />
        로그인
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={cn(menuCls, "disabled:opacity-50")}
      aria-label="로그아웃"
    >
      <LogOut size={16} className="text-gray-500" />
      {busy ? "..." : "로그아웃"}
    </button>
  );
}
