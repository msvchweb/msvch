"use client";

import { useEffect, useState } from "react";
import { Loader2, X, Sparkles, Calendar } from "lucide-react";
import type {
  ExtractEventsResponse,
  ExtractedEvent,
  BatchInsertResult,
} from "@/types/event-extraction";
import { ExtractedEventRow, type RowState } from "./ExtractedEventRow";

interface Props {
  weeklyId: string;
  onClose: () => void;
  onInserted?: (result: BatchInsertResult) => void;
}

type Phase = "loading" | "review" | "inserting" | "done";

export function EventExtractionModal({
  weeklyId,
  onClose,
  onInserted,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractEventsResponse | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [insertResult, setInsertResult] = useState<BatchInsertResult | null>(
    null,
  );

  useEffect(() => {
    void doExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyId]);

  async function doExtract() {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/weeklies/${weeklyId}/extract-events`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `요청 실패 (${res.status})`);
        setPhase("review");
        return;
      }
      const body = (await res.json()) as ExtractEventsResponse;
      setResult(body);
      setRows(
        body.candidates.map((c) => ({
          data: c,
          selected: c.confidence >= 0.7 && c.date !== null,
          notify: false,
        })),
      );
      setPhase("review");
    } catch (e) {
      console.error(e);
      setError("네트워크 오류가 발생했습니다.");
      setPhase("review");
    }
  }

  async function handleSubmit() {
    const selected = rows.filter(
      (r) => r.selected && r.data.date && r.data.title.trim(),
    );
    if (selected.length === 0) {
      alert("선택된 일정이 없습니다.");
      return;
    }

    setPhase("inserting");
    setError(null);
    try {
      const res = await fetch("/api/admin/calendar/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: selected.map((r) => ({
            title: r.data.title,
            description: r.data.description,
            location: r.data.location,
            date: r.data.date,
            startTime: r.data.startTime,
            endTime: r.data.endTime,
            notify: r.notify,
            sourceWeeklyId: weeklyId,
            sourceNewsIndex: r.data.sourceNewsIndex ?? undefined,
          })),
        }),
      });
      if (!res.ok && res.status !== 207) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `등록 실패 (${res.status})`);
        setPhase("review");
        return;
      }
      const body = (await res.json()) as BatchInsertResult;
      setInsertResult(body);
      setPhase("done");
      onInserted?.(body);
    } catch (e) {
      console.error(e);
      setError("네트워크 오류가 발생했습니다.");
      setPhase("review");
    }
  }

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function updateRowData(idx: number, patch: Partial<ExtractedEvent>) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, data: { ...r.data, ...patch } } : r,
      ),
    );
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:p-8">
      <div className="flex max-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">
              교회소식 → 일정 자동 추출
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 size={32} className="animate-spin text-primary-600" />
              <p className="mt-3 text-sm">AI 가 교회소식을 분석 중입니다…</p>
              <p className="mt-1 text-xs text-gray-400">평균 5~15초 소요</p>
            </div>
          )}

          {phase === "review" && (
            <div>
              {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {result && (
                <p className="mb-3 text-xs text-gray-500">
                  발행일: <strong>{result.anchorDate}</strong> · 후보{" "}
                  {result.candidates.length}건
                  {result.skipped.length > 0 && (
                    <> · 스킵 {result.skipped.length}건 (일자 정보 없음)</>
                  )}
                </p>
              )}

              {rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  추출된 일정 후보가 없습니다.
                  <br />
                  &lsquo;다시 추출&rsquo; 으로 재시도하거나 모달을 닫고 직접
                  입력해 주세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((row, i) => (
                    <ExtractedEventRow
                      key={i}
                      row={row}
                      onToggle={() =>
                        updateRow(i, { selected: !row.selected })
                      }
                      onToggleNotify={() =>
                        updateRow(i, { notify: !row.notify })
                      }
                      onChange={(patch) => updateRowData(i, patch)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === "inserting" && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 size={32} className="animate-spin text-primary-600" />
              <p className="mt-3 text-sm">일정을 등록하는 중…</p>
            </div>
          )}

          {phase === "done" && insertResult && (
            <div className="py-8 text-center">
              <Calendar size={40} className="mx-auto text-green-600" />
              <p className="mt-3 text-base font-medium text-gray-900">
                {insertResult.inserted.length}건의 일정을 등록했습니다.
              </p>
              {insertResult.skipped.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  {insertResult.skipped.length}건은 등록되지 않았습니다 (사유:{" "}
                  {insertResult.skipped[0]?.reason}…)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
          {phase === "review" && (
            <>
              <button
                type="button"
                onClick={() => void doExtract()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                다시 추출
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  선택 {selectedCount}건
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={selectedCount === 0}
                  className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-300"
                >
                  선택한 {selectedCount}건 일정 등록
                </button>
              </div>
            </>
          )}
          {phase === "done" && (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
