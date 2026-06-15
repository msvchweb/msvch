"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Calendar,
  ImageIcon,
  Layers,
  Ellipsis,
  LayoutDashboard,
  Palette,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminBottomTabIcon =
  | "dashboard"
  | "weeklies"
  | "calendar"
  | "gallery"
  | "boards"
  | "posters"
  | "mediaBoard";

const ICONS: Record<AdminBottomTabIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  weeklies: FileText,
  calendar: Calendar,
  gallery: ImageIcon,
  boards: Layers,
  posters: Palette,
  mediaBoard: Clapperboard,
};

export interface AdminBottomTab {
  key: string;
  label: string;
  href: string;
  icon: AdminBottomTabIcon;
}

interface MoreTab {
  key: "more";
  label: string;
  href: string;
  matchPaths: string[];
}

const MORE_TAB: MoreTab = {
  key: "more",
  label: "더보기",
  href: "/admin/menu",
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
    "/admin/updates",
    "/admin/guide",
  ],
};

function pathMatches(pathname: string, target: string): boolean {
  if (target === "/admin") return pathname === "/admin";
  return pathname === target || pathname.startsWith(target + "/");
}

function isMainTabActive(pathname: string, href: string): boolean {
  return pathMatches(pathname, href);
}

function isMoreActive(
  pathname: string,
  mainHrefs: string[],
): boolean {
  if (mainHrefs.some((h) => pathMatches(pathname, h))) return false;
  return MORE_TAB.matchPaths.some((p) => pathMatches(pathname, p));
}

export function AdminBottomTabBar({ tabs }: { tabs: AdminBottomTab[] }) {
  const pathname = usePathname();
  const mainHrefs = tabs.map((t) => t.href);
  const moreActive = isMoreActive(pathname, mainHrefs);

  return (
    <nav
      aria-label="관리자 하단 탐색"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/80 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon];
          const active = isMainTabActive(pathname, tab.href);
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
        <Link
          key={MORE_TAB.key}
          href={MORE_TAB.href}
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors",
            moreActive
              ? "text-primary-600"
              : "text-gray-400 active:text-gray-600",
          )}
        >
          {moreActive && (
            <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary-600" />
          )}
          <Ellipsis size={22} strokeWidth={moreActive ? 2.2 : 1.5} />
          <span
            className={cn(
              "text-[0.625rem] leading-tight",
              moreActive ? "font-semibold" : "font-normal",
            )}
          >
            {MORE_TAB.label}
          </span>
        </Link>
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
