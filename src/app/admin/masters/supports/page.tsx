"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SupportSectionRow } from "@/types/bulletin-master";
import { SupportSectionSchema } from "@/lib/validation";

interface Row {
  id?: string;
  seq: number;
  heading: string;
  lines: string[];
}

export default function AdminMasterSupportsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("support_sections")
        .select("id, seq, heading, lines, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as SupportSectionRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, heading: r.heading, lines: r.lines })));
      setLoading(false);
    }
    load();
  }, [supabase]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= rows.length) return;
    const next = [...rows];
    [next[i], next[t]] = [next[t], next[i]];
    next.forEach((r, idx) => (r.seq = idx + 1));
    setRows(next);
  }
  function add() {
    setRows((prev) => [...prev, { seq: prev.length + 1, heading: "", lines: [] }]);
  }
  async function remove(i: number) {
    const r = rows[i];
    if (r.id) {
      const { error: dbError } = await supabase.from("support_sections").delete().eq("id", r.id);
      if (dbError) {
        setError(dbError.message);
        return;
      }
    }
    setRows((prev) => prev.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, seq: idx + 1 })));
  }

  async function saveAll() {
    setError(null);
    for (const r of rows) {
      const parsed = SupportSectionSchema.safeParse({ seq: r.seq, heading: r.heading, lines: r.lines });
      if (!parsed.success) {
        setError(`#${r.seq}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        return;
      }
    }
    setSaving(true);
    const toUpsert = rows
      .filter((r) => r.id)
      .map((r) => ({ id: r.id, seq: r.seq, heading: r.heading, lines: r.lines }));
    const toInsert = rows.filter((r) => !r.id).map((r) => ({ seq: r.seq, heading: r.heading, lines: r.lines }));

    if (toUpsert.length > 0) {
      const shifted = toUpsert.map((r) => ({ ...r, seq: r.seq + 1000 }));
      const r1 = await supabase.from("support_sections").upsert(shifted, { onConflict: "id" });
      if (r1.error) {
        setError(r1.error.message);
        setSaving(false);
        return;
      }
      const r2 = await supabase.from("support_sections").upsert(toUpsert, { onConflict: "id" });
      if (r2.error) {
        setError(r2.error.message);
        setSaving(false);
        return;
      }
    }
    if (toInsert.length > 0) {
      const r3 = await supabase.from("support_sections").insert(toInsert);
      if (r3.error) {
        setError(r3.error.message);
        setSaving(false);
        return;
      }
      const { data } = await supabase
        .from("support_sections")
        .select("id, seq, heading, lines, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as SupportSectionRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, heading: r.heading, lines: r.lines })));
    }
    setSaving(false);
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">우리가 후원하는 분들</h1>
          <p className="mt-1 text-sm text-gray-500">섹션별 제목과 줄 단위 목록.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus size={14} /> 섹션 추가
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "전체 저장"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">#{r.seq}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => remove(i)} className="rounded p-1 text-red-400 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <input
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm font-semibold"
                value={r.heading}
                onChange={(e) => update(i, { heading: e.target.value })}
                placeholder="<해외선교지>"
              />
              <textarea
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                rows={4}
                value={r.lines.join("\n")}
                onChange={(e) =>
                  update(i, {
                    lines: e.target.value.split("\n").slice(0, 20),
                  })
                }
                placeholder={"명노봉(C국) / 공베드로·이선아(한국OMF)\n김동주·문희영(대만) / ..."}
              />
              <p className="text-xs text-gray-400">{r.lines.length}/20 줄</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
