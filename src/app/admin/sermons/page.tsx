"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, Save, Loader2, Check } from "lucide-react";
import type { SermonVideo } from "@/types/youtube";

export default function AdminSermonsPage() {
  const [videos, setVideos] = useState<SermonVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/sermons")
      .then((r) => r.json())
      .then((data: SermonVideo[]) => {
        setVideos(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSummarize(sermon: SermonVideo, saveAsNotice: boolean) {
    setSummarizing(sermon.videoId);
    setSummaryResult((prev) => ({ ...prev, [sermon.videoId]: "" }));

    try {
      const res = await fetch("/api/sermon-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sermon, saveAsNotice }),
      });

      const data = await res.json() as { summary?: string; error?: string };

      if (data.error) {
        setSummaryResult((prev) => ({ ...prev, [sermon.videoId]: `오류: ${data.error}` }));
      } else if (data.summary) {
        setSummaryResult((prev) => ({ ...prev, [sermon.videoId]: data.summary ?? "" }));
        if (saveAsNotice) {
          setSaved((prev) => ({ ...prev, [sermon.videoId]: true }));
        }
      }
    } catch {
      setSummaryResult((prev) => ({
        ...prev,
        [sermon.videoId]: "오류: 요약 생성에 실패했습니다.",
      }));
    }

    setSummarizing(null);
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-400">설교 영상 로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">설교 요약</h1>
      <p className="mb-8 text-sm text-gray-500">
        AI가 설교 영상의 자막을 분석하여 요약을 생성합니다.
      </p>

      <div className="space-y-6">
        {videos.map((video) => (
          <div
            key={video.videoId}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <div className="flex gap-4 p-5">
              <div className="relative aspect-video w-48 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover"
                  sizes="192px"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{video.title}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {video.publishedAt.split("T")[0]}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleSummarize(video, false)}
                    disabled={summarizing === video.videoId}
                    className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 disabled:opacity-50"
                  >
                    {summarizing === video.videoId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    요약 생성
                  </button>
                  <button
                    onClick={() => handleSummarize(video, true)}
                    disabled={summarizing === video.videoId}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {saved[video.videoId] ? (
                      <Check size={14} />
                    ) : summarizing === video.videoId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    요약 + 공지 등록
                  </button>
                </div>
              </div>
            </div>

            {summaryResult[video.videoId] && (
              <div className="border-t border-gray-100 bg-gray-50 p-5">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">
                  요약 결과
                </h4>
                <div className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {summaryResult[video.videoId]}
                </div>
              </div>
            )}
          </div>
        ))}

        {videos.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            설교 영상이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
