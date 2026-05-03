"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Baby, BookOpen, GraduationCap, Users, Newspaper } from "lucide-react";
import { tabItems, hiddenPrefixes, iconMap } from "./tab-config";
import { useNewContent } from "@/lib/new-content-provider";
import { cn } from "@/lib/utils";

const departments = [
  { label: "영유치부", href: "/churchschool/infant", icon: Baby, color: "from-pink-500 to-rose-600" },
  { label: "아동부", href: "/churchschool/elementary", icon: BookOpen, color: "from-emerald-500 to-green-600" },
  { label: "청소년부", href: "/churchschool/teen", icon: GraduationCap, color: "from-blue-500 to-indigo-600" },
  { label: "청년부", href: "/churchschool/youth", icon: Users, color: "from-violet-500 to-purple-600" },
  { label: "교회학교 소식", href: "/churchschool/news", icon: Newspaper, color: "from-amber-500 to-orange-600" },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const { dots } = useNewContent();
  const [showDepts, setShowDepts] = useState(false);

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <>
      {/* 교회학교 부서 선택 패널 */}
      {showDepts && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          onClick={() => setShowDepts(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-x-0 bottom-14 animate-slide-up px-4 pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-lg rounded-2xl bg-white p-4 shadow-xl">
              <p className="mb-3 text-center text-sm font-semibold text-gray-700">부서 선택</p>
              <div className="grid grid-cols-5 gap-2">
                {departments.map((dept) => (
                  <Link
                    key={dept.href}
                    href={dept.href}
                    onClick={() => setShowDepts(false)}
                    className="flex flex-col items-center gap-2 rounded-xl p-2 transition active:bg-gray-100"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${dept.color} text-white shadow-sm`}>
                      <dept.icon size={20} />
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-medium text-gray-700">{dept.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭바 */}
      <nav
        aria-label="하단 탐색"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/80 bg-white/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
          {tabItems.map((tab) => {
            const Icon = iconMap[tab.icon];
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
            const hasBadge =
              tab.badgeKeys?.some((key) => dots[key]) ?? false;

            // 교회학교 탭은 패널 토글
            if (tab.key === "churchschool") {
              const isSchoolActive = pathname.startsWith("/churchschool");
              return (
                <button
                  key={tab.key}
                  onClick={() => setShowDepts(!showDepts)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors",
                    isSchoolActive || showDepts
                      ? "text-primary-600"
                      : "text-gray-400 active:text-gray-600"
                  )}
                >
                  {isSchoolActive && (
                    <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary-600" />
                  )}
                  {Icon && <Icon size={22} strokeWidth={isSchoolActive || showDepts ? 2.2 : 1.5} />}
                  <span
                    className={cn(
                      "text-[0.625rem] leading-tight",
                      isSchoolActive || showDepts ? "font-semibold" : "font-normal"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.href}
                onClick={() => setShowDepts(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors",
                  isActive
                    ? "text-primary-600"
                    : "text-gray-400 active:text-gray-600"
                )}
              >
                {isActive && (
                  <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary-600" />
                )}
                <span className="relative">
                  {Icon && (
                    <Icon size={22} strokeWidth={isActive ? 2.2 : 1.5} />
                  )}
                  {hasBadge && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-accent-rose ring-2 ring-white"
                      />
                      <span className="sr-only">(새 항목)</span>
                    </>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[0.625rem] leading-tight",
                    isActive ? "font-semibold" : "font-normal"
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
    </>
  );
}
