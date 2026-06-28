import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hasMasterAccess } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "포스터 사용 로그" };
export const dynamic = "force-dynamic";

interface PosterUsageLogRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: "build_prompt" | "generate_image" | "revise_image";
  poster_title: string | null;
  poster_category: string | null;
  poster_ratio: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<PosterUsageLogRow["action"], string> = {
  build_prompt: "프롬프트 생성",
  generate_image: "이미지 생성",
  revise_image: "이미지 수정",
};

export default async function PosterUsageLogsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/posters/logs");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!hasMasterAccess(me?.role)) {
    redirect("/admin?notice=no_master");
  }

  const { data, error } = await supabase
    .from("poster_usage_logs")
    .select(
      "id, user_id, user_name, user_email, user_role, action, poster_title, poster_category, poster_ratio, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (data ?? []) as PosterUsageLogRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/posters"
            className="mb-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
          >
            <ArrowLeft size={14} />
            포스터 도구
          </Link>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            포스터 사용 로그
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            최근 200건의 포스터 도구 사용 기록입니다. master 계정만 볼 수 있습니다.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          로그를 불러오지 못했습니다.
        </p>
      ) : logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
          아직 기록된 사용 로그가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">시각</th>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">작업</th>
                <th className="px-4 py-3">포스터</th>
                <th className="px-4 py-3">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatKst(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {log.user_name || "(이름 없음)"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.user_email || log.user_id}
                      {log.user_role ? ` · ${log.user_role}` : ""}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700">
                      {ACTION_LABEL[log.action]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="max-w-xs truncate">
                      {log.poster_title || "-"}
                    </div>
                    {log.poster_category && (
                      <div className="text-xs text-slate-400">
                        {log.poster_category}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {log.poster_ratio || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatKst(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
