"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PosterCategory, PosterRatio } from "@/lib/poster-prompts";
import { deleteFromR2, uploadToR2 } from "@/lib/r2/upload-client";

/** R2 prefix. 이름은 Supabase 버킷명을 그대로 승계한다. */
export const POSTER_IMAGE_BUCKET = "poster-images";
const MAX_STORAGE_BYTES = 10 * 1024 * 1024;
const STORAGE_SAFETY_BYTES = 9.5 * 1024 * 1024;

export type PosterVersionSourceType =
  | "generated"
  | "revised"
  | "uploaded"
  | "book_recommendation";

export interface SavedPosterRow {
  id: string;
  title: string;
  category: PosterCategory;
  ratio: PosterRatio;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  final_image_url: string;
  current_version_id: string | null;
}

export interface PosterVersionRow {
  id: string;
  poster_id: string;
  version_no: number;
  created_at: string;
  created_by_name: string | null;
  source_type: PosterVersionSourceType;
  image_url: string;
  thumbnail_url: string | null;
  prompt_used: string | null;
  revision_instruction: string | null;
}

interface SavePosterVersionInput {
  supabase: SupabaseClient;
  blob: Blob;
  title: string;
  category: PosterCategory;
  ratio: PosterRatio;
  sourceType: PosterVersionSourceType;
  promptUsed: string;
  bodyText?: string;
  revisionInstruction?: string | null;
  posterId?: string | null;
  inputVersionId?: string | null;
  model?: string | null;
  quality?: string | null;
  size?: string | null;
}

interface SavePosterVersionResult {
  posterId: string;
  versionId: string;
  versionNo: number;
  imageUrl: string;
  thumbnailUrl: string | null;
}

interface ProfileSnapshot {
  name: string | null;
}

interface ImageBlobInfo {
  blob: Blob;
  extension: "png" | "jpg" | "webp";
  contentType: "image/png" | "image/jpeg" | "image/webp";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("이미지 데이터를 읽지 못했습니다.");
  return response.blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("이미지를 data URL로 변환하지 못했습니다."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("이미지 읽기 실패"));
    reader.readAsDataURL(blob);
  });
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("이미지를 불러오지 못했습니다.");
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return blobToDataUrl(file);
}

export function safePosterFilename(title: string, fallback = "poster"): string {
  return (title.trim() || fallback).replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || fallback;
}

