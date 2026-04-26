"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ServantRow } from "@/types/bulletin-master";
import { ServantSchema } from "@/lib/validation";

interface Row {
  id?: string;
  seq: number;
  role: string;
  names: string;
}

export default function AdminMasterServantsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("servants")
        .select("id, seq, role, names, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as ServantRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, role: r.role, names: r.names })));
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
    // reflow seq
    next.forEach((r, idx) => (r.seq = idx + 1));
    setRows(next);
  }
  function add() {
    setRows((prev) => [...prev, { seq: prev.length + 1, role: "", names: "" }]);
  }
  async function remove(i: number) {
    const r = rows[i];
    if (r.id) {
      const { error: dbError } = await supabase.from("servants").delete().eq("id", r.id);
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
      const parsed = ServantSchema.safeParse({ seq: r.seq, role: r.role, names: r.names });
      if (!parsed.success) {
        setError(`#${r.seq}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
        return;
      }
    }
    setSaving(true);
    // seq 는 unique 이지만 재정렬 시 충돌 방지를 위해: 전체 삭제 후 insert 또는 upsert with id.
    // 여기선 id 있는 건 upsert, 없는 건 insert.
    const toUpsert = rows.filter((r) => r.id).map((r) => ({ id: r.id, seq: r.seq, role: r.role, names: r.names }));
    const toInsert = rows.filter((r) => !r.id).map((r) => ({ seq: r.seq, role: r.role, names: r.names }));

    if (toUpsert.length > 0) {
      // seq 충돌 회피: 모든 기존 항목의 seq 를 임시값으로 밀어낸 뒤 정식 값으로 다시 저장
      const shifted = toUpsert.map((r) => ({ ...r, seq: r.seq + 1000 }));
      const r1 = await supabase.from("servants").upsert(shifted, { onConflict: "id" });
      if (r1.error) {
        setError(r1.error.message);
        setSaving(false);
        return;
      }
      const r2 = await supabase.from("servants").upsert(toUpsert, { onConflict: "id" });
      if (r2.error) {
        setError(r2.error.message);
        setSaving(false);
        return;
      }
    }
    if (toInsert.length > 0) {
      const r3 = await supabase.from("servants").insert(toInsert).select("id, seq");
      if (r3.error) {
        setError(r3.error.message);
        setSaving(false);
        return;
      }
      // reload to get IDs
      const { data } = await supabase
        .from("servants")
        .select("id, seq, role, names, updated_at")
        .order("seq", { ascending: true });
      const list = (data ?? []) as ServantRow[];
      setRows(list.map((r) => ({ id: r.id, seq: r.seq, role: r.role, names: r.names })));
    }
    setSaving(false);
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">섬기는 분들</h1>
          <p className="mt-1 text-sm text-gray-500">
            주보 4페이지 좌측 &ldquo;섬기는 분들&rdquo; 역할 ↔ 이름. 여러 이름은 &ldquo;줄바꿈&rdquo;으로 구분합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => remove(i)} className="rounded p-1 text-red-400 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <input
                className="rounded border border-gray-200 px-2 py-1 text-sm"
                value={r.role}
                onChange={(e) => update(i, { role: e.target.value })}
                placeholder="담 임 목 사"
              />
              <textarea
                className="rounded border border-gray-200 px-2 py-1 text-sm"
                rows={2}
                value={r.names}
                onChange={(e) => update(i, { names: e.target.value })}
                placeholder="이양재"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
