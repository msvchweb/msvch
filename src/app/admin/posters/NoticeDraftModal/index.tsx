"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2, Check, AlertCircle, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { renderPoster, preloadFooterAssets } from "@/lib/poster-footer";
import type { SharedPosterData } from "../PostersTabs";
import type { PosterRatio } from "@/lib/poster-prompts";
import { useRouter } from "next/navigation";

interface NoticeDraft {
  title: string;
  content: string;
  category: string;
}

interface NoticeDraftModalProps {
  sharedData: SharedPosterData;
  bgImg: HTMLImageElement;
  textSettings: any;
  showFooter: boolean;
  onClose: () => void;
}

export function NoticeDraftModal({
  sharedData,
  bgImg,
  textSettings,
  showFooter,
  onClose,
}: NoticeDraftModalProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<NoticeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mainPreviewRef = useRef<HTMLCanvasElement>(null);
  const thumbPreviewRef = useRef<HTMLCanvasElement>(null);
  const footerAssetsRef = useRef<any>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchDraft();
    initAssets();
  }, []);

  async function initAssets() {
    try {
      footerAssetsRef.current = await preloadFooterAssets();
      drawPreviews();
    } catch (e) {
      console.error("Footer assets load failed", e);
    }
  }

  useEffect(() => {
    if (draft && !loading) {
      drawPreviews();
    }
  }, [draft, loading]);

  async function fetchDraft() {
    try {
      const res = await fetch("/api/admin/posters/draft-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sharedData.fullInput),
      });
      if (!res.ok) throw new Error("초안 생성 실패");
      const data = await res.json();
      setDraft(data);
    } catch (err) {
      setError("AI 초안을 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function drawPreviews() {
    // 1) 메인 포스터 (사용자 설정 비율)
    if (mainPreviewRef.current) {
      renderPoster(mainPreviewRef.current, {
        bg: bgImg,
        ratio: sharedData.ratio,
        title: sharedData.title,
        bodyText: sharedData.bodyText,
        text: textSettings,
        showFooter,
        footerAssets: footerAssetsRef.current ?? undefined,
      });
    }
    // 2) 썸네일용 가로형 (16:9)
    if (thumbPreviewRef.current) {
      renderPoster(thumbPreviewRef.current, {
        bg: bgImg,
        ratio: "16:9",
        title: sharedData.title,
        bodyText: sharedData.bodyText,
        text: textSettings,
        showFooter,
        footerAssets: footerAssetsRef.current ?? undefined,
      });
    }
  }

  async function handleRegister() {
    if (!draft || submitting) return;
    setSubmitting(true);
    try {
      // 1. 이미지 Blob 생성
      const mainBlob = await canvasToBlob(mainPreviewRef.current);
      const thumbBlob = await canvasToBlob(thumbPreviewRef.current);
      if (!mainBlob || !thumbBlob) throw new Error("이미지 생성 실패");

      // 2. Storage 업로드
      const mainPath = `admin-hero/poster-${Date.now()}-main.png`;
      const thumbPath = `admin-hero/poster-${Date.now()}-thumb.png`;

      const uploadMain = await supabase.storage.from("blog-images").upload(mainPath, mainBlob);
      const uploadThumb = await supabase.storage.from("blog-images").upload(thumbPath, thumbBlob);
      
      if (uploadMain.error) throw uploadMain.error;
      if (uploadThumb.error) throw uploadThumb.error;

      const mainUrl = supabase.storage.from("blog-images").getPublicUrl(mainPath).data.publicUrl;
      const thumbUrl = supabase.storage.from("blog-images").getPublicUrl(thumbPath).data.publicUrl;

      // 3. 공지사항 DB 등록
      const { error: dbError } = await supabase.from("notices").insert({
        title: draft.title,
        slug: generateSlug(draft.title),
        category: draft.category,
        content: draft.content,
        images: [mainUrl, thumbUrl],
        is_public: false, // 기본 비공개
      });

      if (dbError) throw dbError;

      alert("공지사항으로 등록되었습니다. (관리자 페이지에서 '공개'로 전환해주세요)");
      router.push("/admin/notices");
      onClose();
    } catch (err) {
      console.error(err);
      alert("등록 중 오류가 발생했습니다: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">공지사항으로 등록</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-primary-600" size={32} />
              <p className="text-sm text-gray-500">AI가 공지사항 초안을 작성하고 있습니다...</p>
            </div>
          ) : error ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-red-500">
              <AlertCircle size={32} />
              <p className="text-sm">{error}</p>
              <button onClick={fetchDraft} className="text-sm font-medium underline">다시 시도</button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
              {/* 왼쪽: 제목/본문 편집 */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-400 uppercase">공지 제목</label>
                  <input
                    value={draft!.title}
                    onChange={(e) => setDraft({ ...draft!, title: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-lg font-bold focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-400 uppercase">공지 내용 (Markdown)</label>
                  <textarea
                    value={draft!.content}
                    onChange={(e) => setDraft({ ...draft!, content: e.target.value })}
                    rows={12}
                    className="w-full resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 오른쪽: 이미지 미리보기 */}
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-400 uppercase">메인 포스터 ({sharedData.ratio})</label>
                  <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 aspect-square">
                    <canvas ref={mainPreviewRef} width={600} height={600} className="h-full w-full object-contain" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-400 uppercase">썸네일 (16:9 가로형)</label>
                  <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 aspect-video">
                    <canvas ref={thumbPreviewRef} width={640} height={360} className="h-full w-full object-contain" />
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400 leading-tight">
                    * 홈 화면 히어로 슬라이드 및 목록용으로 자동 생성됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleRegister}
            disabled={!draft || submitting}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-300"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            공지사항 등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 헬퍼 ───────────────────────────────────────────────

function canvasToBlob(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!canvas) return resolve(null);
    canvas.toBlob((b) => resolve(b), "image/png");
  });
}

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50) + "-" + Date.now().toString(36);
}
