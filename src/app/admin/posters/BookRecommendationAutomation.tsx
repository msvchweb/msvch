"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BellPlus,
  BookOpen,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_TEXT_SETTINGS,
  FINAL_DIMENSIONS,
  preloadFooterAssets,
  renderPoster,
} from "@/lib/poster-footer";
import type { PosterRatio } from "@/lib/poster-prompts";
import type {
  BookRecommendationDraft,
  BookSourceData,
} from "@/types/book-recommendation";

interface ExtractResponse {
  book?: BookSourceData;
  error?: string;
}

interface DraftResponse {
  draft?: BookRecommendationDraft;
  error?: string;
}

interface GenerateImageResponse {
  imageUrl?: string;
  error?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const REVISION_CHIPS = [
  "배경을 더 밝고 따뜻하게",
  "표지가 더 돋보이게 여백 정리",
  "차분한 교회 공지 느낌으로",
  "색감을 더 고급스럽게",
  "전체 구도를 더 단순하게",
];

export function BookRecommendationAutomation() {
  const [url, setUrl] = useState("https://www.yes24.com/Product/Goods/142813974");
  const [book, setBook] = useState<BookSourceData | null>(null);
  const [draft, setDraft] = useState<BookRecommendationDraft | null>(null);
  const [ratio, setRatio] = useState<PosterRatio>("a4");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);
  const [showFooter, setShowFooter] = useState(true);
  const [loading, setLoading] = useState<"extract" | "generate" | "revise" | "register" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [revisionText, setRevisionText] = useState("");

