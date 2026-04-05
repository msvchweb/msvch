import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "관리자 대시보드" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: postCount } = await supabase
    .from("group_posts")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">대시보드</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 회원" value={memberCount ?? 0} />
        <StatCard label="그룹 게시글" value={postCount ?? 0} />
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Notion CMS</p>
          <p className="mt-2 text-sm text-gray-700">
            공지사항, 주보, 갤러리는{" "}
            <a
              href="https://notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 underline"
            >
              Notion
            </a>
            에서 관리하세요.
          </p>
        </div>
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
