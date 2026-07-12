import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";
import { PostersTabs } from "./PostersTabs";
import { OpenAIMonthlySpendBadge } from "./OpenAIMonthlySpendBadge";

export const metadata: Metadata = { title: "포스터 도구" };

export default async function AdminPostersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isMaster = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    isMaster = hasMasterAccess(profile?.role);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              포스터 도구
            </h1>
            <OpenAIMonthlySpendBadge />
          </div>
          <p className="text-sm text-gray-600">
            행사 정보를 입력해 교회 footer가 포함된 이미지를 만들고 수정한 뒤 PNG 저장 또는
            공지사항 등록까지 진행합니다.
          </p>
        </div>
        {isMaster && (
          <Link
            href="/admin/posters/logs"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-primary-300 hover:text-primary-700"
          >
            <ClipboardList size={16} />
            사용 로그
          </Link>
        )}
      </div>
      <PostersTabs />
    </div>
  );
}
