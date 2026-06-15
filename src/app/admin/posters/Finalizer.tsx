"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Link2, Download, Loader2, Image as ImageIcon, BellPlus } from "lucide-react";
import { NoticeDraftModal } from "./NoticeDraftModal";
import {
  POSTER_RATIOS,
  POSTER_RATIO_LABEL,
  type PosterRatio,
} from "@/lib/poster-prompts";
import {
  FINAL_DIMENSIONS,
  DEFAULT_TEXT_SETTINGS,
  preloadFooterAssets,
  renderPoster,
  type TextSettings,
  type TextPosition,
  type TextSize,
} from "@/lib/poster-footer";
import type { SharedPosterData } from "./PostersTabs";

type InputMode = "file" | "url";

const COLOR_SWATCHES = [
  { value: "#ffffff", label: "흰색" },
  { value: "#111827", label: "검정" },
  { value: "#1e3a8a", label: "네이비" },
  { value: "#c9a84c", label: "골드" },
];

export function Finalizer({ sharedData }: { sharedData: SharedPosterData | null }) {
  const [ratio, setRatio] = useState<PosterRatio>("a4");
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [aiImg, setAiImg] = useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = useState(false);

  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [text, setText] = useState<TextSettings>(DEFAULT_TEXT_SETTINGS);
  const [showFooter, setShowFooter] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showNoticeDraft, setShowNoticeDraft] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const footerAssetsRef = useRef<{ logo: HTMLImageElement; qr: HTMLImageElement } | null>(null);

  // 공유 데이터 반영
  useEffect(() => {
    if (!sharedData) return;

    setTitle(sharedData.title);
    setBodyText(sharedData.bodyText);
    setRatio(sharedData.ratio);

    if (sharedData.imageUrl) {
      setLoadingImg(true);
      (async () => {
        try {
          // 서버 프록시를 통해 same-origin 으로 로드 (CORS taint 회피)
          const proxied = `/api/posters/proxy-image?url=${encodeURIComponent(sharedData.imageUrl!)}`;
          const head = await fetch(proxied, { method: "GET" });
          if (!head.ok) throw new Error("Image transfer failed");

          const blob = await head.blob();
          const blobUrl = URL.createObjectURL(blob);
          const img = await loadImage(blobUrl);
          URL.revokeObjectURL(blobUrl);
          setAiImg(img);
        } catch (err) {
          console.error("Shared data image load failed", err);
          alert("이미지를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        } finally {
          setLoadingImg(false);
        }
      })();
    }
  }, [sharedData]);

  // 폰트 + footer 자산 사전 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof document !== "undefined") {
        await document.fonts.ready;
      }
      try {
        const assets = await preloadFooterAssets();
        if (!cancelled) {
          footerAssetsRef.current = assets;
          drawPreview();
        }
      } catch (e) {
        console.error("footer assets load failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 입력값/설정 변경 시 미리보기 재렌더
  useEffect(() => {
    drawPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiImg, ratio, title, bodyText, text, showFooter]);

  function drawPreview() {
    const canvas = previewRef.current;
    if (!canvas || !aiImg) return;
    renderPoster(canvas, {
      bg: aiImg,
      ratio,
      title,
      bodyText,
      text,
      showFooter,
      footerAssets: footerAssetsRef.current ?? undefined,
    });
  }

  // ── 파일 업로드 ────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert("이미지가 25MB 를 초과합니다.");
      return;
    }
    setLoadingImg(true);
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      setAiImg(img);
    } catch (err) {
      console.error(err);
      alert("이미지를 불러오지 못했습니다.");
    } finally {
      setLoadingImg(false);
      e.target.value = "";
    }
  }

  // ── URL 붙여넣기 ───────────────────────────────────────
  async function handleLoadUrl() {
    const u = imageUrlInput.trim();
    if (!u) return;
    setLoadingImg(true);
    try {
      // 서버 프록시를 통해 same-origin 으로 로드 (CORS taint 회피)
      const proxied = `/api/posters/proxy-image?url=${encodeURIComponent(u)}`;
      // 응답이 에러 JSON 인지 확인
      const head = await fetch(proxied, { method: "GET" });
      if (!head.ok) {
        const data = (await head.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? `이미지 가져오기 실패 (${head.status})`);
        return;
      }
      const blob = await head.blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = await loadImage(blobUrl);
      URL.revokeObjectURL(blobUrl);
      setAiImg(img);
    } catch (err) {
      console.error(err);
      alert("이미지를 불러오지 못했습니다.");
    } finally {
      setLoadingImg(false);
    }
  }

  // ── 다운로드 ───────────────────────────────────────────
  async function handleDownload() {
    if (!aiImg) {
      alert("먼저 이미지를 업로드하거나 URL 을 불러와 주세요.");
      return;
    }
    setDownloading(true);
    try {
      // 폰트 보장
      if (typeof document !== "undefined") {
        await document.fonts.load(`bold 100px "Pretendard Variable"`);
        await document.fonts.load(`400 40px "Pretendard Variable"`);
      }

      // footer 자산이 아직 안 왔으면 기다림
      if (!footerAssetsRef.current && showFooter) {
        try {
          footerAssetsRef.current = await preloadFooterAssets();
        } catch {
          /* footer 없이 진행 */
        }
      }

      const dim = FINAL_DIMENSIONS[ratio];
      const canvas = document.createElement("canvas");
      canvas.width = dim.w;
      canvas.height = dim.h;

      renderPoster(canvas, {
        bg: aiImg,
        ratio,
        title,
        bodyText,
        text,
        showFooter,
        footerAssets: footerAssetsRef.current ?? undefined,
      });

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) {
        alert("이미지 합성에 실패했습니다.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = title.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "poster";
      a.download = `${safe}-${ratio.replace(":", "x")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  // ── 미리보기 캔버스 크기 ──────────────────────────────
  const dim = FINAL_DIMENSIONS[ratio];
  const internalW = Math.min(900, dim.w);
  const internalH = Math.round((internalW * dim.h) / dim.w);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      {/* ── 좌: 미리보기 ─────────────────────────────────── */}
      <div className="w-full space-y-3 lg:w-[480px]">
        <div
          className="w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
          style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
        >
          {aiImg ? (
            <canvas
              ref={previewRef}
              width={internalW}
              height={internalH}
              className="block h-full w-full"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-400">
              <ImageIcon size={32} className="text-gray-300" />
              이미지를 업로드하거나
              <br />
              URL 을 붙여넣어 주세요.
            </div>
          )}
        </div>
        {aiImg && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-300"
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            PNG 다운로드
          </button>
        )}
        {aiImg && sharedData?.fullInput && (
          <button
            type="button"
            onClick={() => setShowNoticeDraft(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary-600 bg-white px-4 py-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
          >
            <BellPlus size={16} />
            공지사항으로 바로 등록
          </button>
        )}
      </div>

      {showNoticeDraft && aiImg && sharedData && (
        <NoticeDraftModal
          sharedData={sharedData}
          bgImg={aiImg}
          textSettings={text}
          showFooter={showFooter}
          onClose={() => setShowNoticeDraft(false)}
        />
      )}

      {/* ── 우: 컨트롤 ───────────────────────────────────── */}
      <div className="space-y-4">
        {/* 비율 */}
        <Card title="비율">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {POSTER_RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                className={chip(ratio === r)}
              >
                {POSTER_RATIO_LABEL[r]}
              </button>
            ))}
          </div>
        </Card>

        {/* AI 이미지 입력 */}
        <Card title="AI 이미지">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode("file")}
              className={chip(inputMode === "file")}
            >
              <Upload size={14} className="mr-1 inline" />
              파일 업로드
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={chip(inputMode === "url")}
            >
              <Link2 size={14} className="mr-1 inline" />
              URL 붙여넣기
            </button>
          </div>

          {inputMode === "file" ? (
            <>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:border-primary-400 hover:bg-primary-50">
                <Upload size={16} />
                {loadingImg ? "불러오는 중…" : "여기를 눌러 이미지 선택"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">
                ChatGPT·Gemini 결과 이미지는 우클릭 → &lsquo;이미지 저장하기&rsquo; 로
                PC 에 받은 뒤 여기에 올려주세요.
              </p>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://…  (이미지 직접 링크)"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleLoadUrl}
                  disabled={loadingImg || !imageUrlInput.trim()}
                  className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-300"
                >
                  {loadingImg ? <Loader2 size={14} className="animate-spin" /> : "불러오기"}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                <strong>이미지 자체 URL</strong> 만 가능합니다 (.png/.jpg 로 끝나거나
                이미지를 직접 반환하는 링크). ChatGPT 공유 링크 (chatgpt.com/s/…) 는
                대화 페이지 이므로 작동하지 않습니다 — 그 경우 &lsquo;파일 업로드&rsquo;
                탭으로 바꿔 PC 에 받은 이미지를 올려주세요.
              </p>
            </>
          )}
        </Card>

        {/* 텍스트 */}
        <Card title="텍스트">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="예: 2026 봄 부흥회"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                부제목
              </label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="예: 5월 10일 오전 11시 본당"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <PositionRow
              label="제목 위치"
              value={text.titlePos}
              onChange={(v) => setText({ ...text, titlePos: v })}
            />
            <SizeRow
              label="제목 크기"
              value={text.titleSize}
              onChange={(v) => setText({ ...text, titleSize: v })}
            />
            <PositionRow
              label="부제목 위치"
              value={text.bodyPos}
              onChange={(v) => setText({ ...text, bodyPos: v })}
            />
            <SizeRow
              label="부제목 크기"
              value={text.bodySize}
              onChange={(v) => setText({ ...text, bodySize: v })}
            />
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-700">색상</p>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setText({ ...text, color: s.value })}
                    title={s.label}
                    style={{ backgroundColor: s.value }}
                    className={`h-8 w-8 rounded-full border-2 ${
                      text.color === s.value ? "border-primary-600" : "border-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={text.shadow}
                onChange={(e) => setText({ ...text, shadow: e.target.checked })}
              />
              텍스트 그림자
            </label>
          </div>
        </Card>

        {/* Footer */}
        <Card title="교회 정보 footer">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showFooter}
              onChange={(e) => setShowFooter(e.target.checked)}
            />
            하단에 로고·연락처·QR 코드 자동 합성
          </label>
          <p className="mt-1.5 text-xs text-gray-500">
            QR 은 {`https://msvch.vercel.app/links`} 로 연결됩니다 (교회 링크 모음).
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── 작은 헬퍼 컴포넌트 ────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function chip(active: boolean): string {
  return active
    ? "rounded-lg border border-primary-600 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700"
    : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300";
}

function PositionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TextPosition;
  onChange: (v: TextPosition) => void;
}) {
  const opts: { v: TextPosition; l: string }[] = [
    { v: "top", l: "위" },
    { v: "middle", l: "가운데" },
    { v: "bottom", l: "아래" },
  ];
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-700">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={chip(value === o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SizeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TextSize;
  onChange: (v: TextSize) => void;
}) {
  const opts: { v: TextSize; l: string }[] = [
    { v: "sm", l: "작게" },
    { v: "md", l: "보통" },
    { v: "lg", l: "크게" },
  ];
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-700">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={chip(value === o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 이미지 로드 헬퍼 ──────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 로드 실패"));
    img.src = src;
  });
}
