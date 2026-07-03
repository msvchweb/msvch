"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  href: string;
}

interface TabGroup {
  /** 이 그룹에 속하는 경로 prefix (active 판정 + 그룹 식별) */
  matchPaths: string[];
  tabs: TabItem[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    matchPaths: [
      "/admin/weeklies",
      "/admin/masters",
      "/admin/calendar",
      "/admin/event-subscribers",
    ],
    tabs: [
      { label: "주보", href: "/admin/weeklies" },
      { label: "주보 마스터", href: "/admin/masters" },
      { label: "교회일정", href: "/admin/calendar" },
      { label: "일정 구독자", href: "/admin/event-subscribers" },
    ],
  },
  {
    matchPaths: ["/admin/gallery", "/admin/boards"],
    tabs: [
      { label: "갤러리", href: "/admin/gallery" },
      { label: "소모임 게시판", href: "/admin/boards" },
    ],
  },
  {
    matchPaths: ["/admin/sermons", "/admin/shorts"],
    tabs: [
      { label: "설교 요약", href: "/admin/sermons" },
      { label: "쇼츠", href: "/admin/shorts" },
    ],
  },
  {
    matchPaths: [
      "/admin/inquiries",
      "/admin/new-families",
      "/admin/myeongbi-prayers",
    ],
    tabs: [
      { label: "문의 내역", href: "/admin/inquiries" },
      { label: "새가족 등록", href: "/admin/new-families" },
      { label: "명비 기도인", href: "/admin/myeongbi-prayers" },
    ],
  },
];

function pathMatches(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(target + "/");
}

/** admin 페이지 상단 — 그룹된 메뉴에 진입한 경우 탭을 노출, 아니면 null */
export function AdminGroupTabs() {
  const pathname = usePathname();
  const group = TAB_GROUPS.find((g) =>
    g.matchPaths.some((p) => pathMatches(pathname, p)),
  );
  if (!group) return null;

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {group.tabs.map((tab) => {
          const active = pathMatches(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 border-b-2 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:text-gray-900",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
