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
  Bell,
  UserPlus,
  Layers,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navTourKey } from "@/components/admin/nav-tour-keys";

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
  | "members"
  | "subscribers"
  | "newFamily"
  | "boards"
  | "posters";

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
  subscribers: Bell,
  newFamily: UserPlus,
  boards: Layers,
  posters: Palette,
};

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminIconKey;
  /** 그룹 메뉴: 이 경로들 중 하나라도 매칭되면 active. 미지정 시 href 기준 */
  matchPaths?: string[];
}

function pathMatches(pathname: string, target: string): boolean {
  if (target === "/admin") return pathname === "/admin";
  return pathname === target || pathname.startsWith(target + "/");
}

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (item.matchPaths && item.matchPaths.length > 0) {
    return item.matchPaths.some((p) => pathMatches(pathname, p));
  }
  return pathMatches(pathname, item.href);
}

/** 데스크톱 사이드바 — lg 이상에서만 표시 */
export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-300 bg-slate-200 p-4 lg:block">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
        관리자
      </h2>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={navTourKey(item.href)}
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

