"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, FileText, Pencil, CheckCircle, Clock, Printer, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { fetchAuthorRecordMap, type ContentAuthor } from "@/lib/content-authors";
import { useMe, canDelete } from "@/lib/use-me";
import type { Weekly } from "@/types/notice";

export default function AdminWeekliesPage() {
  const me = useMe();
  const [weeklies, setWeeklies] = useState<Weekly[]>([]);
  const [authorMap, setAuthorMap] = useState<Record<string, ContentAuthor>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadWeeklies();
  }, []);

  async function loadWeeklies() {
    const { data } = await supabase
      .from("weeklies")
      .select("*")
      .order("date", { ascending: false });
    const list = (data ?? []) as Weekly[];
    setWeeklies(list);
    const map = await fetchAuthorRecordMap(
      supabase,
      "weekly",
      list.map((w) => w.id),
    );
    setAuthorMap(map);
    setLoading(false);
  }

  async function deleteWeekly(w: Weekly) {
    if (!confirm("이 주보를 삭제하시겠습니까?")) return;

    if (w.pdf_url) {
      const urlPath = new URL(w.pdf_url).pathname;
      const segment = urlPath.split("/weeklies/")[1];
      if (segment) await supabase.storage.from("weeklies").remove([segment]);
    }

    await supabase.from("weeklies").delete().eq("id", w.id);
    loadWeeklies();
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">로딩 중...</div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">주보 관리</h1>
        <Link
          href="/admin/weeklies/new"
          data-tour="weekly-new"
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          새 주보 작성
        </Link>
      </div>

      <div className="space-y-3">
        {weeklies.map((w) => (
          <div
            key={w.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="shrink-0 text-primary-500" size={20} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900">{w.title}</p>
                  {w.is_published ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
                      <CheckCircle size={10} /> 발행됨
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      <Clock size={10} /> 임시저장
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {w.date ? formatDate(w.date) : "-"}
                  {w.volume && w.issue
                    ? ` · ${w.volume}권 ${w.issue}호`
                    : ""}
                  {authorMap[w.id]?.name ? ` · 작성: ${authorMap[w.id]?.name}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Link
                href={`/admin/weeklies/${w.id}/edit`}
                className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100"
              >
                <Pencil size={14} /> 수정
              </Link>
              <Link
                href={`/weekly/${w.id}`}
                target="_blank"
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
              >
                <Globe size={14} /> 웹
              </Link>
              <Link
                href={`/weekly-print/${w.id}`}
                target="_blank"
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
              >
                <Printer size={14} /> 인쇄
              </Link>
              {canDelete(me, authorMap[w.id]?.id) && (
                <button
                  onClick={() => deleteWeekly(w)}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {weeklies.length === 0 && (
          <p className="py-12 text-center text-gray-400">주보가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