  const previewRef = useRef<HTMLCanvasElement>(null);
  const footerAssetsRef = useRef<{ logo: HTMLImageElement; qr: HTMLImageElement } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    preloadFooterAssets()
      .then((assets) => {
        if (!cancelled) {
          footerAssetsRef.current = assets;
          drawPreview();
        }
      })
      .catch((err) => console.error("Book poster footer assets failed", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!backgroundUrl) {
      setBackgroundImg(null);
      return;
    }
    let cancelled = false;
    loadImage(backgroundUrl)
      .then((img) => {
        if (!cancelled) setBackgroundImg(img);
      })
      .catch(() => setError("생성된 배경 이미지를 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl]);

  useEffect(() => {
    if (!book?.coverImageUrl) {
      setCoverImg(null);
      return;
    }
    let cancelled = false;
    loadRemoteImage(book.coverImageUrl)
      .then((img) => {
        if (!cancelled) setCoverImg(img);
      })
      .catch(() => setError("도서 표지를 불러오지 못했습니다."));
    return () => {
      cancelled = true;
    };
  }, [book?.coverImageUrl]);

  useEffect(() => {
    drawPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundImg, coverImg, draft, book, ratio, showFooter]);

  async function handleExtractAndDraft() {
    setError(null);
    setLoading("extract");
    setBackgroundUrl(null);
    setMessages([]);
    try {
      const extractRes = await fetch("/api/admin/book-recommendations/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const extractData = (await extractRes.json()) as ExtractResponse;
      if (!extractRes.ok || !extractData.book) {
        throw new Error(extractData.error || "도서 정보를 가져오지 못했습니다.");
      }
      setBook(extractData.book);

      const draftRes = await fetch("/api/admin/book-recommendations/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book: extractData.book }),
      });
      const draftData = (await draftRes.json()) as DraftResponse;
      if (!draftRes.ok || !draftData.draft) {
        throw new Error(draftData.error || "추천도서 초안을 만들지 못했습니다.");
      }
      setDraft(draftData.draft);
      setRatio(draftData.draft.posterPromptInput.ratio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateBackground() {
    if (!draft || !book) return;
    setError(null);
    setLoading("generate");
    try {
      const response = await fetch("/api/posters/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildBackgroundPrompt(book, draft, ratio),
          ratio,
          artStyle: draft.posterPromptInput.artStyle,
          mode: "generate",
          posterTitle: draft.posterTitle,
          posterCategory: "notice",
        }),
      });
      const data = (await response.json()) as GenerateImageResponse;
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "포스터 배경 생성에 실패했습니다.");
      }
      setBackgroundUrl(data.imageUrl);
      setMessages([
        {
          role: "assistant",
          content: "배경을 생성했습니다. 책 표지와 문구, footer는 별도로 합성됩니다.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRevise(instructionOverride?: string) {
    const instruction = (instructionOverride || revisionText).trim();
    if (!draft || !book || !backgroundUrl || !instruction) return;
    setError(null);
    setLoading("revise");
    setMessages((prev) => [...prev, { role: "user", content: instruction }]);
    try {
      const response = await fetch("/api/posters/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildBackgroundPrompt(book, draft, ratio),
          ratio,
          artStyle: draft.posterPromptInput.artStyle,
          mode: "revise",
          revisionInstruction: `${instruction}

Keep this as a background only. Do not add a book cover, Korean text, logo, QR code, or footer. Leave clean space for a separately composited real book cover and church footer.`,
          sourceImageDataUrl: backgroundUrl,
          posterTitle: draft.posterTitle,
          posterCategory: "notice",
        }),
      });
      const data = (await response.json()) as GenerateImageResponse;
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "수정 이미지 생성에 실패했습니다.");
      }
      setBackgroundUrl(data.imageUrl);
      setRevisionText("");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "요청한 방향으로 배경을 수정했습니다. 표지와 footer는 유지됩니다.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRegisterNotice() {
    if (!book || !draft || !backgroundImg || !coverImg) return;
    setError(null);
    setLoading("register");
    try {
      const mainBlob = await renderToBlob(ratio);
      const thumbBlob = await renderToBlob("1:1");
      if (!mainBlob || !thumbBlob) throw new Error("최종 포스터 이미지를 만들지 못했습니다.");

      const stamp = Date.now();
      const mainPath = `admin-hero/book-recommendation-${stamp}-main.png`;
      const thumbPath = `admin-hero/book-recommendation-${stamp}-thumb.png`;

      const uploadMain = await supabase.storage.from("blog-images").upload(mainPath, mainBlob);
      if (uploadMain.error) throw uploadMain.error;
      const uploadThumb = await supabase.storage.from("blog-images").upload(thumbPath, thumbBlob);
      if (uploadThumb.error) throw uploadThumb.error;

      const mainUrl = supabase.storage.from("blog-images").getPublicUrl(mainPath).data.publicUrl;
      const thumbUrl = supabase.storage.from("blog-images").getPublicUrl(thumbPath).data.publicUrl;

      const { error: dbError } = await supabase.from("notices").insert({
        title: draft.noticeTitle,
        slug: generateSlug(draft.noticeTitle),
        category: "일반",
        content: ensureBookMeta(draft.noticeContent, book),
        images: [mainUrl, thumbUrl],
        is_public: false,
      });
      if (dbError) throw dbError;

      alert("추천도서 공지사항 초안이 비공개로 등록되었습니다.");
      window.location.href = "/admin/notices";
    } catch (err) {
      setError(err instanceof Error ? err.message : "공지 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  function drawPreview() {
    const canvas = previewRef.current;
    if (!canvas || !backgroundImg || !book || !draft) return;
    const dim = FINAL_DIMENSIONS[ratio];
    const width = Math.min(900, dim.w);
    canvas.width = width;
    canvas.height = Math.round((width * dim.h) / dim.w);
    drawBookPoster(canvas, {
      ratio,
      bg: backgroundImg,
      cover: coverImg,
      book,
      draft,
      showFooter,
      footerAssets: footerAssetsRef.current ?? undefined,
    });
  }

  async function renderToBlob(targetRatio: PosterRatio): Promise<Blob | null> {
    if (!backgroundImg || !book || !draft) return null;
    const canvas = document.createElement("canvas");
    const dim = FINAL_DIMENSIONS[targetRatio];
    canvas.width = dim.w;
    canvas.height = dim.h;
    drawBookPoster(canvas, {
      ratio: targetRatio,
      bg: backgroundImg,
      cover: coverImg,
      book,
      draft,
      showFooter,
      footerAssets: footerAssetsRef.current ?? undefined,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  const canGenerate = Boolean(book && draft && !loading);
  const canRegister = Boolean(book && draft && backgroundImg && coverImg && !loading);
  const dim = FINAL_DIMENSIONS[ratio];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={18} className="text-primary-600" />
            <h2 className="text-base font-bold text-gray-900">추천도서 URL</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.yes24.com/Product/Goods/..."
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleExtractAndDraft}
              disabled={loading === "extract" || !url.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300"
            >
              {loading === "extract" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              정보 가져오기
            </button>
          </div>
          {error && (
            <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </section>

        {book && draft && (
          <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[160px_1fr]">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {book.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/posters/proxy-image?url=${encodeURIComponent(book.coverImageUrl)}`} alt={`${book.title} 표지`} className="h-full w-full object-contain" />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-sm text-gray-400">
                  표지 없음
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-xs font-semibold text-primary-700">도서 정보</p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">{book.title}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {book.author} 저 · {book.publisher}
                  {book.isbn13 ? ` · ISBN ${book.isbn13}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-primary-700">공지 제목</p>
                <input
                  value={draft.noticeTitle}
                  onChange={(event) => setDraft({ ...draft, noticeTitle: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary-700">공지 본문</p>
                <textarea
                  value={draft.noticeContent}
                  onChange={(event) => setDraft({ ...draft, noticeContent: event.target.value })}
                  rows={8}
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </section>
        )}

        {draft && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">포스터 생성</h2>
                <p className="mt-1 text-sm text-gray-500">
                  GPT는 배경만 만들고, 실제 표지와 문구는 별도 합성합니다.
                </p>
              </div>
              <div className="flex gap-2">
                {(["a4", "1:1", "9:16"] as PosterRatio[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRatio(item)}
                    className={ratio === item ? activeChipClass : chipClass}
                  >
                    {item === "a4" ? "A4" : item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleGenerateBackground}
                disabled={!canGenerate}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300"
              >
                {loading === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                포스터 생성
              </button>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showFooter}
                  onChange={(event) => setShowFooter(event.target.checked)}
                />
                footer 포함
              </label>
            </div>
          </section>
        )}

        {backgroundImg && draft && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">수정 대화창</h2>
              <MessageSquare size={18} className="text-primary-600" />
            </div>
            <div className="mb-3 max-h-52 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "ml-8 bg-primary-600 text-white"
                      : "mr-8 border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {REVISION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleRevise(chip)}
                  disabled={Boolean(loading)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={revisionText}
                onChange={(event) => setRevisionText(event.target.value)}
                rows={2}
                placeholder="예: 배경을 더 밝게 하고, 표지 주변 여백을 넓게 느껴지도록 해줘"
                className="min-h-12 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRevise()}
                disabled={loading === "revise" || !revisionText.trim()}
                className="inline-flex w-12 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300"
                aria-label="수정 요청"
              >
                {loading === "revise" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div
            className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
            style={{ aspectRatio: `${dim.w} / ${dim.h}` }}
          >
            {backgroundImg ? (
              <canvas ref={previewRef} className="block h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-400">
                <BookOpen size={32} className="text-gray-300" />
                도서 정보를 가져온 뒤 포스터를 생성하세요.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRegisterNotice}
            disabled={!canRegister || loading === "register"}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
          >
            {loading === "register" ? <Loader2 size={16} className="animate-spin" /> : <BellPlus size={16} />}
            공지사항 초안 등록
          </button>
        </div>

        {draft && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-900">포스터 문구</h3>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">제목</span>
              <input
                value={draft.posterTitle}
                onChange={(event) => setDraft({ ...draft, posterTitle: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">부제</span>
              <textarea
                value={draft.posterSubtitle}
                onChange={(event) => setDraft({ ...draft, posterSubtitle: event.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        {backgroundUrl && (
          <button
            type="button"
            onClick={() => {
              setBackgroundUrl(null);
              setMessages([]);
            }}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={15} />
            배경 다시 시작
          </button>
        )}
      </aside>
    </div>
  );
}

function buildBackgroundPrompt(
  book: BookSourceData,
  draft: BookRecommendationDraft,
  ratio: PosterRatio,
): string {
  return `Create a polished Korean church book recommendation poster background for the book "${book.title}" by ${book.author}.

Concept: ${draft.imageConcept}

Hard requirements:
- Background only. Do not render any book cover, Korean text, letters, numbers, logos, QR codes, or watermarks.
- Leave a clear premium display area for a real book cover to be composited later.
- Leave the bottom 14% clean for a church footer overlay.
- Mood: calm, reverent, hopeful, warm, suitable for a Protestant church congregation.
- Visual motifs may include an open Bible, soft rays of light, quiet reading desk, gentle paper texture, or abstract promise/path imagery.
- No realistic faces and no depiction of Jesus or specific religious figures.
- Aspect ratio: ${ratio}.`;
}

function drawBookPoster(
  canvas: HTMLCanvasElement,
  input: {
    ratio: PosterRatio;
    bg: HTMLImageElement;
    cover: HTMLImageElement | null;
    book: BookSourceData;
    draft: BookRecommendationDraft;
    showFooter: boolean;
    footerAssets?: { logo: HTMLImageElement; qr: HTMLImageElement };
  },
) {
  renderPoster(canvas, {
    bg: input.bg,
    ratio: input.ratio,
    title: "",
    bodyText: "",
    text: DEFAULT_TEXT_SETTINGS,
    showFooter: input.showFooter,
    footerAssets: input.footerAssets,
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const footerReserve = input.showFooter ? ch * 0.13 : 0;
  const safeH = ch - footerReserve;
  const scale = cw / 1080;

  drawSoftPanel(ctx, cw, ch, safeH);
  drawPosterText(ctx, input.draft, input.book, cw, safeH, scale, input.ratio);
  if (input.cover) drawBookCover(ctx, input.cover, cw, safeH, scale, input.ratio);
}

function drawSoftPanel(ctx: CanvasRenderingContext2D, cw: number, ch: number, safeH: number) {
  const gradient = ctx.createLinearGradient(0, 0, cw, safeH);
  gradient.addColorStop(0, "rgba(255,255,255,0.84)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cw, ch);
}

function drawPosterText(
  ctx: CanvasRenderingContext2D,
  draft: BookRecommendationDraft,
  book: BookSourceData,
  cw: number,
  safeH: number,
  scale: number,
  ratio: PosterRatio,
) {
  const left = cw * 0.08;
  const maxWidth = ratio === "1:1" ? cw * 0.48 : cw * 0.56;
  const titleY = safeH * (ratio === "9:16" ? 0.1 : 0.16);
  const titlePx = Math.round((ratio === "1:1" ? 58 : 72) * scale);
  const subtitlePx = Math.round((ratio === "1:1" ? 28 : 34) * scale);
  const metaPx = Math.round(22 * scale);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111827";
  ctx.font = `800 ${titlePx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  wrapCanvasText(ctx, draft.posterTitle, left, titleY, maxWidth, titlePx * 1.18, 3);

  ctx.fillStyle = "#374151";
  ctx.font = `500 ${subtitlePx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  wrapCanvasText(ctx, draft.posterSubtitle, left, titleY + titlePx * 2.65, maxWidth, subtitlePx * 1.35, 3);

  ctx.fillStyle = "#4b5563";
  ctx.font = `500 ${metaPx}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  const meta = `${book.author} 저 · ${book.publisher}${book.isbn13 ? ` · ISBN ${book.isbn13}` : ""}`;
  wrapCanvasText(ctx, meta, left, safeH * 0.76, cw * 0.72, metaPx * 1.35, 2);

  ctx.fillStyle = "#b45309";
  ctx.font = `700 ${Math.round(24 * scale)}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.fillText("추천도서", left, titleY - 34 * scale);
}

function drawBookCover(
  ctx: CanvasRenderingContext2D,
  cover: HTMLImageElement,
  cw: number,
  safeH: number,
  scale: number,
  ratio: PosterRatio,
) {
  const coverW =
    ratio === "9:16" ? cw * 0.48 : ratio === "1:1" ? cw * 0.3 : cw * 0.34;
  const coverH = coverW * (cover.height / cover.width);
  const x = ratio === "9:16" ? cw * 0.5 - coverW / 2 : cw - coverW - cw * 0.08;
  const y = ratio === "9:16" ? safeH * 0.34 : safeH * 0.28;
  const radius = 10 * scale;

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
  ctx.shadowBlur = 28 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 16 * scale;
  roundedRect(ctx, x, y, coverW, coverH, radius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  ctx.drawImage(cover, x, y, coverW, coverH);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, x, y, coverW, coverH, radius);
  ctx.strokeStyle = "rgba(17, 24, 39, 0.16)";
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.stroke();
  ctx.restore();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const ch of paragraph.trim()) {
      const next = line + ch;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = ch;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

async function loadRemoteImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(`/api/posters/proxy-image?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error("remote image load failed");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ensureBookMeta(content: string, book: BookSourceData): string {
  const meta = [
    "",
    "---",
    "",
    `도서 정보: ${book.author} 저, ${book.publisher}${book.isbn13 ? `, ISBN ${book.isbn13}` : ""}`,
    `도서 링크: ${book.sourceUrl}`,
  ].join("\n");
  return content.includes(book.sourceUrl) ? content : `${content.trim()}\n${meta}`;
}

function generateSlug(text: string) {
  return `${text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50)}-${Date.now().toString(36)}`;
}

const chipClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300";
const activeChipClass =
  "rounded-lg border border-primary-600 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700";
