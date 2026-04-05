import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";
import type { GroupPost } from "@/types/supabase";

export const metadata: Metadata = { title: "게시물 관리" };

export default async function AdminPostsPage() {
  const supabase = await createClient();
  const { data: posts } = (await supabase
    .from("group_posts")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false })
    .limit(50)) as { data: GroupPost[] | null };

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">게시물 관리</h1>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
              <th className="px-4 py-3 font-medium text-gray-600">제목</th>
              <th className="px-4 py-3 font-medium text-gray-600">작성자</th>
              <th className="px-4 py-3 font-medium text-gray-600">작성일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts?.map((post) => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {post.title}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {post.profiles.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {formatDate(post.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!posts || posts.length === 0) && (
          <p className="py-8 text-center text-gray-400">
            게시물이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
