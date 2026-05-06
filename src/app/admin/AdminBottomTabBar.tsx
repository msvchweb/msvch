"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Calendar,
  ImageIcon,
  Layers,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminTab {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** 활성 판정 prefix — 미지정 시 href 와 정확히 일치 */
  matchPaths?: string[];
}

const TABS: AdminTab[] = [
  { key: "weeklies", label: "주보", href: "/admin/weeklies", icon: FileText },
  { key: "calendar", label: "교회일정", href: "/admin/calendar", icon: Calendar },
  { key: "gallery", label: "갤러리", href: "/admin/gallery", icon: ImageIcon },
  { key: "boards", label: "게시판", href: "/admin/boards", icon: Layers },
  {
    key: "more",
    label: "더보기",
    href: "/admin/menu",
    icon: Ellipsis,
    matchPaths: [
      "/admin",
      "/admin/menu",
      "/admin/notices",
      "/admin/masters",
      "/admin/event-subscribers",
      "/admin/sermons",
      "/admin/shorts",
      "/admin/inquiries",
      "/admin/new-families",
      "/admin/members",
      "/admin/posters",
    ],
  },
];

function pathMatches(pathname: string, target: string): boolean {
  if (target === "/admin") return pathname === "/admin";
  return pathname === target || pathname.startsWith(target + "/");
}

function isTabActive(pathname: string, tab: AdminTab): boolean {
  if (tab.matchPaths && tab.matchPaths.length > 0) {
    // "더보기" 처럼 명시 매칭 — 다른 탭의 href 와 정확히 매칭되면 더보기는 비활성
    const otherTabHrefs = TABS.filter((t) => t.key !== tab.key).map((t) => t.href);
    if (otherTabHrefs.some((h) => pathMatches(pathname, h))) return false;
    return tab.matchPaths.some((p) => pathMatches(pathname, p));
  }
  return pathMatches(pathname, tab.href);
}

export function AdminBottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="관리자 하단 탐색"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(pathname, tab);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors",
                active
                  ? "text-primary-600"
                  : "text-gray-400 active:text-gray-600",
              )}
            >
              {active && (
                <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary-600" />
              )}
              <Icon size={22} strokeWidth={active ? 2.2 : 1.5} />
              <span
                className={cn(
                  "text-[0.625rem] leading-tight",
                  active ? "font-semibold" : "font-normal",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
