"use client";

import { useState } from "react";
import { X, AlertTriangle, Loader2, Eye, Pencil } from "lucide-react";
import { MeetingNoteContent } from "@/components/ui/MeetingNoteContent";
import type { MediaImportResult } from "@/types/media-board";

/**
 * 회의록 import 검수 모달.
 * MediaImportResult 를 받아 제목/본문을 수정하고, 미리보기를 확인한 뒤 등록한다.
 * 등록은 부모(MediaPostForm)의 onSubmit 이 기존 POST /api/boards/[id]/posts 로 전송.
 * (자동 저장 안 함 — 사용자 명시적 확정 필요)
 */
export function ImportReviewModal({
  result,
  onCancel,
  onSubmit,
}: {
  result: MediaImportResult;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    content: string;
    images: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(result.suggestedTitle);
  const [content, setContent] = useState(result.markdown);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (title.trim().length === 0 || content.trim().length === 0) {
      alert("제목과 본문을 입력하세요.");
      return;
    }
    setSubmitting(true);
    await onSubmit({ title, content, images: result.imageUrls });
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="회의록 검수"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">회의록 검수</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              문단 {result.stats.paragraphs} · 표 {result.stats.tables} · 그림{" "}
              {result.stats.images}
              {result.aiApplied ? " · AI 정리 적용됨" : " · 원문 사용"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 경고 */}
        {result.warnings.length > 0 && (
          <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-3">
            <div className="flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <ul className="space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex shrink-0 gap-1 border-b border-gray-100 px-5 pt-3">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === "edit"
                ? "border-b-2 border-primary-600 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil size={14} />
            수정
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === "preview"
                ? "border-b-2 border-primary-600 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye size={14} />
            미리보기
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "edit" ? (
            <>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                제목
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <label className="mb-1 block text-xs font-medium text-gray-500">
                본문 (마크다운 — 표·[IMG:...] 마커 유지)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                maxLength={30000}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-primary-500 focus:outline-none"
              />
            </>
          ) : (
            <article>
              <h1 className="mb-4 text-lg font-bold text-gray-900">
                {title || "(제목 없음)"}
              </h1>
              <MeetingNoteContent content={content} title={title} />
            </article>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            게시판에 등록
          </button>
        </div>
      </div>
    </div>
  );
}
