"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Menu,
  X,
  ChevronDown,
  Shield,
  Church,
  PlayCircle,
  ImageIcon,
  GraduationCap,
  HandHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { navItems } from "./nav-config";
import { useNewContent } from "@/lib/new-content-provider";
import { useMe } from "@/lib/use-me";
import { AuthButton } from "./AuthButton";
import { cn } from "@/lib/utils";
import type { ContentKey } from "@/app/api/new-content/route";

/** 모바일 오버레이 상단 nav 항목별 아이콘 — 시각적 구분용 */
const navIconMap: Record<string, LucideIcon> = {
  "/greetings": Church,
  "/sermons": PlayCircle,
  "/gallery": ImageIcon,
  "/churchschool": GraduationCap,
  "/volunteer-center": HandHeart,
};

function RedDot() {
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-rose"
      />
      <span className="sr-only">(새 항목)</span>
    </>
  );
}

function hasChildBadge(
  children: typeof navItems[number]["children"],
  dots: Record<ContentKey, boolean>,
): boolean {
  if (!children) return false;
  return children.some((child) => child.badgeKey && dots[child.badgeKey]);
}

function hasBadge(
  item: typeof navItems[number],
  dots: Record<ContentKey, boolean>,
): boolean {
  return !!(item.badgeKey && dots[item.badgeKey]) || hasChildBadge(item.children, dots);
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const { dots } = useNewContent();
  const { isStaff } = useMe();

  // 라우트 변경 시 오버레이 자동 닫기 (Link onClick 누락 대비)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setOpenSubmenu(null);
  }

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 오버레이 열릴 때: body scroll lock + ESC 닫기
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200/60 bg-white/90 shadow-sm backdrop-blur-xl"
          : "bg-white/70 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/banner.avif"
            alt="명성비전교회"
            width={164}
            height={40}
            className="hidden h-9 w-auto lg:block"
          />
          <Image
            src="/images/banner.avif"
            alt="명성비전교회"
            width={164}
            height={40}
            className="h-10 w-auto lg:hidden"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex lg:items-center lg:gap-0.5">
          {navItems.map((item) => (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className="relative rounded-lg px-3.5 py-2 text-[0.9rem] font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                {item.label}
                {hasBadge(item, dots) && <RedDot />}
                <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-liturgy-brand transition-transform group-hover:scale-x-100" />
              </Link>
              {item.children && (
                <div className="invisible absolute left-1/2 top-full z-50 min-w-[180px] -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="animate-slide-down rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl shadow-gray-200/50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
                      >
                        {child.label}
                        {child.badgeKey && dots[child.badgeKey] && <RedDot />}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Desktop right: admin + auth + Instagram */}
        <div className="hidden items-center gap-1 lg:flex">
          {isStaff && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
            >
              <Shield size={16} />
              관리자
            </Link>
          )}
          <AuthButton variant="desktop" />
          <a
            href="https://www.instagram.com/msvch_main?igsh=MWhuYmg5dDQxMzhuZg=="
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:text-pink-500"
            aria-label="Instagram"
          >
            <InstagramIcon size={20} />
          </a>
        </div>

        {/* Mobile: Instagram + toggle (admin/auth 는 햄버거 메뉴 안으로) */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <a
            href="https://www.instagram.com/msvch_main?igsh=MWhuYmg5dDQxMzhuZg=="
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:text-pink-500"
            aria-label="Instagram"
          >
            <InstagramIcon size={20} />
          </a>
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            {!mobileOpen &&
              navItems.some((item) => hasBadge(item, dots)) && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-rose ring-2 ring-white"
                  />
                  <span className="sr-only">(새 항목 있음)</span>
                </>
              )}
          </button>
        </div>
      </div>

      {/* Mobile full-screen overlay — body 로 portal (header 의 backdrop-filter 가 fixed containing block 을 만드는 문제 회피) */}
      {mobileOpen && mounted && createPortal(
        <div
          className="animate-slide-down fixed inset-0 z-[100] flex flex-col bg-white lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="메뉴"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          {/* 상단 바 — 로고 + 닫기 */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-4">
            <Link href="/" onClick={closeMenu} className="flex items-center gap-2">
              <Image
                src="/images/banner.avif"
                alt="명성비전교회"
                width={164}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              aria-label="메뉴 닫기"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100"
            >
              <X size={22} />
            </button>
          </div>

          {/* 스크롤 영역 */}
          <div
            className="flex-1 overflow-y-auto px-4 pb-8 pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
          >
            {/* 인증/관리자 카드 */}
            <div className="mb-6 rounded-2xl bg-gray-50 p-2">
              {isStaff && (
                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] font-medium text-primary-700 transition-colors hover:bg-white"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                    <Shield size={18} />
                  </div>
                  관리자 페이지
                </Link>
              )}
              <div className="px-3">
                <AuthButton variant="menu" onAction={closeMenu} />
              </div>
            </div>

            {/* 메뉴 — 아이콘 + 라벨, 자식 있으면 아코디언 */}
            <nav aria-label="주요 메뉴" className="space-y-1">
              {navItems.map((item) => {
                const Icon = navIconMap[item.href];
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const isExpanded = openSubmenu === item.href;
                const itemHasBadge = hasBadge(item, dots);

                if (item.children) {
                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSubmenu(isExpanded ? null : item.href)
                        }
                        aria-expanded={isExpanded}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                          isActive
                            ? "bg-primary-50"
                            : "hover:bg-gray-50 active:bg-gray-100"
                        )}
                      >
                        {Icon && (
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              isActive
                                ? "bg-primary-100 text-primary-700"
                                : "bg-gray-100 text-gray-600"
                            )}
                          >
                            <Icon size={20} />
                          </div>
                        )}
                        <span
                          className={cn(
                            "flex-1 text-[0.95rem] font-semibold",
                            isActive ? "text-primary-700" : "text-gray-900"
                          )}
                        >
                          {item.label}
                          {itemHasBadge && <RedDot />}
                        </span>
                        <ChevronDown
                          size={18}
                          className={cn(
                            "shrink-0 text-gray-400 transition-transform duration-200",
                            isExpanded && "rotate-180 text-primary-600"
                          )}
                        />
                      </button>
                      {isExpanded && (
                        <div className="mt-1 ml-[52px] space-y-0.5 border-l border-gray-200 pl-3">
                          {item.children.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeMenu}
                                className={cn(
                                  "flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
                                  isChildActive
                                    ? "bg-primary-50 font-medium text-primary-700"
                                    : "text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                {child.label}
                                {child.badgeKey && dots[child.badgeKey] && <RedDot />}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                      isActive
                        ? "bg-primary-50"
                        : "hover:bg-gray-50 active:bg-gray-100"
                    )}
                  >
                    {Icon && (
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          isActive
                            ? "bg-primary-100 text-primary-700"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        <Icon size={20} />
                      </div>
                    )}
                    <span
                      className={cn(
                        "flex-1 text-[0.95rem] font-semibold",
                        isActive ? "text-primary-700" : "text-gray-900"
                      )}
                    >
                      {item.label}
                      {itemHasBadge && <RedDot />}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
