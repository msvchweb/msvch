"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabItems, hiddenPrefixes, iconMap } from "./tab-config";
import { useNewContent } from "@/lib/new-content-provider";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const pathname = usePathname();
  const { dots } = useNewContent();

  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
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

          return (
            <Link
              key={tab.key}
              href={tab.href}
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
  );
}
