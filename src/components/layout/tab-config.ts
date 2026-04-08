import { Home, Play, Images, GraduationCap, Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ContentKey } from "@/app/api/new-content/route";

export interface TabItem {
  /** 탭 고유 식별자 */
  key: string;
  /** 표시 라벨 */
  label: string;
  /** 이동 경로 */
  href: string;
  /** 아이콘 이름 (플랫폼 공용 키) */
  icon: string;
  /** 경로 매칭 시 정확히 일치해야 하는지 여부 */
  exact?: boolean;
  /** 레드닷 표시를 위한 콘텐츠 키 (하나라도 새 콘텐츠면 표시) */
  badgeKeys?: ContentKey[];
}

/** 탭 항목 — 순서가 곧 표시 순서 */
export const tabItems: TabItem[] = [
  { key: "home", label: "홈", href: "/", icon: "home", exact: true },
  { key: "sermons", label: "말씀", href: "/sermons", icon: "play", badgeKeys: ["sermons"] },
  { key: "gallery", label: "갤러리", href: "/gallery", icon: "images", badgeKeys: ["gallery"] },
  { key: "churchschool", label: "교회학교", href: "/churchschool", icon: "graduation-cap" },
  { key: "more", label: "더보기", href: "/menu", icon: "ellipsis", badgeKeys: ["gallery"] },
];

/** 탭바를 숨길 경로 접두사 */
export const hiddenPrefixes = ["/admin", "/login", "/signup"];

/** 웹 전용: 아이콘 문자열 → Lucide 컴포넌트 매핑 */
export const iconMap: Record<string, LucideIcon> = {
  home: Home,
  play: Play,
  images: Images,
  "graduation-cap": GraduationCap,
  ellipsis: Ellipsis,
};
