"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { navItems } from "./nav-config";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

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
                <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-primary-600 transition-transform group-hover:scale-x-100" />
              </Link>
              {item.children && (
                <div className="invisible absolute left-1/2 top-full z-50 min-w-[180px] -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="animate-slide-down rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl shadow-gray-200/50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-3.5 py-2.5 text-sm text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
                      >
                        {child.label}
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
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
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
                {item.label}
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
                      className="block rounded-md py-2 text-sm text-gray-500 transition-colors hover:text-primary-600"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
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
