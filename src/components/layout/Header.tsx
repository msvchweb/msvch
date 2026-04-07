"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-config";
import { useNewContent } from "@/lib/use-new-content";
import { cn } from "@/lib/utils";

function RedDot() {
  return (
    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-rose" />
  );
}

/** 네비 항목(부모 포함) 중 하나라도 새 콘텐츠가 있는지 확인 */
function hasChildBadge(
  children: typeof navItems[number]["children"],
  dots: Record<string, boolean>,
): boolean {
  if (!children) return false;
  return children.some((child) => child.badgeKey && dots[child.badgeKey]);
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { dots } = useNewContent(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
            width={48}
            height={48}
            className="rounded-lg"
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
                {hasChildBadge(item.children, dots) && <RedDot />}
                <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-primary-600 transition-transform group-hover:scale-x-100" />
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

        {/* Mobile toggle */}
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          {!mobileOpen &&
            navItems.some((item) => hasChildBadge(item.children, dots)) && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-rose ring-2 ring-white" />
            )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="animate-slide-down border-t border-gray-100 bg-white px-4 pb-6 pt-4 lg:hidden">
          {navItems.map((item) => (
            <div key={item.href} className="border-b border-gray-50 last:border-0">
              <button
                onClick={() =>
                  setOpenSubmenu(openSubmenu === item.href ? null : item.href)
                }
                className="flex w-full items-center justify-between py-3 text-[0.95rem] font-medium text-gray-800"
              >
                <span className="flex items-center">
                  {item.label}
                  {hasChildBadge(item.children, dots) && <RedDot />}
                </span>
                {item.children && (
                  <ChevronDown
                    size={16}
                    className={cn(
                      "text-gray-400 transition-transform duration-200",
                      openSubmenu === item.href && "rotate-180 text-primary-600"
                    )}
                  />
                )}
              </button>
              {item.children && openSubmenu === item.href && (
                <div className="mb-3 ml-1 space-y-0.5 border-l-2 border-primary-100 pl-4">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="flex items-center rounded-md py-2 text-sm text-gray-500 transition-colors hover:text-primary-600"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                      {child.badgeKey && dots[child.badgeKey] && <RedDot />}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
