import type { ContentKey } from "@/app/api/new-content/route";

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  /** 레드닷 표시를 위한 콘텐츠 키 */
  badgeKey?: ContentKey;
}

export const navItems: NavItem[] = [
  {
    label: "교회소개",
    href: "/intro",
    children: [
      { label: "인사말", href: "/greetings" },
      { label: "교회소개", href: "/intro" },
      { label: "오시는 길", href: "/map" },
    ],
  },
  {
    label: "예배",
    href: "/worship",
    children: [
      { label: "예배 안내", href: "/worship" },
      { label: "주보", href: "/weekly", badgeKey: "weeklies" },
      { label: "설교 영상", href: "/sermons", badgeKey: "sermons" },
      { label: "시간표", href: "/timetable" },
    ],
  },
  {
    label: "교회학교",
    href: "/churchschool",
    children: [
      { label: "유아부", href: "/churchschool/infant" },
      { label: "초등부", href: "/churchschool/elementary" },
      { label: "청소년부", href: "/churchschool/teen" },
      { label: "청년부", href: "/churchschool/youth" },
    ],
  },
  {
    label: "소식",
    href: "/notice",
    children: [
      { label: "공지사항", href: "/notice", badgeKey: "notices" },
      { label: "갤러리", href: "/gallery", badgeKey: "gallery" },
    ],
  },
  {
    label: "문화사역",
    href: "/ministry",
    children: [
      { label: "미용봉사", href: "/ministry/beauty" },
      { label: "탁구", href: "/ministry/tabletennis" },
      { label: "반찬사역", href: "/ministry/sidedish" },
    ],
  },
  {
    label: "커뮤니티",
    href: "/groups",
    children: [
      { label: "그룹", href: "/groups" },
      { label: "봉사", href: "/volunteer" },
    ],
  },
];
