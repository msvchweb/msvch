"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  X,
  FileUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type {
  WeeklyImportResult,
  WeeklyImportFieldKey,
  WeeklyImportRecord,
} from "@/types/weekly-import";
import {
  WEEKLY_IMPORT_FIELD_LABELS,
  IMPORT_CONFIDENCE_AUTO_ON,
  IMPORT_CONFIDENCE_WARN_BELOW,
} from "@/types/weekly-import";
import type { WeeklyContentInput } from "@/lib/validation";

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * 사용자가 검수한 항목을 폼에 patch.
   * WeeklyForm 이 setForm 으로 내려준다.
   */
  onApply: (patch: Partial<WeeklyContentInput>) => void;
}

type Phase = "idle" | "uploading" | "converting" | "parsing" | "review" | "error";

type PollResponse = WeeklyImportRecord;

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 90; // 약 3분

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 504) return "AI 응답이 너무 오래 걸려 시간이 초과되었습니다.";
  if (res.status === 502 || res.status === 503)
    return "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.";
  try {
    const text = await res.text();
    if (text.trim().startsWith("{")) {
      const parsed = JSON.parse(text) as { error?: string; hint?: string };
      if (parsed.error) {
        return parsed.hint ? `${parsed.error} (${parsed.hint})` : parsed.error;
      }
    }
  } catch {
    /* ignore */
  }
  return `${fallback} (${res.status})`;
}

function ConfidenceBadge({ value }: { value: number }) {
  if (value < IMPORT_CONFIDENCE_WARN_BELOW) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        <AlertTriangle size={10} />
        {(value * 100).toFixed(0)}%
      </span>
    );
  }
  if (value < IMPORT_CONFIDENCE_AUTO_ON) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
        {(value * 100).toFixed(0)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
      <CheckCircle2 size={10} />
      {(value * 100).toFixed(0)}%
    </span>
  );
}

function previewValue(key: WeeklyImportFieldKey, result: WeeklyImportResult): string {
  switch (key) {
    case "date":
      return result.date?.value ?? "";
    case "worshipItems":
      return result.worshipItems
        ? `${result.worshipItems.value.length}행 자동 매핑`
        : "";
    case "offerings":
      return result.offerings
        ? `${result.offerings.value.filter((o) => o.names).length}/${result.offerings.value.length}항목 채움`
        : "";
    case "dawnReadings":
      return result.dawnReadings
        ? result.dawnReadings.value.map((d) => d.passage).filter(Boolean).join(", ").slice(0, 80)
        : "";
    case "guideCommittee":
      return result.guideCommittee
        ? result.guideCommittee.value
            .map((g) => `${g.part} ${g.indoor}/${g.outdoor}`)
            .join(" · ")
        : "";
    case "nextWeekPrayer":
      return result.nextWeekPrayer
        ? result.nextWeekPrayer.value.filter(Boolean).join(" · ")
        : "";
    case "news":
      return result.news
        ? result.news.value.map((n) => n.title).join(" · ").slice(0, 120)
        : "";
    case "meetings":
      return result.meetings
        ? result.meetings.value
            .map((m) => `${m.group}@${m.place}`)
            .join(" · ")
            .slice(0, 120)
        : "";
    case "newFamily":
      return result.newFamily
        ? result.newFamily.value.map((n) => n.name).join(", ")
        : "";
    case "sermonTitle":
      return result.sermonTitle?.value ?? "";
    case "sermonPastor":
      return result.sermonPastor?.value ?? "";
  }
}

function buildPatchFromSelection(
  result: WeeklyImportResult,
  selected: Set<WeeklyImportFieldKey>,
): Partial<WeeklyContentInput> {
  const patch: Partial<WeeklyContentInput> = {};
  if (selected.has("date") && result.date) patch.date = result.date.value;
  if (selected.has("worshipItems") && result.worshipItems) {
    patch.worship_items = result.worshipItems.value;
  }
  if (selected.has("offerings") && result.offerings) {
    patch.offerings = result.offerings.value;
  }
  if (selected.has("dawnReadings") && result.dawnReadings) {
    patch.dawn_readings = result.dawnReadings.value;
  }
  if (selected.has("guideCommittee") && result.guideCommittee) {
    patch.guide_committee = result.guideCommittee.value;
  }
  if (selected.has("nextWeekPrayer") && result.nextWeekPrayer) {
    patch.next_week_prayer = result.nextWeekPrayer.value;
  }
  if (selected.has("news") && result.news) patch.news = result.news.value;
  if (selected.has("meetings") && result.meetings) patch.meetings = result.meetings.value;
  if (selected.has("newFamily") && result.newFamily) {
    patch.new_members = result.newFamily.value;
  }
  if (selected.has("sermonTitle") && result.sermonTitle) {
    patch.sermon_title = result.sermonTitle.value;
  }
  if (selected.has("sermonPastor") && result.sermonPastor) {
    patch.sermon_pastor = result.sermonPastor.value;
  }
  return patch;
}

