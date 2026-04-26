"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MokjangEntryRow } from "@/types/bulletin-master";
import { MokjangEntrySchema } from "@/lib/validation";

interface Row {
  id: number;
  name: string;
  sub: string;
  active: boolean;
}

export default function AdminMasterMokjangPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("mokjang_entries")
        .select("id, name, sub, active, updated_at")
        .order("id", { ascending: true });
      const list = (data ?? []) as MokjangEntryRow[];
      // fill 1..40 so admin edits the fixed 40-row grid
      const base: Row[] = Array.from({ length: 40 }, (_, i) => {
        const existing = list.find((r) => r.id === i + 1);
        return existing
          ? { id: existing.id, name: existing.name, sub: existing.sub, active: existing.active }
          : { id: i + 1, name: "", sub: "", active: true };
      });
      setRows(base);
      setLoading(false);
    }
    load();
  }, [supabase]);

  function markDirty(id: number) {
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    markDirty(id);
  }

  async function handleSaveAll() {
    setError(null);
    const toSave = rows.filter((r) => dirty.has(r.id));
    if (toSave.length === 0) return;

    for (const r of toSave) {
      const parsed = MokjangEntrySchema.safeParse(r);
      if (!parsed.success) {
        setError(`목장 ${r.id}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        return;
      }
    }

    setSaving(true);
    const { error: dbError } = await supabase
      .from("mokjang_entries")
      .upsert(toSave, { onConflict: "id" });
    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setDirty(new Set());
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">소그룹 목장</h1>
          <p className="mt-1 text-sm text-gray-500">
            주보 3페이지 목장 표 (최대 40목장). 빈 줄은 주보에서 &ldquo;비활성&rdquo; 처리 시 제외됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || dirty.size === 0}
          className="sticky bottom-4 z-10 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-primary-700 disabled:opacity-50 sm:static sm:shadow-none"
        >
          {saving ? "저장 중..." : `변경사항 저장 (${dirty.size})`}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">번호</th>
              <th className="px-3 py-2 text-left">목자</th>
              <th className="px-3 py-2 text-left">부목자</th>
              <th className="px-3 py-2 text-left">활성</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-1.5 w-12 font-semibold text-gray-700">{r.id}</td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                    value={r.name}
                    onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                    value={r.sub}
                    onChange={(e) => updateRow(r.id, { sub: e.target.value })}
                  />
                </td>
                <td className="px-3 py-1.5 w-16 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={r.active}
                    onChange={(e) => updateRow(r.id, { active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
