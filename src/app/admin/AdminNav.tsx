"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ImageIcon,
  Newspaper,
  Sparkles,
  Video,
  Calendar,
  MessageSquare,
  Database,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminIconKey =
  | "dashboard"
  | "notices"
  | "weeklies"
  | "masters"
  | "gallery"
  | "calendar"
  | "sermons"
  | "shorts"
  | "inquiries"
  | "members";

const ICONS: Record<AdminIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  notices: Newspaper,
  weeklies: FileText,
  masters: Database,
  gallery: ImageIcon,
  calendar: Calendar,
  sermons: Sparkles,
  shorts: Video,
  inquiries: MessageSquare,
  members: Users,
};

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminIconKey;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

/** 데스크톱 사이드바 — lg 이상에서만 표시 */
export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-gray-50 p-4 lg:block">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
        관리자
      </h2>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-100 font-medium text-primary-700"
                  : "text-gray-700 hover:bg-gray-200",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** 모바일 상단 가로 스크롤 탭 — lg 미만에서만 표시 */
export function AdminMobileTabs({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="관리자 메뉴"
      className="sticky top-16 z-30 border-b border-gray-200 bg-white lg:hidden"
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200",
              )}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
