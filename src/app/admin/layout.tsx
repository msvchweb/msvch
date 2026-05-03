import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";
import { AdminSidebar, type AdminNavItem } from "./AdminNav";
import { AdminGroupTabs } from "./AdminGroupTabs";
import { AdminBottomTabBar } from "./AdminBottomTabBar";

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
];

const masterOnlyNav: AdminNavItem[] = [
  { label: "회원관리", href: "/admin/members", icon: "members" },
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

  const adminNav = hasMasterAccess(role)
    ? [...baseNav, ...masterOnlyNav]
    : baseNav;

  return (
    <div className="lg:flex lg:min-h-[calc(100vh-4rem)]">
      <AdminSidebar items={adminNav} />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        <AdminGroupTabs />
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <AdminBottomTabBar />
    </div>
  );
}
