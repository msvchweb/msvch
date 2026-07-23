"use client";

import { useState } from "react";
import { WorshipResourceInputSchema, type WorshipResourceInput } from "@/lib/validation";

interface WorshipResourceFormProps {
  initial: WorshipResourceInput;
  saving: boolean;
  onSave: (value: WorshipResourceInput) => Promise<void> | void;
  onCancel?: () => void;
}

const fieldClassName = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400";

export function WorshipResourceForm({ initial, saving, onSave, onCancel }: WorshipResourceFormProps) {
  const [value, setValue] = useState<WorshipResourceInput>(initial);
  const [errors, setErrors] = useState<string[]>([]);

  function update<K extends keyof WorshipResourceInput>(key: K, next: WorshipResourceInput[K]) {
    setValue((current) => ({ ...current, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = WorshipResourceInputSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setErrors([]);
    await onSave(parsed.data);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="resource-kind" className="mb-1 block text-xs font-medium text-gray-600">종류</label>
          <select id="resource-kind" className={fieldClassName} value={value.kind} onChange={(event) => update("kind", event.target.value as WorshipResourceInput["kind"])}>
            <option value="creed">신앙고백</option>
            <option value="hymn">찬송가</option>
            <option value="scripture">성경</option>
            <option value="text">본문</option>
            <option value="link">링크</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={value.is_active} onChange={(event) => update("is_active", event.target.checked)} />
            활성 자료
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="resource-title" className="mb-1 block text-xs font-medium text-gray-600">제목</label>
        <input id="resource-title" className={fieldClassName} value={value.title} onChange={(event) => update("title", event.target.value)} maxLength={120} required />
      </div>
      <div>
        <label htmlFor="resource-reference" className="mb-1 block text-xs font-medium text-gray-600">참조</label>
        <input id="resource-reference" className={fieldClassName} value={value.reference} onChange={(event) => update("reference", event.target.value)} maxLength={200} />
      </div>
      <div>
        <label htmlFor="resource-content" className="mb-1 block text-xs font-medium text-gray-600">본문</label>
        <textarea id="resource-content" className={fieldClassName} rows={10} value={value.content} onChange={(event) => update("content", event.target.value)} maxLength={30000} />
      </div>
      <div>
        <label htmlFor="resource-url" className="mb-1 block text-xs font-medium text-gray-600">외부 URL</label>
        <input id="resource-url" type="url" className={fieldClassName} value={value.external_url ?? ""} onChange={(event) => update("external_url", event.target.value || null)} maxLength={2000} placeholder="https://" />
      </div>
      <div>
        <label htmlFor="resource-source" className="mb-1 block text-xs font-medium text-gray-600">출처</label>
        <input id="resource-source" className={fieldClassName} value={value.source_label ?? ""} onChange={(event) => update("source_label", event.target.value || null)} maxLength={200} />
      </div>
      <div>
        <label htmlFor="resource-rights" className="mb-1 block text-xs font-medium text-gray-600">권리 고지</label>
        <textarea id="resource-rights" className={fieldClassName} rows={3} value={value.rights_note ?? ""} onChange={(event) => update("rights_note", event.target.value || null)} maxLength={2000} />
      </div>

      {errors.length > 0 && (
        <div aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">취소</button>}
        <button type="submit" disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button>
      </div>
    </form>
  );
}