export async function savePosterVersion({
  supabase,
  blob,
  title,
  category,
  ratio,
  sourceType,
  promptUsed,
  bodyText,
  revisionInstruction,
  posterId,
  inputVersionId,
  model,
  quality,
  size,
}: SavePosterVersionInput): Promise<SavePosterVersionResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle<ProfileSnapshot>();

  const createdByName = profile?.name ?? user.email ?? null;
  const normalizedTitle = title.trim().slice(0, 100) || "포스터";
  const normalizedPrompt = promptUsed.trim() || "Uploaded image revision seed";
  const targetPosterId = posterId ?? crypto.randomUUID();
  const versionNo = posterId
    ? await nextVersionNo(supabase, posterId)
    : 1;

  const prepared = await prepareImageForStorage(blob);
  const dimensions = await getImageDimensions(prepared.blob);
  // Supabase 시절엔 `upsert: false` 가 같은 versionNo 로 두 번 저장되는 사고를
  // 에러로 잡아줬다. R2 PUT 은 무조건 덮어쓰므로, 난수 suffix 로 키가 겹치지
  // 않게 만들어 조용한 덮어쓰기를 막는다. `v001-` 접두는 가독성용.
  const versionLabel = `v${String(versionNo).padStart(3, "0")}`;
  const uniqueLabel = `${versionLabel}-${crypto.randomUUID().slice(0, 6)}`;
  const thumb = await createPosterThumbnail(prepared.blob);

  const uploadedKeys: string[] = [];
  let insertedVersionId: string | null = null;

  try {
    const image = await uploadToR2({
      file: prepared.blob,
      prefix: POSTER_IMAGE_BUCKET,
      scope: ["posters", targetPosterId, "versions"],
      filename: `poster.${prepared.extension}`,
      basename: uniqueLabel,
    });
    uploadedKeys.push(image.key);

    let thumbnailUrl: string | null = null;
    let thumbnailStoragePath: string | null = null;
    if (thumb) {
      // 썸네일 실패는 치명적이지 않다 — 본 이미지는 이미 올라갔으므로 계속 진행.
      try {
        const uploadedThumb = await uploadToR2({
          file: thumb,
          prefix: POSTER_IMAGE_BUCKET,
          scope: ["posters", targetPosterId, "thumbs"],
          filename: "thumb.webp",
          basename: uniqueLabel,
        });
        uploadedKeys.push(uploadedThumb.key);
        thumbnailStoragePath = uploadedThumb.key;
        thumbnailUrl = uploadedThumb.publicUrl;
      } catch {
        // 썸네일 없이 진행.
      }
    }

    const imageUrl = image.publicUrl;
    const imagePath = image.key;

    if (!posterId) {
      const { error: posterError } = await supabase.from("posters").insert({
        id: targetPosterId,
        created_by: user.id,
        created_by_name: createdByName,
        category,
        title: normalizedTitle,
        body_text: bodyText?.slice(0, 500) || null,
        prompt_used: normalizedPrompt,
        ratio,
        ai_image_url: imageUrl,
        final_image_url: imageUrl,
      });
      if (posterError) throw posterError;
    }

    const { data: version, error: versionError } = await supabase
      .from("poster_versions")
      .insert({
        poster_id: targetPosterId,
        version_no: versionNo,
        created_by: user.id,
        created_by_name: createdByName,
        source_type: sourceType,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        storage_path: imagePath,
        thumbnail_storage_path: thumbnailStoragePath,
        prompt_used: normalizedPrompt,
        revision_instruction: revisionInstruction?.trim() || null,
        input_version_id: inputVersionId || null,
        mime_type: prepared.contentType,
        width: dimensions.width,
        height: dimensions.height,
        file_size_bytes: prepared.blob.size,
        model: model || null,
        quality: quality || null,
        size: size || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (versionError || !version) throw versionError ?? new Error("버전 저장에 실패했습니다.");
    insertedVersionId = version.id;

    const { error: updateError } = await supabase
      .from("posters")
      .update({
        current_version_id: version.id,
        final_image_url: imageUrl,
        ai_image_url: imageUrl,
        prompt_used: normalizedPrompt,
        title: normalizedTitle,
        ratio,
      })
      .eq("id", targetPosterId);

    if (updateError) throw updateError;

    return {
      posterId: targetPosterId,
      versionId: version.id,
      versionNo,
      imageUrl,
      thumbnailUrl,
    };
  } catch (error) {
    if (insertedVersionId) {
      try {
        await supabase.from("poster_versions").delete().eq("id", insertedVersionId);
      } catch {
        // Best-effort cleanup only.
      }
    }
    if (!posterId) {
      try {
        await supabase.from("posters").delete().eq("id", targetPosterId);
      } catch {
        // Best-effort cleanup only.
      }
    }
    if (uploadedKeys.length > 0) {
      try {
        await deleteFromR2({ keys: uploadedKeys });
      } catch {
        // Best-effort cleanup only.
      }
    }
    throw error;
  }
}

async function nextVersionNo(supabase: SupabaseClient, posterId: string): Promise<number> {
  const { data, error } = await supabase
    .from("poster_versions")
    .select("version_no")
    .eq("poster_id", posterId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_no: number }>();

  if (error) throw error;
  return (data?.version_no ?? 0) + 1;
}

async function prepareImageForStorage(blob: Blob): Promise<ImageBlobInfo> {
  if (blob.size <= STORAGE_SAFETY_BYTES && isAllowedImageType(blob.type)) {
    return {
      blob,
      extension: extensionForMimeType(blob.type),
      contentType: blob.type as ImageBlobInfo["contentType"],
    };
  }

  const compressed = await transcodeImage(blob, "image/jpeg", 0.9);
  if (compressed.size > MAX_STORAGE_BYTES) {
    throw new Error("저장할 이미지가 10MB를 초과합니다. 더 작은 이미지로 다시 시도해 주세요.");
  }
  return {
    blob: compressed,
    extension: "jpg",
    contentType: "image/jpeg",
  };
}

function isAllowedImageType(type: string): boolean {
  return type === "image/png" || type === "image/jpeg" || type === "image/webp";
}

function extensionForMimeType(type: string): ImageBlobInfo["extension"] {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

async function createPosterThumbnail(blob: Blob): Promise<Blob | null> {
  try {
    return await transcodeImage(blob, "image/webp", 0.78, 480);
  } catch {
    return null;
  }
}

async function transcodeImage(
  blob: Blob,
  mimeType: "image/jpeg" | "image/webp",
  quality: number,
  maxEdge?: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error("이미지 변환에 실패했습니다."));
        },
        mimeType,
        quality,
      );
    });
  } finally {
    bitmap.close();
  }
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
