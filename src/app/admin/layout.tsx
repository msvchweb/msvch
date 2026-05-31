import { createClient } from "@/lib/supabase/server";
import { AdminSidebar, type AdminNavItem } from "./AdminNav";
import { AdminGroupTabs } from "./AdminGroupTabs";
import {
  AdminBottomTabBar,
  type AdminBottomTab,
} from "./AdminBottomTabBar";
import { AdminTour } from "@/components/admin/AdminTour";
import { Wrench } from "lucide-react";
import { canAccessAdminPath } from "@/lib/admin-permissions";
import { isMediaDeptMember } from "@/lib/boards";

function roleLabel(role: string | null): string {
  if (role === "master") return "최고 관리자";
  if (role === "admin") return "관리자";
  if (role === "staff") return "직원";
  return "관리자";
}

const baseNav: AdminNavItem[] = [
  { label: "대시보드", href: "/admin", icon: "dashboard" },
  { label: "공지사항", href: "/admin/notices", icon: "notices" },
  {
    label: "주보·일정",
    href: "/admin/weeklies",
    icon: "weeklies",
    matchPaths: [
      "/admin/weeklies",
      "/admin/masters",
      "/admin/calendar",
      "/admin/event-subscribers",
    ],
  },
  {
    label: "갤러리·게시판",
    href: "/admin/gallery",
    icon: "gallery",
    matchPaths: ["/admin/gallery", "/admin/boards"],
  },
  {
    label: "포스터",
    href: "/admin/posters",
    icon: "posters",
  },
  {
    label: "설교·쇼츠",
    href: "/admin/sermons",
    icon: "sermons",
    matchPaths: ["/admin/sermons", "/admin/shorts"],
  },
  {
    label: "문의·새가족",
    href: "/admin/inquiries",
    icon: "inquiries",
    matchPaths: ["/admin/inquiries", "/admin/new-families"],
  },
  { label: "회원관리", href: "/admin/members", icon: "members" },
];

const bottomTabsAll: AdminBottomTab[] = [
  { key: "weeklies", label: "주보", href: "/admin/weeklies", icon: "weeklies" },
  { key: "calendar", label: "교회일정", href: "/admin/calendar", icon: "calendar" },
  { key: "gallery", label: "갤러리", href: "/admin/gallery", icon: "gallery" },
  { key: "boards", label: "게시판", href: "/admin/boards", icon: "boards" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const adminNav = baseNav.filter((item) => canAccessAdminPath(role, item.href));

  // 미디어선교부 게시판 — admin 경로가 아니므로 권한 매트릭스가 아닌
  // 멤버십(멤버 OR admin/master)으로 직접 게이팅한다. (기존 Header 조건과 동일)
  const mediaDeptMember = await isMediaDeptMember(supabase);
  if (mediaDeptMember) {
    adminNav.push({
      label: "미디어선교부",
      href: "/media-board",
      icon: "mediaBoard",
    });
  }

  const bottomTabs = bottomTabsAll.filter((tab) =>
    canAccessAdminPath(role, tab.href),
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="flex items-center justify-center gap-1.5 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900">
        <Wrench size={12} aria-hidden />
        <span>관리자 모드 · {roleLabel(role)}</span>
      </div>
      <div className="lg:flex">
        <AdminSidebar items={adminNav} />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <AdminGroupTabs />
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
        <AdminBottomTabBar tabs={bottomTabs} />
        <AdminTour />
      </div>
    </div>
  );
}
