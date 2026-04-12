"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Video,
  Play,
  Check,
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SermonVideo } from "@/types/youtube";
import type { ShortsJobWithClips, ShortsClip, JobStatus } from "@/types/shorts";

const STATUS_LABELS: Record<
  JobStatus,
  { text: string; color: string }
> = {
  pending: { text: "대기", color: "bg-gray-100 text-gray-600" },
  downloading: { text: "다운로드 중", color: "bg-blue-50 text-blue-600" },
  transcribing: { text: "자막 추출", color: "bg-blue-50 text-blue-600" },
  selecting: { text: "하이라이트 선정", color: "bg-blue-50 text-blue-600" },
  editing: { text: "영상 편집", color: "bg-blue-50 text-blue-600" },
  ready_for_review: { text: "검수 대기", color: "bg-amber-50 text-amber-700" },
  published: { text: "발행 완료", color: "bg-emerald-50 text-emerald-700" },
  failed: { text: "실패", color: "bg-red-50 text-red-600" },
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ClipCard({
  clip,
  onApprove,
  onReject,
}: {
  clip: ShortsClip;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-50 p-5 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Play size={14} className="text-primary-600" />
            <span className="font-medium text-gray-900">
              {clip.title ?? `클립 ${clip.clip_index + 1}`}
            </span>
            <span className="text-xs text-gray-400">
              {formatTime(clip.start_sec)} ~ {formatTime(clip.end_sec)} (
              {Math.round(clip.duration_sec)}초)
            </span>
          </div>
          {clip.hook && (
            <p className="mt-1 text-sm italic text-gray-500">
              &ldquo;{clip.hook}&rdquo;
            </p>
          )}

          {clip.video_url && (
            <video
              src={clip.video_url}
              controls
              className="mt-3 max-h-64 rounded-lg"
              preload="metadata"
            />
          )}

          {clip.transcript && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                {expanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                자막 텍스트
              </button>
              {expanded && (
                <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  {clip.transcript}
                </p>
              )}
            </>
          )}
        </div>

        {clip.review_status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => onApprove(clip.id)}
              className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
            >
              <Check size={14} />
              승인
            </button>
            <button
              onClick={() => onReject(clip.id)}
              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              <X size={14} />
              반려
            </button>
          </div>
        )}
        {clip.review_status === "approved" && (
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">
            승인됨
          </span>
        )}
        {clip.review_status === "rejected" && (
          <div className="text-right">
            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
              반려됨
            </span>
            {clip.reviewer_note && (
              <p className="mt-1 text-xs text-gray-400">
                {clip.reviewer_note}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminShortsPage() {
  const [jobs, setJobs] = useState<ShortsJobWithClips[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSermonPicker, setShowSermonPicker] = useState(false);
  const [sermons, setSermons] = useState<SermonVideo[]>([]);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    const res = await fetch("/api/shorts");
    const data = (await res.json()) as ShortsJobWithClips[];
    setJobs(data);
    setLoading(false);
  }

  async function openSermonPicker() {
    if (sermons.length === 0) {
      const res = await fetch("/api/sermons");
      setSermons((await res.json()) as SermonVideo[]);
    }
    setShowSermonPicker(true);
  }

  async function triggerGeneration(sermon: SermonVideo) {
    setTriggering(true);
    const res = await fetch("/api/shorts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: sermon.videoId,
        videoTitle: sermon.title,
        videoPublishedAt: sermon.publishedAt,
        videoThumbnail: sermon.thumbnail,
      }),
    });

    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(data.error ?? "트리거 실패");
    } else {
      setShowSermonPicker(false);
      await loadJobs();
    }
    setTriggering(false);
  }

  async function handleApprove(clipId: string) {
    await fetch(`/api/shorts/${clipId}/approve`, { method: "POST" });
    await loadJobs();
  }

  async function handleReject(clipId: string) {
    const note = prompt("반려 사유를 입력하세요:");
    if (note === null) return;
    await fetch(`/api/shorts/${clipId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await loadJobs();
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">로딩 중...</div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쇼츠 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            설교 영상에서 쇼츠를 자동 생성합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadJobs(); }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <button
            onClick={openSermonPicker}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Video size={16} />
            쇼츠 생성
          </button>
        </div>
      </div>

      {showSermonPicker && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">설교 영상 선택</h3>
            <button onClick={() => setShowSermonPicker(false)}>
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {sermons.map((s) => (
              <button
                key={s.videoId}
                onClick={() => triggerGeneration(s)}
                disabled={triggering}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={s.thumbnail}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {s.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.publishedAt.split("T")[0]}
                  </p>
                </div>
                {triggering && (
                  <Loader2
                    size={16}
                    className="ml-auto animate-spin text-primary-600"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {jobs.map((job) => {
          const st = STATUS_LABELS[job.status];
          return (
            <div
              key={job.id}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-center gap-4 p-5">
                {job.video_thumbnail && (
                  <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={job.video_thumbnail}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="160px"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">
                    {job.video_title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {job.video_published_at?.split("T")[0]} &middot; 클립{" "}
                    {job.clips.length}개
                  </p>
                  {job.error && (
                    <p className="mt-1 text-xs text-red-500">{job.error}</p>
                  )}
                </div>
                <span
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${st.color}`}
                >
                  {st.text}
                </span>
              </div>

              {job.clips.length > 0 && (
                <div className="border-t border-gray-100">
                  {job.clips.map((clip) => (
                    <ClipCard
                      key={clip.id}
                      clip={clip}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {jobs.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            아직 생성된 쇼츠가 없습니다. 위 버튼으로 시작하세요.
          </p>
        )}
      </div>
    </div>
  );
}
