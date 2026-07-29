"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteFromR2, uploadToR2 } from "@/lib/r2/upload-client";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
  validateFile,
  BoardPostSchema,
} from "@/lib/validation";
import { compressImage } from "@/lib/image-compress";
import type { BoardPost } from "@/types/board";

const HARD_MAX = 50 * 1024 * 1024; // 50MB 절대 상한 (브라우저 OOM 방지)
const MAX_IMAGES = 10;

export function BoardPostForm({
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
  const fileRef = useRef<HTMLInputElement>(null);

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

        try {
          const uploaded = await uploadToR2({
            file: toUpload,
            prefix: "board-images",
            scope: [boardId, user.id],
          });
          newUrls.push(uploaded.publicUrl);
        } catch (e) {
          alert(`${file.name}: ${e instanceof Error ? e.message : "업로드 실패"}`);
          continue;
        }
      }
      if (newUrls.length > 0) {
        setImages((prev) => [...prev, ...newUrls]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(idx: number) {
    const url = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    // 스토리지에서도 삭제 (작성 중인 폼 한정 — 다른 글에서 안 씀)
    await deleteFromR2({ urls: [url] }).catch(() => {
      /* 삭제 실패해도 글 작성에는 영향 없음 */
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardPostSchema.safeParse({ title, content, images });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch(`/api/boards/${boardId}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
    });
    setSubmitting(false);
    if (!r.ok) {
      const errData = (await r.json().catch(() => ({ error: "작성 실패" }))) as {
        error?: string;
      };
      alert(errData.error ?? "작성 실패");
      return;
    }
    const post = (await r.json()) as BoardPost;
    setTitle("");
    setContent("");
    setImages([]);
    onCreated(post);
  }

  return (
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
        placeholder="내용"
        rows={6}
        maxLength={10000}
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

      <div className="flex items-center justify-between">
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
          type="submit"
          disabled={submitting || uploading}
          className="rounded-lg bg-primary-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "작성 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
