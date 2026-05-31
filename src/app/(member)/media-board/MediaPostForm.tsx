"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
  validateFile,
  safeExtension,
  BoardPostSchema,
} from "@/lib/validation";
import { compressImage } from "@/lib/image-compress";
import { ImportReviewModal } from "@/components/media-board/ImportReviewModal";
import type { BoardPost } from "@/types/board";
import type {
  MediaImportResponse,
  MediaImportApiError,
  MediaImportResult,
} from "@/types/media-board";

const HARD_MAX = 50 * 1024 * 1024; // 50MB 절대 상한 (브라우저 OOM 방지)
const MAX_IMAGES = 10;
const STORAGE_BUCKET = "board-images";

export function MediaPostForm({
  boardId,
  onCreated,
}: {
  boardId: string;
  onCreated: (post: BoardPost) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<MediaImportResult | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const hwpxRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const baseCheck = validateFile(file, ALLOWED_IMAGE_EXTENSIONS, HARD_MAX);
        if (!baseCheck.ok) {
          alert(`${file.name}: ${baseCheck.reason}`);
          continue;
        }

        let toUpload: File = file;
        if (file.size > MAX_BLOG_IMAGE_SIZE) {
          try {
            const result = await compressImage(file, MAX_BLOG_IMAGE_SIZE);
            toUpload = result.file;
          } catch (e) {
            const reason = e instanceof Error ? e.message : "압축 실패";
            alert(`${file.name}: ${reason}`);
            continue;
          }
        }

        const ext = safeExtension(toUpload.name, ALLOWED_IMAGE_EXTENSIONS);
        const path = `${boardId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, toUpload, { contentType: toUpload.type });
        if (upErr) {
          alert(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      if (newUrls.length > 0) {
        setImages((prev) => [...prev, ...newUrls]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleHwpx(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext !== "hwpx") {
      alert(".hwpx 파일만 업로드할 수 있습니다.");
      if (hwpxRef.current) hwpxRef.current.value = "";
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/media-board/import-hwpx", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!r.ok) {
        const errData = (await r
          .json()
          .catch(() => ({ error: "변환 실패" }))) as MediaImportApiError;
        alert(errData.error ?? "변환 실패");
        return;
      }
      const data = (await r.json()) as MediaImportResponse;
      setImportResult(data.result);
    } finally {
      setImporting(false);
      if (hwpxRef.current) hwpxRef.current.value = "";
    }
  }

  async function removeImage(idx: number) {
    const url = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    try {
      const u = new URL(url);
      const segments = u.pathname.split(`/${STORAGE_BUCKET}/`);
      const path = segments[1];
      if (path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      }
    } catch {
      /* ignore — 삭제 실패해도 글 작성에는 영향 없음 */
    }
  }

  async function submitPost(payload: {
    title: string;
    content: string;
    images: string[];
  }): Promise<BoardPost | null> {
    const check = BoardPostSchema.safeParse(payload);
    if (!check.success) {
      alert(check.error.issues[0].message);
      return null;
    }
    const r = await fetch(`/api/boards/${boardId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
      credentials: "same-origin",
    });
    if (!r.ok) {
      const errData = (await r.json().catch(() => ({ error: "작성 실패" }))) as {
        error?: string;
      };
      alert(errData.error ?? "작성 실패");
      return null;
    }
    return (await r.json()) as BoardPost;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const post = await submitPost({ title, content, images });
    setSubmitting(false);
    if (!post) return;
    setTitle("");
    setContent("");
    setImages([]);
    onCreated(post);
  }

  async function handleReviewSubmit(payload: {
    title: string;
    content: string;
    images: string[];
  }) {
    const post = await submitPost(payload);
    if (!post) return;
    setImportResult(null);
    setTitle("");
    setContent("");
    setImages([]);
    onCreated(post);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={150}
          required
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용 (또는 회의록 .hwpx 업로드로 자동 작성)"
          rows={6}
          maxLength={30000}
          required
          className="mb-3 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />

        {images.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative">
                <Image
                  src={url}
                  alt={`첨부 ${i + 1}`}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-lg object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white"
                  aria-label="이미지 제거"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || images.length >= MAX_IMAGES}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImagePlus size={14} />
              )}
              이미지 ({images.length}/{MAX_IMAGES})
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />

            <button
              type="button"
              onClick={() => hwpxRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileUp size={14} />
              )}
              회의록(.hwpx) 변환
            </button>
            <input
              ref={hwpxRef}
              type="file"
              accept=".hwpx"
              hidden
              onChange={(e) => handleHwpx(e.target.files)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || uploading || importing}
            className="rounded-lg bg-primary-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "작성 중..." : "등록"}
          </button>
        </div>
      </form>

      {importResult && (
        <ImportReviewModal
          result={importResult}
          onCancel={() => setImportResult(null)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </>
  );
}
