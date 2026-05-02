import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";
import { AdminSidebar, AdminMobileTabs, type AdminNavItem } from "./AdminNav";

const baseNav: AdminNavItem[] = [
  { label: "대시보드", href: "/admin", icon: "dashboard" },
  { label: "공지사항", href: "/admin/notices", icon: "notices" },
  { label: "주보", href: "/admin/weeklies", icon: "weeklies" },
  { label: "주보 마스터", href: "/admin/masters", icon: "masters" },
  { label: "갤러리", href: "/admin/gallery", icon: "gallery" },
  { label: "교회일정", href: "/admin/calendar", icon: "calendar" },
  { label: "일정 구독자", href: "/admin/event-subscribers", icon: "subscribers" },
  { label: "설교 요약", href: "/admin/sermons", icon: "sermons" },
  { label: "쇼츠", href: "/admin/shorts", icon: "shorts" },
  { label: "문의 내역", href: "/admin/inquiries", icon: "inquiries" },
  { label: "새가족 등록", href: "/admin/new-families", icon: "newFamily" },
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
      <AdminMobileTabs items={adminNav} />
      <AdminSidebar items={adminNav} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
