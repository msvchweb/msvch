import Link from "next/link";
import { ChevronRight, Sparkles, Lock } from "lucide-react";
import { loadUpdates, stripMetaComments } from "@/lib/updates";

export async function UpdatesCard() {
  const items = (await loadUpdates()).slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Sparkles size={14} className="text-amber-500" />
          업데이트 노트
        </h3>
        <Link
          href="/admin/updates"
          className="flex items-center gap-0.5 text-xs font-medium text-slate-500 hover:text-primary-600"
        >
          전체
          <ChevronRight size={14} />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          아직 업데이트 노트가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((u) => {
            const preview = firstLine(stripMetaComments(u.body));
            return (
              <li key={u.date + u.title} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {u.highlight && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      NEW
                    </span>
                  )}
                  {u.staffOnly && (
                    <span
                      className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                      title="관리자에게만 표시"
                    >
                      <Lock size={10} />
                      내부
                    </span>
                  )}
                  <p className="truncate text-sm font-medium text-slate-900">
                    {u.title}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{u.date}</p>
                {preview && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{preview}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function firstLine(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    return trimmed.replace(/^[-*]\s+/, "");
  }
  return "";
}
