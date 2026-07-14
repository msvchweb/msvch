"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CardNewsRatio = "1:1" | "4:5";
type TextAlign = "left" | "center" | "right";
type FontWeight = "400" | "600" | "700" | "800";

interface TextLayer {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontWeight: FontWeight;
  color: string;
  align: TextAlign;
  lineHeight: number;
  shadow: boolean;
  overlay: boolean;
}

interface CardNewsPage {
  id: string;
  layer: TextLayer;
}

interface GenerateImageResponse {
  imageUrl?: string;
  error?: string;
}

const STORAGE_KEY = "msvch.cardNewsEditor.v1";

const RATIO_DIMENSIONS: Record<CardNewsRatio, { w: number; h: number; label: string }> = {
  "1:1": { w: 1080, h: 1080, label: "1:1 피드" },
  "4:5": { w: 1080, h: 1350, label: "4:5 피드" },
};

const DEFAULT_LAYER: TextLayer = {
  text: "카드뉴스 문구를 입력하세요",
  x: 50,
  y: 48,
  width: 76,
  fontSize: 68,
  fontWeight: "800",
  color: "#ffffff",
  align: "center",
  lineHeight: 1.22,
  shadow: true,
  overlay: true,
};

export function CardNewsEditor() {
  const [title, setTitle] = useState("인스타 카드뉴스");
  const [ratio, setRatio] = useState<CardNewsRatio>("4:5");
  const [backgroundPrompt, setBackgroundPrompt] = useState(
    "따뜻하고 밝은 한국 교회 인스타그램 카드뉴스 배경. 은은한 빛, 부드러운 색감, 본문 텍스트가 잘 보이는 넓은 여백.",
  );
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [pages, setPages] = useState<CardNewsPage[]>(() => [createPage()]);
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const selectedIndex = pages.findIndex((page) => page.id === selectedPageId);
  const selectedPage = selectedIndex >= 0 ? pages[selectedIndex] : pages[0];
  const dim = RATIO_DIMENSIONS[ratio];

  const previewSize = useMemo(() => {
    const width = ratio === "1:1" ? 420 : 380;
    return { width, height: Math.round((width * dim.h) / dim.w) };
  }, [dim.h, dim.w, ratio]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        title?: string;
        ratio?: CardNewsRatio;
        backgroundPrompt?: string;
        backgroundUrl?: string;
        pages?: CardNewsPage[];
        selectedPageId?: string;
      };
      if (saved.title) setTitle(saved.title);
      if (saved.ratio === "1:1" || saved.ratio === "4:5") setRatio(saved.ratio);
      if (saved.backgroundPrompt) setBackgroundPrompt(saved.backgroundPrompt);
      if (saved.backgroundUrl) setBackgroundUrl(saved.backgroundUrl);
      if (saved.pages?.length) {
        setPages(saved.pages);
        setSelectedPageId(saved.selectedPageId || saved.pages[0].id);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload = { title, ratio, backgroundPrompt, backgroundUrl, pages, selectedPageId };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Browser storage can be full; editing should continue even if autosave fails.
    }
  }, [backgroundPrompt, backgroundUrl, pages, ratio, selectedPageId, title]);

  useEffect(() => {
    if (!backgroundUrl) {
      setBackgroundImage(null);
      return;
    }
    let cancelled = false;
    loadImage(backgroundUrl)
      .then((img) => {
        if (!cancelled) setBackgroundImage(img);
      })
      .catch(() => {
        if (!cancelled) setBackgroundImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !selectedPage) return;
    renderCardPage(canvas, {
      ratio,
      page: selectedPage,
      backgroundImage,
      width: previewSize.width,
      height: previewSize.height,
    });
  }, [backgroundImage, previewSize.height, previewSize.width, ratio, selectedPage]);

  function updateSelectedLayer(patch: Partial<TextLayer>) {
    if (!selectedPage) return;
    setPages((prev) =>
      prev.map((page) =>
        page.id === selectedPage.id ? { ...page, layer: { ...page.layer, ...patch } } : page,
      ),
    );
  }

  function addPage() {
    const next = createPage();
    setPages((prev) => [...prev, next]);
    setSelectedPageId(next.id);
  }

  function duplicatePage() {
    if (!selectedPage) return;
    const next = {
      id: createId(),
      layer: { ...selectedPage.layer },
    };
    setPages((prev) => {
      const insertAt = Math.max(0, selectedIndex) + 1;
      return [...prev.slice(0, insertAt), next, ...prev.slice(insertAt)];
    });
    setSelectedPageId(next.id);
  }

  function removePage() {
    if (!selectedPage || pages.length <= 1) return;
    setPages((prev) => {
      const next = prev.filter((page) => page.id !== selectedPage.id);
      setSelectedPageId(next[Math.max(0, selectedIndex - 1)]?.id ?? next[0].id);
      return next;
    });
  }

  async function generateBackground() {
    const prompt = backgroundPrompt.trim();
    if (!prompt) {
      alert("배경 설명을 입력해 주세요.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/admin/card-news/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratio,
          prompt,
          title: title.trim() || "인스타 카드뉴스",
        }),
      });
      const data = (await response.json()) as GenerateImageResponse;
      if (!response.ok || !data.imageUrl) {
        alert(data.error ?? "배경 이미지 생성에 실패했습니다.");
        return;
      }
      setBackgroundUrl(data.imageUrl);
    } catch (error) {
      console.error(error);
      alert("배경 이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadCurrentPage() {
    if (!selectedPage) return;
    setDownloading(true);
    try {
      const blob = await renderPageBlob({ ratio, page: selectedPage, backgroundImage });
      downloadBlob(blob, `${safeFileName(title)}-${selectedIndex + 1}.png`);
    } finally {
      setDownloading(false);
    }
  }

  async function downloadAllPages() {
    setDownloading(true);
    try {
      for (const [index, page] of pages.entries()) {
        const blob = await renderPageBlob({ ratio, page, backgroundImage });
        downloadBlob(blob, `${safeFileName(title)}-${String(index + 1).padStart(2, "0")}.png`);
        await wait(180);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">페이지</p>
            <button
              type="button"
              onClick={addPage}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700"
              title="페이지 추가"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setSelectedPageId(page.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border p-2 text-left",
                  page.id === selectedPage?.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <PageThumb page={page} ratio={ratio} backgroundImage={backgroundImage} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-gray-900">{index + 1}페이지</span>
                  <span className="block truncate text-[11px] text-gray-500">{page.layer.text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={duplicatePage}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-primary-300 hover:text-primary-700"
          >
            <Copy size={14} />
            복제
          </button>
          <button
            type="button"
            onClick={removePage}
            disabled={pages.length <= 1}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 size={14} />
            삭제
          </button>
        </div>
      </aside>

      <main className="min-w-0 space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-400">카드뉴스 제목</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-400">비율</label>
              <div className="grid grid-cols-2 gap-2">
                {(["4:5", "1:1"] as CardNewsRatio[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRatio(value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold",
                      ratio === value
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                    )}
                  >
                    {RATIO_DIMENSIONS[value].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <textarea
              value={backgroundPrompt}
              onChange={(event) => setBackgroundPrompt(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              placeholder="배경 분위기를 입력하세요."
            />
            <button
              type="button"
              onClick={generateBackground}
              disabled={generating}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:bg-gray-300"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              배경 생성
            </button>
          </div>
        </section>

        <section className="flex justify-center rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div
            className="overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <canvas
              ref={previewRef}
              width={previewSize.width}
              height={previewSize.height}
              className="block h-full w-full"
            />
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={downloadCurrentPage}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-gray-300"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            현재 페이지 PNG
          </button>
          <button
            type="button"
            onClick={downloadAllPages}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            전체 페이지 PNG
          </button>
        </div>
      </main>

      <aside className="space-y-4">
        <EditorCard title="텍스트">
          <textarea
            value={selectedPage?.layer.text ?? ""}
            onChange={(event) => updateSelectedLayer({ text: event.target.value })}
            rows={7}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </EditorCard>

        <EditorCard title="글자">
          <Control label="크기">
            <input
              type="range"
              min={28}
              max={120}
              value={selectedPage?.layer.fontSize ?? DEFAULT_LAYER.fontSize}
              onChange={(event) => updateSelectedLayer({ fontSize: Number(event.target.value) })}
              className="w-full"
            />
          </Control>
          <Control label="굵기">
            <select
              value={selectedPage?.layer.fontWeight ?? DEFAULT_LAYER.fontWeight}
              onChange={(event) => updateSelectedLayer({ fontWeight: event.target.value as FontWeight })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="400">Regular</option>
              <option value="600">SemiBold</option>
              <option value="700">Bold</option>
              <option value="800">ExtraBold</option>
            </select>
          </Control>
          <Control label="색상">
            <div className="flex gap-2">
              <input
                type="color"
                value={selectedPage?.layer.color ?? DEFAULT_LAYER.color}
                onChange={(event) => updateSelectedLayer({ color: event.target.value })}
                className="h-10 w-12 rounded border border-gray-300"
              />
              <input
                value={selectedPage?.layer.color ?? DEFAULT_LAYER.color}
                onChange={(event) => updateSelectedLayer({ color: event.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </Control>
          <Control label="정렬">
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as TextAlign[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateSelectedLayer({ align: value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-semibold",
                    selectedPage?.layer.align === value
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 bg-white text-gray-600",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </Control>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selectedPage?.layer.shadow ?? false}
              onChange={(event) => updateSelectedLayer({ shadow: event.target.checked })}
            />
            그림자
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selectedPage?.layer.overlay ?? false}
              onChange={(event) => updateSelectedLayer({ overlay: event.target.checked })}
            />
            반투명 배경
          </label>
        </EditorCard>

        <EditorCard title="위치">
          <Control label="가로 위치">
            <input
              type="range"
              min={10}
              max={90}
              value={selectedPage?.layer.x ?? DEFAULT_LAYER.x}
              onChange={(event) => updateSelectedLayer({ x: Number(event.target.value) })}
              className="w-full"
            />
          </Control>
          <Control label="세로 위치">
            <input
              type="range"
              min={10}
              max={90}
              value={selectedPage?.layer.y ?? DEFAULT_LAYER.y}
              onChange={(event) => updateSelectedLayer({ y: Number(event.target.value) })}
              className="w-full"
            />
          </Control>
          <Control label="텍스트 폭">
            <input
              type="range"
              min={40}
              max={92}
              value={selectedPage?.layer.width ?? DEFAULT_LAYER.width}
              onChange={(event) => updateSelectedLayer({ width: Number(event.target.value) })}
              className="w-full"
            />
          </Control>
          <Control label="줄 간격">
            <input
              type="range"
              min={1}
              max={1.8}
              step={0.02}
              value={selectedPage?.layer.lineHeight ?? DEFAULT_LAYER.lineHeight}
              onChange={(event) => updateSelectedLayer({ lineHeight: Number(event.target.value) })}
              className="w-full"
            />
          </Control>
        </EditorCard>
      </aside>
    </div>
  );
}

function PageThumb({
  page,
  ratio,
  backgroundImage,
}: {
  page: CardNewsPage;
  ratio: CardNewsRatio;
  backgroundImage: HTMLImageElement | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dim = RATIO_DIMENSIONS[ratio];
  const width = 46;
  const height = Math.round((width * dim.h) / dim.w);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    renderCardPage(canvas, { ratio, page, backgroundImage, width, height });
  }, [backgroundImage, height, page, ratio, width]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="shrink-0 rounded border border-gray-200 bg-gray-100"
    />
  );
}

function EditorCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-400">
        {title === "텍스트" ? <Type size={13} /> : null}
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function renderCardPage(
  canvas: HTMLCanvasElement,
  input: {
    ratio: CardNewsRatio;
    page: CardNewsPage;
    backgroundImage: HTMLImageElement | null;
    width: number;
    height: number;
  },
) {
  canvas.width = input.width;
  canvas.height = input.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (input.backgroundImage) {
    drawCover(ctx, input.backgroundImage, canvas.width, canvas.height);
  } else {
    drawEmptyState(ctx, canvas.width, canvas.height);
  }

  drawTextLayer(ctx, input.page.layer, canvas.width, canvas.height);
}

async function renderPageBlob({
  ratio,
  page,
  backgroundImage,
}: {
  ratio: CardNewsRatio;
  page: CardNewsPage;
  backgroundImage: HTMLImageElement | null;
}): Promise<Blob> {
  const dim = RATIO_DIMENSIONS[ratio];
  const canvas = document.createElement("canvas");
  renderCardPage(canvas, { ratio, page, backgroundImage, width: dim.w, height: dim.h });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Canvas export failed");
  return blob;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number) {
  const scale = Math.max(cw / img.width, ch / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(1, "#dbeafe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(14, width * 0.035)}px system-ui, sans-serif`;
  ctx.fillText("배경을 생성하세요", width / 2, height / 2);
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, cw: number, ch: number) {
  const scale = cw / 1080;
  const fontSize = layer.fontSize * scale;
  const maxWidth = cw * (layer.width / 100);
  const x = cw * (layer.x / 100);
  const y = ch * (layer.y / 100);
  const lines = wrapText(ctx, layer.text, maxWidth, fontSize, layer.fontWeight);
  const lineHeight = fontSize * layer.lineHeight;
  const blockHeight = lines.length * lineHeight;
  const left = x - maxWidth / 2;
  const top = y - blockHeight / 2;

  if (layer.overlay && lines.length > 0) {
    const pad = fontSize * 0.35;
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    roundRect(ctx, left - pad, top - pad, maxWidth + pad * 2, blockHeight + pad * 2, fontSize * 0.22);
    ctx.fill();
  }

  ctx.font = `${layer.fontWeight} ${fontSize}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";
  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = fontSize * 0.16;
    ctx.shadowOffsetY = fontSize * 0.04;
  }

  const textX =
    layer.align === "left" ? left : layer.align === "right" ? left + maxWidth : left + maxWidth / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, textX, top + lineHeight * (index + 0.5));
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: FontWeight,
): string[] {
  const paragraphs = text.split(/\r?\n/);
  ctx.font = `${fontWeight} ${fontSize}px "Pretendard Variable", "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const char of paragraph) {
      const next = current + char;
      if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
        current = next;
      } else {
        lines.push(current);
        current = char;
      }
    }
    if (current) lines.push(current);
  }

  return lines.length ? lines : [""];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createPage(): CardNewsPage {
  return {
    id: createId(),
    layer: { ...DEFAULT_LAYER },
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return (value.trim() || "card-news").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
