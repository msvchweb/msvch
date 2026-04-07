"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Church,
  MapPin,
  GraduationCap,
  ImageIcon,
  Scissors,
  Users,
  HandHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNewContent } from "@/lib/use-new-content";

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badgeKey?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    title: "교회소개",
    items: [
      { label: "인사말", href: "/greetings", icon: BookOpen, description: "담임목사 인사" },
      { label: "교회소개", href: "/intro", icon: Church, description: "비전과 역사" },
      { label: "오시는 길", href: "/map", icon: MapPin, description: "위치 및 교통" },
    ],
  },
  {
    title: "교회학교",
    items: [
      { label: "교회학교", href: "/churchschool", icon: GraduationCap, description: "부서별 안내" },
    ],
  },
  {
    title: "소식",
    items: [
      { label: "갤러리", href: "/gallery", icon: ImageIcon, description: "사진 모음", badgeKey: "gallery" },
    ],
  },
  {
    title: "사역",
    items: [
      { label: "문화사역", href: "/ministry", icon: Scissors, description: "미용·탁구·반찬" },
      { label: "봉사", href: "/volunteer", icon: HandHeart, description: "봉사 안내" },
      { label: "커뮤니티", href: "/groups", icon: Users, description: "그룹 활동" },
    ],
  },
];

export function MenuContent() {
  const pathname = usePathname();
  const { dots } = useNewContent(pathname);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">메뉴</h1>
      <div className="mt-6 space-y-8">
        {menuSections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <item.icon size={20} />
                    {item.badgeKey && dots[item.badgeKey] && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent-rose ring-2 ring-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
