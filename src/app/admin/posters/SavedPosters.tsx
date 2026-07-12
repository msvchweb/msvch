"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, RefreshCw, Send, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { POSTER_RATIOS, POSTER_RATIO_LABEL, type PosterRatio } from "@/lib/poster-prompts";
import {
  dataUrlToBlob,
  downloadBlob,
  imageUrlToDataUrl,
  safePosterFilename,
  savePosterVersion,
  type PosterVersionRow,
  type SavedPosterRow,
} from "@/lib/poster-storage";
import { cn } from "@/lib/utils";

interface GenerateImageResponse {
  imageUrl?: string;
  error?: string;
}

export function SavedPosters() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posters, setPosters] = useState<SavedPosterRow[]>([]);
  const [versions, setVersions] = useState<PosterVersionRow[]>([]);
  const [selectedPoster, setSelectedPoster] = useState<SavedPosterRow | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PosterVersionRow | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedFromVersionId, setGeneratedFromVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<"list" | "versions" | "upload" | "revise" | "download" | null>("list");
  const [error, setError] = useState<string | null>(null);
  const [uploadRatio, setUploadRatio] = useState<PosterRatio>("a4");

  useEffect(() => {
    loadPosters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPosters() {
    setLoading("list");
    setError(null);
    const { data, error: queryError } = await supabase
      .from("posters")
      .select("id,title,category,ratio,created_at,updated_at,created_by_name,final_image_url,current_version_id")
      .order("updated_at", { ascending: false })
      .limit(100)
      .returns<SavedPosterRow[]>();

    if (queryError) {
      setError(queryError.message);
      setPosters([]);
    } else {
      setPosters(data ?? []);
    }
    setLoading(null);
  }

  async function selectPoster(poster: SavedPosterRow) {
    setSelectedPoster(poster);
    setGeneratedImageUrl(null);
    setGeneratedFromVersionId(null);
    setRevisionText("");
    setLoading("versions");
    setError(null);
    const { data, error: queryError } = await supabase
      .from("poster_versions")
      .select("id,poster_id,version_no,created_at,created_by_name,source_type,image_url,thumbnail_url,prompt_used,revision_instruction")
      .eq("poster_id", poster.id)
      .order("version_no", { ascending: false })
      .returns<PosterVersionRow[]>();

    if (queryError) {
      setError(queryError.message);
      setVersions([]);
      setSelectedVersion(null);
    } else {
      const nextVersions = data ?? [];
      setVersions(nextVersions);
      setSelectedVersion(
        nextVersions.find((version) => version.id === poster.current_version_id) ??
          nextVersions[0] ??
          null,
      );
    }
    setLoading(null);
  }

  async function handleUploadSeed(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setLoading("upload");
    setError(null);
    try {
      const title = safePosterFilename(file.name.replace(/\.[^.]+$/, ""), "업로드 포스터");
      const result = await savePosterVersion({
        supabase,
        blob: file,
        title,
        category: "custom",
        ratio: uploadRatio,
        sourceType: "uploaded",
        promptUsed: "Uploaded image revision seed",
      });
      await loadPosters();
      const uploadedPoster: SavedPosterRow = {
        id: result.posterId,
        title,
        category: "custom",
        ratio: uploadRatio,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by_name: null,
        final_image_url: result.imageUrl,
        current_version_id: result.versionId,
      };
      await selectPoster(uploadedPoster);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRevise() {
    const instruction = revisionText.trim();
    if (!selectedPoster || !selectedVersion || !instruction) return;

    setLoading("revise");
    setError(null);
    try {
      const sourceDataUrl = await imageUrlToDataUrl(
        `/api/posters/proxy-image?url=${encodeURIComponent(selectedVersion.image_url)}`,
      );
      const footerReferenceImages = await buildFooterReferenceImages();
      const response = await fetch("/api/posters/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedVersion.prompt_used || `Revise this Korean church poster titled "${selectedPoster.title}".`,
          ratio: selectedPoster.ratio,
          artStyle: "photoRealistic",
          mode: "revise",
          revisionInstruction: `${instruction}

Keep this as one complete Korean church poster. Preserve the Korean poster text and keep the church footer naturally integrated at the bottom with the logo, QR code, phone number, and address.`,
          sourceImageDataUrls: [sourceDataUrl, ...footerReferenceImages],
          includeFooterContent: true,
          posterTitle: selectedPoster.title,
          posterCategory: selectedPoster.category,
        }),
      });
      const data = (await response.json()) as GenerateImageResponse;
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "수정 이미지 생성에 실패했습니다.");
      }
      setGeneratedImageUrl(data.imageUrl);
      setGeneratedFromVersionId(selectedVersion.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownloadRevised() {
    if (!selectedPoster || !generatedImageUrl) return;
    setLoading("download");
    setError(null);
    try {
      const blob = await dataUrlToBlob(generatedImageUrl);
      const filename = `${safePosterFilename(selectedPoster.title)}-${selectedPoster.ratio.replace(":", "x")}-${Date.now()}.png`;
      downloadBlob(blob, filename);

      const saved = await savePosterVersion({
        supabase,
        blob,
        title: selectedPoster.title,
        category: selectedPoster.category,
        ratio: selectedPoster.ratio,
        sourceType: "revised",
        promptUsed: selectedVersion?.prompt_used || `Revise this Korean church poster titled "${selectedPoster.title}".`,
        revisionInstruction: revisionText,
        posterId: selectedPoster.id,
        inputVersionId: generatedFromVersionId,
        model: "gpt-image-2",
        quality: "medium",
        size: selectedPoster.ratio,
      });

      await loadPosters();
      await selectPoster({
        ...selectedPoster,
        final_image_url: saved.imageUrl,
        current_version_id: saved.versionId,
        updated_at: new Date().toISOString(),
      });
      setGeneratedImageUrl(null);
      setGeneratedFromVersionId(null);
      setRevisionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정본 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(null);
    }
  }

  const previewUrl = generatedImageUrl ?? selectedVersion?.image_url ?? selectedPoster?.final_image_url ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">저장된 포스터</h2>
            <p className="mt-1 text-sm text-gray-500">다운로드하며 저장된 포스터를 최신 버전 기준으로 이어 수정합니다.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={uploadRatio}
              onChange={(event) => setUploadRatio(event.target.value as PosterRatio)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700"
              aria-label="업로드 포스터 비율"
            >
              {POSTER_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {POSTER_RATIO_LABEL[ratio]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading === "upload"}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300"
            >
              {loading === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              업로드하여 이어가기
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadSeed} className="hidden" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">목록</p>
            <button
              type="button"
              onClick={loadPosters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw size={13} />
              새로고침
            </button>
          </div>
          {loading === "list" ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              불러오는 중
            </div>
          ) : posters.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-gray-500">
              <ImagePlus size={28} className="text-gray-300" />
              저장된 포스터가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {posters.map((poster) => (
                <button
                  key={poster.id}
                  type="button"
                  onClick={() => selectPoster(poster)}
                  className={cn(
                    "grid w-full grid-cols-[72px_minmax(0,1fr)] gap-3 px-4 py-3 text-left hover:bg-gray-50",
                    selectedPoster?.id === poster.id && "bg-primary-50/60",
                  )}
                >
                  <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={poster.final_image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{poster.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{poster.created_by_name || "작성자 미상"}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(poster.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">이어 수정</h2>
            {loading === "versions" && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          {previewUrl ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="선택한 포스터" className="max-h-[520px] w-full object-contain" />
              </div>

              {versions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">버전 이력</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() => {
                          setSelectedVersion(version);
                          setGeneratedImageUrl(null);
                          setGeneratedFromVersionId(null);
                        }}
                        className={cn(
                          "shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                          selectedVersion?.id === version.id
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        v{version.version_no}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                value={revisionText}
                onChange={(event) => setRevisionText(event.target.value)}
                rows={3}
                placeholder="예: footer는 유지하고 전체 톤을 더 밝고 따뜻하게 바꿔줘"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleRevise}
                disabled={loading === "revise" || !revisionText.trim() || !selectedVersion}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300"
              >
                {loading === "revise" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                수정 요청
              </button>

              {generatedImageUrl && (
                <button
                  type="button"
                  onClick={handleDownloadRevised}
                  disabled={loading === "download"}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {loading === "download" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  수정본 다운로드 및 저장
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
              <ImagePlus size={32} className="text-gray-300" />
              목록에서 포스터를 선택하거나 이미지를 업로드하세요.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function buildFooterReferenceImages(): Promise<string[]> {
  const refs: string[] = [];
  const assets = await Promise.allSettled([
    loadImageElement("/logo.png"),
    loadImageElement("/qr-links.svg"),
  ]);

  for (const asset of assets) {
    if (asset.status === "fulfilled") {
      refs.push(await imageToDataUrl(asset.value));
    }
  }

  return refs;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function imageToDataUrl(img: HTMLImageElement): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width || 512;
  canvas.height = img.naturalHeight || img.height || 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas context unavailable"));
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return Promise.resolve(canvas.toDataURL("image/png"));
}
