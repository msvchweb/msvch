"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChurchSettingTopicSchema } from "@/lib/validation";
import type { ChurchSettingRow, TopicOfYearValue } from "@/types/bulletin-master";

export default function AdminMasterTopicPage() {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("church_settings")
        .select("key, value, updated_at")
        .eq("key", "topic_of_year")
        .maybeSingle();
      const row = (data as ChurchSettingRow | null) ?? null;
      if (row && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
        const v = row.value as Partial<TopicOfYearValue>;
        if (typeof v.text === "string") setText(v.text);
        if (typeof v.year === "number") setYear(v.year);
        if (row.updated_at) setSavedAt(row.updated_at);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleSave() {
    setError(null);
    const parsed = ChurchSettingTopicSchema.safeParse({ text: text.trim(), year });
    if (!parsed.success) {
      setError(parsed.error.issues.map((e) => e.message).join(", "));
      return;
    }
    setSaving(true);
    const { error: dbError, data } = await supabase
      .from("church_settings")
      .upsert(
        { key: "topic_of_year", value: parsed.data },
        { onConflict: "key" },
      )
      .select("updated_at")
      .single();
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (data?.updated_at) setSavedAt(data.updated_at);
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div className="max-w-xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">올해의 표어</h1>
        <p className="mt-1 text-sm text-gray-500">
          주보 1페이지 우측 하단 &ldquo;○년 표어&rdquo; 영역에 표시됩니다.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">표어 문구</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="복음의 열매"
            maxLength={80}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">연도</label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {savedAt && !error && (
          <p className="text-xs text-gray-400">
            마지막 저장: {new Date(savedAt).toLocaleString("ko-KR")}
          </p>
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
    </div>
  );
}
