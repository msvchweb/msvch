"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Video, X, Loader2, RefreshCw } from "lucide-react";
import type { SermonVideo } from "@/types/youtube";
import type { ShortsJobWithClips, JobStatus } from "@/types/shorts";

import { ClipCard, type ShortsAction } from "./clip-card";
import { SettingsPanel } from "./settings-panel";
const STATUS_LABELS: Record<JobStatus, { text: string; color: string }> = {
  pending: { text: "대기", color: "bg-gray-100 text-gray-600" },
  downloading: { text: "다운로드 중", color: "bg-blue-50 text-blue-600" },
  transcribing: { text: "자막 추출", color: "bg-blue-50 text-blue-600" },
  selecting: { text: "하이라이트 선정", color: "bg-blue-50 text-blue-600" },
  editing: { text: "영상 편집", color: "bg-blue-50 text-blue-600" },
  ready_for_review: { text: "검수 대기", color: "bg-amber-50 text-amber-700" },
  published: { text: "발행 완료", color: "bg-emerald-50 text-emerald-700" },
  failed: { text: "실패", color: "bg-red-50 text-red-600" },
};

export default function AdminShortsPage() {
  const [jobs, setJobs] = useState<ShortsJobWithClips[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSermonPicker, setShowSermonPicker] = useState(false);
  const [sermons, setSermons] = useState<SermonVideo[]>([]);
  const [triggering, setTriggering] = useState(false);

  const [count, setCount] = useState<5 | 10>(5),
    [error, setError] = useState(""),
    [retrying, setRetrying] = useState<string | null>(null);
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/shorts");
      if (!res.ok) throw new Error("목록을 불러오지 못했습니다.");
      setJobs(await res.json());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadJobs());
    return () => cancelAnimationFrame(frame);
  }, [loadJobs]);
  const active = jobs.some(
    (j) =>
      !!j.active_attempt_id ||
      j.publications?.some((p) =>
        ["queued", "processing", "retry_wait"].includes(p.status),
      ),
  );
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      if (timer) clearInterval(timer);
      if (document.visibilityState === "visible")
        timer = setInterval(() => void loadJobs(), 5000);
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [active, loadJobs]);
  const onAction: ShortsAction = async (url, body, method = "POST") => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "처리하지 못했습니다.");
    await loadJobs();
  };
  async function openSermonPicker() {
    try {
      const res = await fetch("/api/sermons");
      if (!res.ok) throw new Error("설교 목록을 불러오지 못했습니다.");
      setSermons(await res.json());
      setShowSermonPicker(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function triggerGeneration(sermon: SermonVideo) {
    setTriggering(true);
    try {
      await onAction("/api/shorts/trigger", {
        videoId: sermon.videoId,
        videoTitle: sermon.title,
        videoPublishedAt: sermon.publishedAt,
        videoThumbnail: sermon.thumbnail,
        count,
      });
      setShowSermonPicker(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTriggering(false);
    }
  }
  async function retry(jobId: string) {
    setRetrying(jobId);
    try {
      await onAction("/api/shorts/jobs/" + jobId + "/retry");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRetrying(null);
    }
  }
  if (loading) {
    return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            쇼츠 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            설교 영상에서 쇼츠를 자동 생성합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLoading(true);
              loadJobs();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 sm:flex-none"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <button
            onClick={openSermonPicker}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 sm:flex-none"
          >
            <Video size={16} />
            쇼츠 생성
          </button>
        </div>
      </div>

      <SettingsPanel />
      {showSermonPicker && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">설교 영상 선택</h3>
            <label className="text-sm">
              후보 수{" "}
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value) as 5 | 10)}
              >
                <option value={5}>5개</option>
                <option value={10}>10개</option>
              </select>
            </label>
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
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
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
          const attempt = job.attempts?.[0];
          return (
            <div
              key={job.id}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                {job.video_thumbnail && (
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg sm:w-40">
                    <Image
                      src={job.video_thumbnail}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(min-width: 640px) 160px, 100vw"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900">{job.video_title}</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {job.video_published_at?.split("T")[0]} &middot; 클립{" "}
                    {job.clips.length}개
                  </p>
                  {attempt && (
                    <p className="text-xs text-gray-500">
                      시도 {attempt.attempt_no} · {attempt.stage}
                      {attempt.transcription_source === "youtube_auto"
                        ? " · YouTube 자동자막 사용"
                        : ""}
                    </p>
                  )}
                  {attempt?.status === "queued" &&
                    job.checked_at &&
                    Date.parse(job.checked_at) -
                      Date.parse(attempt.created_at) >
                      90 * 60000 && (
                      <p className="text-xs text-amber-700">
                        90분 이상 대기 중입니다. 교회 PC와 Actions 대기열을
                        확인하세요.
                      </p>
                    )}
                  {!job.active_attempt_id &&
                    job.status !== "published" &&
                    job.clips.every((c) => c.review_status !== "approved") && (
                      <button
                        disabled={retrying !== null}
                        onClick={() => void retry(job.id)}
                        className="mt-2 rounded border px-3 py-1 text-xs"
                      >
                        {retrying === job.id ? "요청 중…" : "다시 제작"}
                      </button>
                    )}
                  {attempt?.status === "queued" && (
                    <button
                      disabled={retrying !== null}
                      onClick={() => {
                        setRetrying(job.id);
                        void onAction("/api/shorts/jobs/" + job.id + "/cancel")
                          .catch((e) => setError(e.message))
                          .finally(() => setRetrying(null));
                      }}
                      className="mt-2 ml-2 rounded border px-3 py-1 text-xs"
                    >
                      대기 요청 취소
                    </button>
                  )}
                  {job.error && (
                    <p className="mt-1 text-xs text-red-500">{job.error}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 self-start rounded-lg px-3 py-1.5 text-xs font-medium sm:self-auto ${st.color}`}
                >
                  {st.text}
                </span>
              </div>

              {job.clips.length > 0 && (
                <div className="border-t border-gray-100">
                  {job.clips.map((clip) => (
                    <ClipCard
                      key={clip.id + ":" + clip.content_version}
                      clip={clip}
                      videoId={job.video_id}
                      onAction={onAction}
                      publications={job.publications?.filter(
                        (p) => p.clip_id === clip.id,
                      )}
                      checkedAt={job.checked_at}
                      generationActive={!!job.active_attempt_id}
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
