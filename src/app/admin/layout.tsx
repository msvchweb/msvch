import { LayoutDashboard, FileText, ImageIcon, Newspaper, Sparkles, Video, Calendar, MessageSquare, Database, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";
import { AdminSidebar, AdminMobileTabs, type AdminNavItem } from "./AdminNav";

const baseNav: AdminNavItem[] = [
  { label: "대시보드", href: "/admin", icon: LayoutDashboard },
  { label: "공지사항", href: "/admin/notices", icon: Newspaper },
  { label: "주보", href: "/admin/weeklies", icon: FileText },
  { label: "주보 마스터", href: "/admin/masters", icon: Database },
  { label: "갤러리", href: "/admin/gallery", icon: ImageIcon },
  { label: "교회일정", href: "/admin/calendar", icon: Calendar },
  { label: "설교 요약", href: "/admin/sermons", icon: Sparkles },
  { label: "쇼츠", href: "/admin/shorts", icon: Video },
  { label: "문의 내역", href: "/admin/inquiries", icon: MessageSquare },
];

const masterOnlyNav: AdminNavItem[] = [
  { label: "회원관리", href: "/admin/members", icon: Users },
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
