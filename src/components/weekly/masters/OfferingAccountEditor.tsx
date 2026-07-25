"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OfferingAccountSchema } from "@/lib/validation";
import type { ChurchSettingRow } from "@/types/bulletin-master";

const FIELDS = [
  { key: "bank", label: "은행", placeholder: "농협", maxLength: 40 },
  { key: "number", label: "계좌번호", placeholder: "355-0068-1115-73", maxLength: 40 },
  { key: "holder", label: "예금주", placeholder: "명성비전교회", maxLength: 60 },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function OfferingAccountEditor() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<FieldKey, string>>({ bank: "", number: "", holder: "" });
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("church_settings")
        .select("key, value, updated_at")
        .eq("key", "offering_account")
        .maybeSingle();
      const row = (data as ChurchSettingRow | null) ?? null;
      const parsed = OfferingAccountSchema.safeParse(row?.value);
      if (parsed.success) {
        setValues({ bank: parsed.data.bank, number: parsed.data.number, holder: parsed.data.holder });
        setNote(parsed.data.note);
      }
      if (row?.updated_at) setSavedAt(row.updated_at);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleSave() {
    setError(null);
    const parsed = OfferingAccountSchema.safeParse({
      bank: values.bank.trim(),
      number: values.number.trim(),
      holder: values.holder.trim(),
      note: note.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(", "));
      return;
    }
    setSaving(true);
    const { error: dbError, data } = await supabase
      .from("church_settings")
      .upsert({ key: "offering_account", value: parsed.data }, { onConflict: "key" })
      .select("updated_at")
      .single();
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (data?.updated_at) setSavedAt(data.updated_at);
  }

  if (loading) return <div className="py-6 text-center text-sm text-gray-400">로딩 중...</div>;

  return (
    <div className="space-y-4">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label htmlFor={`offering-${field.key}`} className="mb-1 block text-xs font-medium text-gray-600">
            {field.label}
          </label>
          <input
            id={`offering-${field.key}`}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={values[field.key]}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
          />
        </div>
      ))}

      <div>
        <label htmlFor="offering-note" className="mb-1 block text-xs font-medium text-gray-600">
          안내 문구
        </label>
        <textarea
          id="offering-note"
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="입금자명에 이름과 헌금종류를 함께 적어주세요. 예) 박야곱십일조"
          maxLength={200}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {savedAt && !error && (
        <p className="text-xs text-gray-400">마지막 저장: {new Date(savedAt).toLocaleString("ko-KR")}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
