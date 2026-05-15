import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { loadUpdates, stripMetaComments } from "@/lib/updates";

export const metadata: Metadata = { title: "업데이트 노트" };
export const revalidate = 3600;

export default async function AdminUpdatesPage() {
  const items = await loadUpdates();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
        >
          <ArrowLeft size={14} />
          대시보드
        </Link>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          업데이트 노트
        </h1>
      </div>

      <p className="text-sm text-slate-600">
        루트 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">UPDATES.md</code>
        를 파싱한 결과입니다. 변경하려면 파일을 수정해 재배포하세요.
      </p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
          아직 업데이트 노트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((u) => {
            const body = stripMetaComments(u.body);
            return (
              <li
                key={u.date + u.title}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">{u.date}</span>
                  {u.highlight && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <Sparkles size={10} />
                      NEW
                    </span>
                  )}
                  {u.staffOnly && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      <Lock size={10} />
                      내부
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">
                  {u.title}
                </h2>
                {body && (
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-700">
                    {body}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
