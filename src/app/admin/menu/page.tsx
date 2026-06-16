import Link from "next/link";
import {
  LayoutDashboard,
  Newspaper,
  FileText,
  Database,
  Calendar,
  Bell,
  ImageIcon,
  Layers,
  Sparkles,
  Video,
  MessageSquare,
  UserPlus,
  Users,
  Palette,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canAccessAdminPath } from "@/lib/admin-permissions";
import { isMediaDeptMember } from "@/lib/boards";
import { navTourKey } from "@/components/admin/nav-tour-keys";

interface MenuItem {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const allGroups: MenuGroup[] = [
  {
    title: "대시보드",
    items: [
      {
        label: "대시보드",
        href: "/admin",
        description: "관리자 홈",
        icon: LayoutDashboard,
      },
      {
        label: "공지사항",
        href: "/admin/notices",
        description: "공지 작성·관리",
        icon: Newspaper,
      },
    ],
  },
  {
    title: "주보·일정",
    items: [
      {
        label: "주보",
        href: "/admin/weeklies",
        description: "주간 주보 등록",
        icon: FileText,
      },
      {
        label: "주보 마스터",
        href: "/admin/masters",
        description: "주보 항목 마스터 관리",
        icon: Database,
      },
      {
        label: "교회일정",
        href: "/admin/calendar",
        description: "행사·이벤트",
        icon: Calendar,
      },
      {
        label: "일정 구독자",
        href: "/admin/event-subscribers",
        description: "알림톡 구독자 관리",
        icon: Bell,
      },
    ],
  },
  {
    title: "갤러리·게시판",
    items: [
      {
        label: "갤러리",
        href: "/admin/gallery",
        description: "사진 앨범 관리",
        icon: ImageIcon,
      },
      {
        label: "소모임 게시판",
        href: "/admin/boards",
        description: "그룹별 게시판",
        icon: Layers,
      },
    ],
  },
  {
    title: "포스터",
    items: [
      {
        label: "포스터",
        href: "/admin/posters",
        description: "AI 로 행사·공지 포스터 생성",
        icon: Palette,
      },
    ],
  },
  {
    title: "설교·쇼츠",
    items: [
      {
        label: "설교 요약",
        href: "/admin/sermons",
        description: "설교 콘텐츠",
        icon: Sparkles,
      },
      {
        label: "쇼츠",
        href: "/admin/shorts",
        description: "쇼츠 영상",
        icon: Video,
      },
    ],
  },
  {
    title: "문의·새가족",
    items: [
      {
        label: "문의 내역",
        href: "/admin/inquiries",
        description: "사용자 문의",
        icon: MessageSquare,
      },
      {
        label: "새가족 등록",
        href: "/admin/new-families",
        description: "새가족 신청 내역",
        icon: UserPlus,
      },
    ],
  },
  {
    title: "회원관리",
    items: [
      {
        label: "회원관리",
        href: "/admin/members",
        description: "권한·역할 관리",
        icon: Users,
      },
    ],
  },
];

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    role = profile?.role ?? null;
  }

  const groups = allGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => canAccessAdminPath(role, it.href)),
    }))
    .filter((g) => g.items.length > 0);

  // 미디어선교부 게시판 — 권한 매트릭스가 아닌 멤버십(멤버 OR admin/master)으로
  // 게이팅. (사이드바·기존 Header 조건과 동일)
  if (await isMediaDeptMember(supabase)) {
    groups.push({
      title: "미디어선교부",
      items: [
        {
          label: "미디어선교부",
          href: "/admin/media-board",
          description: "미디어선교부 전용 게시판",
          icon: Clapperboard,
        },
      ],
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">
        전체 메뉴
      </h1>
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.title}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={navTourKey(item.href)}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <item.icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
