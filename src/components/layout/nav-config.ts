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
    href: "/greetings",
    children: [
      { label: "인사말", href: "/greetings" },
      { label: "공지사항", href: "/notice", badgeKey: "notices" },
      { label: "예배안내", href: "/worship" },
      { label: "섬기는 이들", href: "/staff" },
      { label: "찾아오시는 길", href: "/map" },
      { label: "주보", href: "/weekly", badgeKey: "weeklies" },
    ],
  },
  {
    label: "말씀영상",
    href: "/sermons",
    badgeKey: "sermons",
  },
  {
    label: "비전갤러리",
    href: "/gallery",
    badgeKey: "gallery",
  },
  {
    label: "교회학교",
    href: "/churchschool",
    children: [
      { label: "영유치부", href: "/churchschool/infant" },
      { label: "아동부", href: "/churchschool/elementary" },
      { label: "청소년부", href: "/churchschool/teen" },
      { label: "청년부", href: "/churchschool/youth" },
    ],
  },
  {
    label: "봉사센터",
    href: "/volunteer-center",
    children: [
      { label: "사랑의 반찬나눔", href: "/volunteer-center/sidedish" },
      { label: "사랑의 이미용봉사", href: "/volunteer-center/beauty" },
      { label: "비전문화학교", href: "/volunteer-center/culture" },
      { label: "탁구교실", href: "/volunteer-center/tabletennis" },
    ],
  },
];