export function WeeklyImportModal({ open, onClose, onApply }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeeklyImportResult | null>(null);
  const [selected, setSelected] = useState<Set<WeeklyImportFieldKey>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pollAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      // 닫힘 → 다음 열림 직전에 모든 상태를 초기화 (effect 안에서 setState 직접 호출 회피)
      const t = setTimeout(() => {
        setPhase("idle");
        setError(null);
        setResult(null);
        setSelected(new Set());
      }, 0);
      pollAbort.current?.abort();
      pollAbort.current = null;
      return () => clearTimeout(t);
    }
  }, [open]);

  function reset() {
    setPhase("idle");
    setError(null);
    setResult(null);
    setSelected(new Set());
  }

  function autoSelectByConfidence(r: WeeklyImportResult) {
    const next = new Set<WeeklyImportFieldKey>();
    const keys: WeeklyImportFieldKey[] = [
      "date",
      "worshipItems",
      "offerings",
      "dawnReadings",
      "guideCommittee",
      "nextWeekPrayer",
      "news",
      "meetings",
      "newFamily",
      "sermonTitle",
      "sermonPastor",
    ];
    for (const key of keys) {
      const field =
        key === "date" ? r.date :
        key === "worshipItems" ? r.worshipItems :
        key === "offerings" ? r.offerings :
        key === "dawnReadings" ? r.dawnReadings :
        key === "guideCommittee" ? r.guideCommittee :
        key === "nextWeekPrayer" ? r.nextWeekPrayer :
        key === "news" ? r.news :
        key === "meetings" ? r.meetings :
        key === "newFamily" ? r.newFamily :
        key === "sermonTitle" ? r.sermonTitle :
        r.sermonPastor;
      if (field && field.confidence >= IMPORT_CONFIDENCE_AUTO_ON) next.add(key);
    }
    setSelected(next);
  }

  async function pollUntilDone(importId: string): Promise<void> {
    pollAbort.current?.abort();
    pollAbort.current = new AbortController();
    const signal = pollAbort.current.signal;

    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (signal.aborted) return;

      const res = await fetch(`/api/admin/weeklies/imports/${importId}`, {
        signal,
      });
      if (!res.ok) {
        setPhase("error");
        setError(await readErrorMessage(res, "상태 조회 실패"));
        return;
      }
      const data = (await res.json()) as PollResponse;
      if (data.status === "parsed" && data.result) {
        setResult(data.result);
        autoSelectByConfidence(data.result);
        setPhase("review");
        return;
      }
      if (data.status === "failed") {
        setPhase("error");
        setError(data.errorMessage ?? "변환/파싱에 실패했습니다.");
        return;
      }
      if (data.status === "converting") setPhase("converting");
      else if (data.status === "parsing") setPhase("parsing");
    }
    setPhase("error");
    setError("3분 안에 변환이 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.");
  }

  async function handleFile(file: File) {
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    setPhase("uploading");
    const fd = new FormData();
    fd.append("file", file);

    if (ext === "hwpx") {
      const res = await fetch("/api/admin/weeklies/import-hwpx", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setPhase("error");
        setError(await readErrorMessage(res, "업로드 실패"));
        return;
      }
      const data = (await res.json()) as { importId: string; result: WeeklyImportResult };
      setResult(data.result);
      autoSelectByConfidence(data.result);
      setPhase("review");
      return;
    }

    if (ext === "hwp") {
      const res = await fetch("/api/admin/weeklies/import-hwp", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setPhase("error");
        setError(await readErrorMessage(res, "업로드 실패"));
        return;
      }
      const data = (await res.json()) as { importId: string; status: "converting" };
      setPhase("converting");
      await pollUntilDone(data.importId);
      return;
    }

    setPhase("error");
    setError(".hwp 또는 .hwpx 파일만 업로드할 수 있습니다.");
  }

  function toggle(key: WeeklyImportFieldKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    if (!result) return;
    const patch = buildPatchFromSelection(result, selected);
    onApply(patch);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-600" />
            <h2 className="text-base font-semibold text-gray-900">
              주보 파일에서 자동 채우기 (베타)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {phase === "idle" && (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <FileUp size={32} className="text-gray-400" />
              <p className="text-sm text-gray-600">
                한컴 주보 파일(.hwp / .hwpx)을 끌어다 놓거나 선택하세요.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                파일 선택
              </button>
              <p className="text-xs text-gray-400">
                .hwpx 권장 — 한컴오피스에서 &lsquo;다른 이름으로 저장 → .hwpx&rsquo; 한 번이면 됩니다.
                <br />
                .hwp 를 그대로 올리면 서버에서 자동 변환되며 30초~2분 소요됩니다.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".hwp,.hwpx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    handleFile(f);
                    e.target.value = "";
                  }
                }}
              />
            </div>
          )}

          {(phase === "uploading" || phase === "converting" || phase === "parsing") && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-600">
              <Loader2 size={28} className="animate-spin text-amber-500" />
              <p className="text-sm">
                {phase === "uploading" && "업로드 중..."}
                {phase === "converting" && ".hwp → .hwpx 변환 중 (30초~2분 소요)..."}
                {phase === "parsing" && "주보 내용 분석 중..."}
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-red-700">
                <AlertTriangle size={16} />
                {error}
              </div>
              <button
                onClick={reset}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                다시 시도
              </button>
            </div>
          )}

          {phase === "review" && result && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                추출된 항목 중 폼에 채울 항목을 선택하세요. 신뢰도 70% 이상은 자동으로 체크됩니다.
              </p>
              {result.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="mb-1 flex items-center gap-1 font-medium">
                    <AlertTriangle size={12} /> 경고 {result.warnings.length}건
                  </div>
                  <ul className="space-y-0.5 pl-3">
                    {result.warnings.map((w, idx) => (
                      <li key={idx}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {(Object.keys(WEEKLY_IMPORT_FIELD_LABELS) as WeeklyImportFieldKey[]).map(
                  (key) => {
                    const field =
                      key === "date" ? result.date :
                      key === "worshipItems" ? result.worshipItems :
                      key === "offerings" ? result.offerings :
                      key === "dawnReadings" ? result.dawnReadings :
                      key === "guideCommittee" ? result.guideCommittee :
                      key === "nextWeekPrayer" ? result.nextWeekPrayer :
                      key === "news" ? result.news :
                      key === "meetings" ? result.meetings :
                      key === "newFamily" ? result.newFamily :
                      key === "sermonTitle" ? result.sermonTitle :
                      result.sermonPastor;
                    if (!field) return null;
                    const preview = previewValue(key, result);
                    return (
                      <li key={key} className="flex items-start gap-3 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggle(key)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">
                              {WEEKLY_IMPORT_FIELD_LABELS[key]}
                            </span>
                            <ConfidenceBadge value={field.confidence} />
                          </div>
                          {preview && (
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {preview}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-3">
          {phase === "review" && result && (
            <div className="flex gap-2 text-xs text-gray-500">
              <button
                type="button"
                onClick={() => {
                  if (!result) return;
                  const all = new Set<WeeklyImportFieldKey>();
                  (Object.keys(WEEKLY_IMPORT_FIELD_LABELS) as WeeklyImportFieldKey[]).forEach(
                    (k) => {
                      const f =
                        k === "date" ? result.date :
                        k === "worshipItems" ? result.worshipItems :
                        k === "offerings" ? result.offerings :
                        k === "dawnReadings" ? result.dawnReadings :
                        k === "guideCommittee" ? result.guideCommittee :
                        k === "nextWeekPrayer" ? result.nextWeekPrayer :
                        k === "news" ? result.news :
                        k === "meetings" ? result.meetings :
                        k === "newFamily" ? result.newFamily :
                        k === "sermonTitle" ? result.sermonTitle :
                        result.sermonPastor;
                      if (f) all.add(k);
                    },
                  );
                  setSelected(all);
                }}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
              >
                모두 선택
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
              >
                모두 해제
              </button>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
            {phase === "review" && (
              <button
                type="button"
                onClick={apply}
                disabled={selected.size === 0}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {selected.size}개 항목 채우기
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
