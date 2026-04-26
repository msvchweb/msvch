import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "관리자 대시보드" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: noticeCount } = await supabase
    .from("notices")
    .select("*", { count: "exact", head: true });

  const { count: albumCount } = await supabase
    .from("gallery_albums")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:mb-8 sm:text-2xl">대시보드</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 회원" value={memberCount ?? 0} />
        <StatCard label="공지사항" value={noticeCount ?? 0} />
        <StatCard label="갤러리 앨범" value={albumCount ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
