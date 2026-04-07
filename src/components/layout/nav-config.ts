export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  /** 레드닷 표시를 위한 콘텐츠 키 */
  badgeKey?: string;
}

export const navItems: NavItem[] = [
  {
    label: "\uad50\ud68c\uc18c\uac1c",
    href: "/intro",
    children: [
      { label: "\uc778\uc0ac\ub9d0", href: "/greetings" },
      { label: "\uad50\ud68c\uc18c\uac1c", href: "/intro" },
      { label: "\uc624\uc2dc\ub294 \uae38", href: "/map" },
    ],
  },
  {
    label: "\uc608\ubc30",
    href: "/worship",
    children: [
      { label: "\uc608\ubc30 \uc548\ub0b4", href: "/worship" },
      { label: "\uc8fc\ubcf4", href: "/weekly", badgeKey: "weeklies" },
      { label: "\uc124\uad50 \uc601\uc0c1", href: "/sermons", badgeKey: "sermons" },
      { label: "\uc2dc\uac04\ud45c", href: "/timetable" },
    ],
  },
  {
    label: "\uad50\ud68c\ud559\uad50",
    href: "/churchschool",
    children: [
      { label: "\uc720\uc544\ubd80", href: "/churchschool/infant" },
      { label: "\ucd08\ub4f1\ubd80", href: "/churchschool/elementary" },
      { label: "\uccad\uc18c\ub144\ubd80", href: "/churchschool/teen" },
      { label: "\uccad\ub144\ubd80", href: "/churchschool/youth" },
    ],
  },
  {
    label: "\uc18c\uc2dd",
    href: "/notice",
    children: [
      { label: "\uacf5\uc9c0\uc0ac\ud56d", href: "/notice", badgeKey: "notices" },
      { label: "\uac24\ub7ec\ub9ac", href: "/gallery", badgeKey: "gallery" },
    ],
  },
  {
    label: "\ubb38\ud654\uc0ac\uc5ed",
    href: "/ministry",
    children: [
      { label: "\ubbf8\uc6a9\ubd09\uc0ac", href: "/ministry/beauty" },
      { label: "\ud0c1\uad6c", href: "/ministry/tabletennis" },
      { label: "\ubc18\ucc2c\uc0ac\uc5ed", href: "/ministry/sidedish" },
    ],
  },
  {
    label: "\ucee4\ubba4\ub2c8\ud2f0",
    href: "/groups",
    children: [
      { label: "\uadf8\ub8f9", href: "/groups" },
      { label: "\ubd09\uc0ac", href: "/volunteer" },
    ],
  },
];
