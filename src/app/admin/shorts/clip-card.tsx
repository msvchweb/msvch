"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import type { ShortsClip, ShortsPublication } from "@/types/shorts";
import { PublicationPanel } from "./publication-panel";
export type ShortsAction = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<void>;
export function ClipCard({
  clip,
  videoId,
  onAction,
  publications = [],
  checkedAt,
  generationActive = false,
}: {
  clip: ShortsClip;
  videoId: string;
  onAction: ShortsAction;
  publications?: ShortsPublication[];
  checkedAt?: string;
  generationActive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    title: clip.title ?? "",
    titleYt: clip.title_yt ?? clip.title ?? "",
    captionYt: clip.caption_yt ?? "",
    captionIg: clip.caption_ig ?? "",
  });
  const [category, setCategory] = useState("context"),
    [note, setNote] = useState("");
  async function act(action: "approve" | "reject" | "edit") {
    setBusy(true);
    setError("");
    try {
      await onAction(
        `/api/shorts/${clip.id}${action === "edit" ? "" : "/" + action}`,
        {
          expectedVersion: clip.content_version,
          ...(action === "edit"
            ? form
            : action === "reject"
              ? { category, note }
              : {}),
        },
        action === "edit" ? "PATCH" : "POST",
      );
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const disabled =
    busy ||
    generationActive ||
    !!clip.published_at ||
    publications.some(
      (p) =>
        p.public_request_started ||
        ["processing", "published", "needs_attention"].includes(p.status),
    );
  return (
    <div className="border-b border-gray-50 p-4 last:border-b-0 sm:p-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Play size={14} className="text-primary-600" />
            <span className="font-medium text-gray-900">
              {clip.title ?? `클립 ${clip.clip_index + 1}`}
            </span>
            <span className="text-xs text-gray-400">
              {Math.round(clip.start_sec)}~{Math.round(clip.end_sec)}초 · 완성본{" "}
              {Math.round(clip.rendered_duration_sec ?? clip.duration_sec)}초
            </span>
          </div>
          <a
            className="text-xs text-primary-600"
            href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(clip.start_sec)}s`}
            target="_blank"
            rel="noreferrer"
          >
            원본 구간 보기
          </a>
          {clip.hook && (
            <p className="mt-1 text-sm italic text-gray-500">{clip.hook}</p>
          )}
          {clip.video_url && (
            <video
              src={clip.video_url}
              controls
              className="mt-3 max-h-64 rounded-lg"
              preload="metadata"
            />
          )}
          <p className="mt-2 text-xs text-gray-600">
            선정 이유: {clip.selection_reason ?? "기록 없음"}
          </p>
          {typeof clip.selection_data?.total_score === "number" && (
            <p className="text-xs text-gray-500">
              AI 후보 평가 {clip.selection_data.total_score}/20 · 내용은 직접
              확인하세요.
            </p>
          )}
          {clip.transcript_status !== "verified" ? (
            <p className="text-xs text-amber-700">자막 미확인</p>
          ) : (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs text-gray-500"
              >
                실제 발언 {expanded ? "접기" : "보기"}
              </button>
              {expanded && (
                <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  {clip.transcript}
                </p>
              )}
            </>
          )}
          {!!clip.media_check?.warnings?.length && (
            <p className="text-xs text-amber-700">
              길이·음성 검사 경고: 영상을 재생해 싱크를 확인하세요. (
              {clip.media_check.warnings.join(", ")})
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {clip.review_status === "approved"
              ? "승인됨 · 게시 상태는 별도 확인"
              : clip.review_status === "rejected"
                ? "반려됨"
                : "검수 대기"}{" "}
            {clip.reviewer_note}
          </p>
          <button
            disabled={disabled}
            onClick={() => setEditing(!editing)}
            className="mt-2 text-xs text-primary-600"
          >
            제목·캡션 수정
          </button>
          {editing && (
            <div className="mt-2 space-y-2">
              {(["title", "titleYt", "captionYt", "captionIg"] as const).map(
                (key, i) => (
                  <label className="block text-xs" key={key}>
                    {
                      [
                        "검수 제목",
                        "YouTube 제목",
                        "YouTube 설명",
                        "Instagram 캡션",
                      ][i]
                    }
                    <textarea
                      disabled={disabled}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="block w-full rounded border p-2"
                    />
                  </label>
                ),
              )}
              <p className="text-xs text-gray-500">
                저장하면 승인이 해제됩니다.
              </p>
              <button disabled={disabled} onClick={() => void act("edit")}>
                저장
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <PublicationPanel
            clip={clip}
            publications={publications}
            onAction={onAction}
            checkedAt={checkedAt}
            disabled={busy || generationActive}
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2 text-xs">
          <button
            disabled={disabled}
            onClick={() => void act("approve")}
            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-600 disabled:opacity-50"
          >
            승인
          </button>
          <select
            aria-label="반려 분류"
            disabled={disabled}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border p-1"
          >
            {Object.entries({
              context: "문맥",
              hook: "후킹",
              subtitle: "자막",
              framing: "구도",
              sync: "싱크",
              other: "기타",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            aria-label="반려 사유"
            disabled={disabled}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            className="rounded border p-1"
            placeholder="반려 사유"
          />
          <button
            disabled={disabled}
            onClick={() => void act("reject")}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-red-600 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      </div>
    </div>
  );
}
