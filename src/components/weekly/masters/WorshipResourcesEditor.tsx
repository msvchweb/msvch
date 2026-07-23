"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorshipResource } from "@/types/mobile-bulletin";
import { WorshipResourceInputSchema, type WorshipResourceInput } from "@/lib/validation";
import { WorshipResourceForm } from "./WorshipResourceForm";

const RESOURCE_COLUMNS = "id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at";

const emptyResource: WorshipResourceInput = {
  kind: "creed", title: "", reference: "", content: "", external_url: null,
  source_label: null, rights_note: null, is_active: true,
};

function toInput(resource: WorshipResource): WorshipResourceInput {
  const { kind, title, reference, content, external_url, source_label, rights_note, is_active } = resource;
  return { kind, title, reference, content, external_url, source_label, rights_note, is_active };
}

export function WorshipResourcesEditor() {
  const supabase = useMemo(() => createClient(), []);
  const [resources, setResources] = useState<WorshipResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activity, setActivity] = useState<"active" | "inactive" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: dbError } = await supabase.from("worship_resources").select(RESOURCE_COLUMNS).order("kind", { ascending: true }).order("title", { ascending: true });
    if (dbError) setError(dbError.message);
    else setResources((data ?? []) as WorshipResource[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const selected = resources.find((resource) => resource.id === selectedId) ?? null;
  const formInitial = useMemo(
    () => selected ? toInput(selected) : emptyResource,
    [selected],
  );
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const filteredResources = resources.filter((resource) => {
    const matchesActivity = activity === "all" || (activity === "active" ? resource.is_active : !resource.is_active);
    const matchesText = !normalizedFilter || resource.title.toLocaleLowerCase().includes(normalizedFilter) || resource.reference.toLocaleLowerCase().includes(normalizedFilter);
    return matchesActivity && matchesText;
  });

  async function save(value: WorshipResourceInput) {
    setError(null);
    setSaving(true);
    const result = selected
      ? await supabase.from("worship_resources").update(value).eq("id", selected.id).select("id").single()
      : await supabase.from("worship_resources").insert(value).select("id").single();
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setSelectedId(result.data.id);
    await load();
  }

  async function deactivate(resource: WorshipResource) {
    if (!window.confirm("비활성화해도 저장된 참조는 데이터에 남아 있지만 공개 상세 동작에서는 숨겨집니다. 계속하시겠습니까?")) return;
    setError(null);
    const parsed = WorshipResourceInputSchema.safeParse({
      ...toInput(resource),
      is_active: false,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(", "));
      return;
    }
    setSaving(true);
    const { error: dbError } = await supabase.from("worship_resources").update(parsed.data).eq("id", resource.id).select("id").single();
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1"><label htmlFor="resource-search" className="mb-1 block text-xs font-medium text-gray-600">제목 또는 참조 검색</label><input id="resource-search" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
        <div><label htmlFor="resource-activity" className="mb-1 block text-xs font-medium text-gray-600">상태</label><select id="resource-activity" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={activity} onChange={(event) => setActivity(event.target.value as typeof activity)}><option value="active">활성만</option><option value="inactive">비활성만</option><option value="all">전체</option></select></div>
        <button type="button" onClick={() => { setSelectedId(null); setError(null); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">새 자료</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section aria-label="예배 자료 목록" className="space-y-2">
          {loading ? <p className="py-6 text-center text-sm text-gray-400">로딩 중...</p> : filteredResources.length === 0 ? <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">조건에 맞는 자료가 없습니다.</p> : filteredResources.map((resource) => (
            <div key={resource.id} className={`rounded-lg border p-3 ${resource.id === selectedId ? "border-primary-400 bg-primary-50" : "border-gray-200 bg-white"}`}>
              <button type="button" onClick={() => { setSelectedId(resource.id); setError(null); }} className="w-full text-left"><div className="flex items-center justify-between gap-2"><span className="font-medium text-gray-900">{resource.title}</span>{!resource.is_active && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">비활성</span>}</div><p className="mt-1 text-xs text-gray-500">{resource.kind}{resource.reference ? ` · ${resource.reference}` : ""}</p></button>
              {resource.is_active && <button type="button" onClick={() => void deactivate(resource)} disabled={saving} className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50">비활성화</button>}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{selected ? "예배 자료 수정" : "새 예배 자료"}</h2>
          <WorshipResourceForm key={selected?.id ?? "new"} initial={formInitial} saving={saving} onSave={save} onCancel={selected ? () => setSelectedId(null) : undefined} />
          {selected && <div className="mt-6 border-t border-gray-200 pt-4"><h3 className="text-sm font-semibold text-gray-800">저장된 내용 미리보기</h3><dl className="mt-3 space-y-3 text-sm text-gray-700"><div><dt className="font-medium">본문</dt><dd className="whitespace-pre-wrap">{selected.content || "-"}</dd></div><div><dt className="font-medium">출처</dt><dd className="whitespace-pre-wrap">{selected.source_label || "-"}</dd></div><div><dt className="font-medium">권리 고지</dt><dd className="whitespace-pre-wrap">{selected.rights_note || "-"}</dd></div></dl></div>}
        </section>
      </div>
    </div>
  );
}
