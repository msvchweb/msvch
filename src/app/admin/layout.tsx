import Link from "next/link";
import { LayoutDashboard, FileText, ImageIcon } from "lucide-react";

const adminNav = [
  { label: "대시보드", href: "/admin", icon: LayoutDashboard },
  { label: "게시물", href: "/admin/posts", icon: FileText },
  { label: "갤러리", href: "/admin/gallery", icon: ImageIcon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-60 border-r border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          관리자
        </h2>
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
