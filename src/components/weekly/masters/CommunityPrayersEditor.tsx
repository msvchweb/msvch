"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CommunityPrayerRow } from "@/types/bulletin-master";
import { CommunityPrayerSchema } from "@/lib/validation";

interface Row {
  id?: string;
  seq: number;
  text: string;
}

export function CommunityPrayersEditor() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("community_prayers")
        .select("id, seq, text, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as CommunityPrayerRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, text: r.text })));
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
    if (rows.length >= 7) return;
    setRows((prev) => [...prev, { seq: prev.length + 1, text: "" }]);
  }
  async function remove(i: number) {
    const r = rows[i];
    if (r.id) {
      const { error: dbError } = await supabase.from("community_prayers").delete().eq("id", r.id);
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
      const parsed = CommunityPrayerSchema.safeParse({ seq: r.seq, text: r.text });
      if (!parsed.success) {
        setError(`#${r.seq}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        return;
      }
    }
    setSaving(true);
    const toUpsert = rows.filter((r) => r.id).map((r) => ({ id: r.id, seq: r.seq, text: r.text }));
    const toInsert = rows.filter((r) => !r.id).map((r) => ({ seq: r.seq, text: r.text }));

    if (toUpsert.length > 0) {
      const shifted = toUpsert.map((r) => ({ ...r, seq: r.seq + 1000 }));
      const r1 = await supabase.from("community_prayers").upsert(shifted, { onConflict: "id" });
      if (r1.error) {
        setError(r1.error.message);
        setSaving(false);
        return;
      }
      const r2 = await supabase.from("community_prayers").upsert(toUpsert, { onConflict: "id" });
      if (r2.error) {
        setError(r2.error.message);
        setSaving(false);
        return;
      }
    }
    if (toInsert.length > 0) {
      const r3 = await supabase.from("community_prayers").insert(toInsert);
      if (r3.error) {
        setError(r3.error.message);
        setSaving(false);
        return;
      }
      const { data } = await supabase
        .from("community_prayers")
        .select("id, seq, text, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as CommunityPrayerRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, text: r.text })));
    }
    setSaving(false);
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">최대 7개까지 표시됩니다.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            disabled={rows.length >= 7}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus size={14} /> 추가
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

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
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
            <textarea
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
              rows={2}
              value={r.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="올해 복음의 열매를 풍성히 맺는 교회와 성도들 되게 하소서"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
