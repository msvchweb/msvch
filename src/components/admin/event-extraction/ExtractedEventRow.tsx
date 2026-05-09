"use client";

import { useState } from "react";
import { Bell, BellOff, ChevronUp, Edit3 } from "lucide-react";
import type { ExtractedEvent } from "@/types/event-extraction";

export interface RowState {
  data: ExtractedEvent;
  selected: boolean;
  notify: boolean;
}

interface Props {
  row: RowState;
  onToggle: () => void;
  onToggleNotify: () => void;
  onChange: (patch: Partial<ExtractedEvent>) => void;
}

const inputCls =
  "block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none";

export function ExtractedEventRow({
  row,
  onToggle,
  onToggleNotify,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const { data, selected, notify } = row;
  const lowConfidence = data.confidence < 0.6;
  const noDate = data.date === null;

  return (
    <div
      className={`rounded-lg border ${
        selected
          ? "border-primary-300 bg-primary-50/30"
          : "border-gray-200 bg-white"
      } p-3`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={noDate}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-medium text-gray-900">
              {data.title || (
                <span className="italic text-gray-400">제목 없음</span>
              )}
            </p>
            <ConfidenceBadge confidence={data.confidence} />
            {noDate && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                날짜 누락 — 편집 필요
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {data.date ?? "—"}
            {data.startTime ? ` ${data.startTime}` : ""}
            {data.endTime ? ` ~ ${data.endTime}` : ""}
            {data.location ? ` · ${data.location}` : ""}
          </p>
          {data.sourceQuote && (
            <p className="mt-1 text-[11px] text-gray-400">
              ▶ &ldquo;{data.sourceQuote}&rdquo;
              {data.sourceNewsIndex !== null && (
                <> (소식 #{data.sourceNewsIndex + 1})</>
              )}
            </p>
          )}
          {data.rruleHint && (
            <p className="mt-1 text-[11px] text-blue-600">
              반복 일정 힌트: {data.rruleHint} (v1 은 첫 발생만 등록)
            </p>
          )}
          {lowConfidence && (
            <p className="mt-1 text-[11px] text-amber-700">
              ⚠ 신뢰도 낮음 — 원문을 확인하고 편집해 주세요
            </p>
          )}

          {editing && (
            <div className="mt-3 grid gap-2 rounded border border-gray-200 bg-gray-50 p-2 sm:grid-cols-2">
              <label className="text-xs">
                <span className="block text-gray-600">제목</span>
                <input
                  className={inputCls}
                  value={data.title}
                  onChange={(e) => onChange({ title: e.target.value })}
                  maxLength={200}
                />
              </label>
              <label className="text-xs">
                <span className="block text-gray-600">날짜 *</span>
                <input
                  type="date"
                  className={inputCls}
                  value={data.date ?? ""}
                  onChange={(e) => onChange({ date: e.target.value || null })}
                />
              </label>
              <label className="text-xs">
                <span className="block text-gray-600">시작 시간</span>
                <input
                  type="time"
                  className={inputCls}
                  value={data.startTime ?? ""}
                  onChange={(e) =>
                    onChange({ startTime: e.target.value || null })
                  }
                />
              </label>
              <label className="text-xs">
                <span className="block text-gray-600">종료 시간 (선택)</span>
                <input
                  type="time"
                  className={inputCls}
                  value={data.endTime ?? ""}
                  onChange={(e) =>
                    onChange({ endTime: e.target.value || null })
                  }
                />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="block text-gray-600">장소</span>
                <input
                  className={inputCls}
                  value={data.location ?? ""}
                  onChange={(e) =>
                    onChange({ location: e.target.value || null })
                  }
                  maxLength={200}
                />
              </label>
              <label className="text-xs sm:col-span-2">
                <span className="block text-gray-600">설명</span>
                <textarea
                  className={`${inputCls} min-h-[3rem]`}
                  value={data.description ?? ""}
                  onChange={(e) =>
                    onChange({ description: e.target.value || null })
                  }
                  maxLength={1000}
                  rows={2}
                />
              </label>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
          >
            {editing ? <ChevronUp size={12} /> : <Edit3 size={12} />}
            {editing ? "닫기" : "편집"}
          </button>
          <button
            type="button"
            onClick={onToggleNotify}
            disabled={!selected}
            title="알림톡 발송 대상"
            className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${
              notify
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-gray-200 text-gray-500"
            } disabled:opacity-40`}
          >
            {notify ? <Bell size={12} /> : <BellOff size={12} />}
            알림톡
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    confidence >= 0.8
      ? "bg-green-100 text-green-700"
      : confidence >= 0.6
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      신뢰도 {pct}%
    </span>
  );
}
