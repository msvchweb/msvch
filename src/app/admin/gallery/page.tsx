"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Upload, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronRight, AlertCircle, Pencil, Star } from "lucide-react";
import {
  validateFile,
  safeExtension,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_UPLOAD_FILES,
  GalleryAlbumSchema,
  GalleryAlbumUpdateSchema,
} from "@/lib/validation";
import { compressImage } from "@/lib/image-compress";
import { fetchAuthorRecordMap, type ContentAuthor } from "@/lib/content-authors";
import { useMe, canDelete, canEdit } from "@/lib/use-me";
import {
  GALLERY_CATEGORIES,
  buildTagsFromCategory,
  getSubCategories,
  hasSubCategories,
  splitTagsToCategoryAndSub,
} from "@/lib/gallery-categories";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

/** 압축 전 절대 상한 — 브라우저 OOM 방지 */
const HARD_MAX_BYTES = 50 * 1024 * 1024;

/** 관리자 갤러리 1페이지당 앨범 수 — 초기 로딩 부담 완화 */
const PAGE_SIZE = 20;

/** 사용자 친화 사전검증 — HEIC 등 흔한 비호환 형식 안내 */
function preflightCheck(file: File): { ok: true } | { ok: false; reason: string } {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) {
    return {
      ok: false,
      reason: "HEIC 형식은 지원하지 않습니다. iPhone 설정에서 카메라 → 포맷 → '높은 호환성(JPEG)' 으로 바꾸거나, 사진을 JPEG로 변환 후 업로드 해주세요.",
    };
  }
  return validateFile(file, ALLOWED_IMAGE_EXTENSIONS, HARD_MAX_BYTES);
}

export default function AdminGalleryPage() {
  const me = useMe();
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [imageCounts, setImageCounts] = useState<Record<string, number>>({});
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [albumImages, setAlbumImages] = useState<Record<string, GalleryImage[]>>({});
  const [albumLoadingIds, setAlbumLoadingIds] = useState<Set<string>>(new Set());
  const [authorMap, setAuthorMap] = useState<Record<string, ContentAuthor>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(GALLERY_CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [subCategory, setSubCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  /** 업로드 실패 내역 — albumId 별로 누적, 사용자가 명시적으로 닫기 전까지 표시 */
  const [uploadFailures, setUploadFailures] = useState<Record<string, string[]>>({});
  /** 현재 편집 중인 앨범 id (한 번에 1개만) */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 편집 폼 임시 상태 */
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<string>(GALLERY_CATEGORIES[0]);
  const [editSubCategory, setEditSubCategory] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadAlbums = useCallback(async () => {
    // 첫 페이지만 가져오기 — 이미지는 lazy fetch, 나머지 앨범은 "더보기"로
    const { data: albumsData } = await supabase
      .from("gallery_albums")
      .select("*")
      .order("date", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    if (!albumsData) {
      setLoading(false);
      return;
    }

    // 이미지 카운트만 가벼운 쿼리로 한 번에
    const albumIds = albumsData.map((a) => a.id as string);
    const { data: countRows } = await supabase
      .from("gallery_images")
      .select("album_id")
      .in("album_id", albumIds);

    const counts: Record<string, number> = {};
    for (const row of countRows ?? []) {
      const id = row.album_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }

    const result: GalleryAlbum[] = albumsData.map((album) => ({
      id: album.id as string,
      title: album.title as string,
      category: album.category as string | null,
      tags: (album.tags as string[] | null) ?? [],
      date: album.date as string | null,
      thumbnail_url: album.thumbnail_url as string | null,
      is_public: album.is_public as boolean,
      created_at: album.created_at as string,
      images: [],
    }));

    setAlbums(result);
    setImageCounts(counts);
    setHasMore(albumsData.length === PAGE_SIZE);
    const map = await fetchAuthorRecordMap(
      supabase,
      "gallery_album",
      result.map((a) => a.id),
    );
    setAuthorMap(map);
    setLoading(false);
  }, [supabase]);

  async function loadMoreAlbums() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = albums.length;
      const { data: albumsData } = await supabase
        .from("gallery_albums")
        .select("*")
        .order("date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (!albumsData || albumsData.length === 0) {
        setHasMore(false);
        return;
      }

      const albumIds = albumsData.map((a) => a.id as string);
      const { data: countRows } = await supabase
        .from("gallery_images")
        .select("album_id")
        .in("album_id", albumIds);

      const counts: Record<string, number> = {};
      for (const row of countRows ?? []) {
        const id = row.album_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }

      const more: GalleryAlbum[] = albumsData.map((album) => ({
        id: album.id as string,
        title: album.title as string,
        category: album.category as string | null,
        tags: (album.tags as string[] | null) ?? [],
        date: album.date as string | null,
        thumbnail_url: album.thumbnail_url as string | null,
        is_public: album.is_public as boolean,
        created_at: album.created_at as string,
        images: [],
      }));

      const map = await fetchAuthorRecordMap(
        supabase,
        "gallery_album",
        more.map((a) => a.id),
      );

      setAlbums((prev) => [...prev, ...more]);
      setImageCounts((prev) => ({ ...prev, ...counts }));
      setAuthorMap((prev) => ({ ...prev, ...map }));
      setHasMore(albumsData.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  async function fetchAlbumImages(albumId: string): Promise<GalleryImage[]> {
    const { data } = await supabase
      .from("gallery_images")
      .select("*")
      .eq("album_id", albumId)
      .order("sort_order", { ascending: true });
    return (data ?? []) as GalleryImage[];
  }

  async function toggleExpand(albumId: string) {
    const isOpen = expandedAlbums.has(albumId);
    if (isOpen) {
      setExpandedAlbums((prev) => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
      return;
    }

    setExpandedAlbums((prev) => new Set(prev).add(albumId));

    // 이미 로드된 적 있으면 재사용
    if (albumImages[albumId]) return;

    setAlbumLoadingIds((prev) => new Set(prev).add(albumId));
    try {
      const images = await fetchAlbumImages(albumId);
      setAlbumImages((prev) => ({ ...prev, [albumId]: images }));
    } finally {
      setAlbumLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(albumId);
        return next;
      });
    }
  }

  async function refreshAlbumImages(albumId: string) {
    const images = await fetchAlbumImages(albumId);
    setAlbumImages((prev) => ({ ...prev, [albumId]: images }));
    setImageCounts((prev) => ({ ...prev, [albumId]: images.length }));
  }

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    const check = GalleryAlbumSchema.safeParse({
      title,
      category,
      date: date || undefined,
    });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }

    const tags = buildTagsFromCategory(category, subCategory || null);

    const { error } = await supabase.from("gallery_albums").insert({
      title: check.data.title,
      category: check.data.category,
      tags,
      date: check.data.date || null,
      is_public: false,
    });
    if (!error) {
      setTitle("");
      setSubCategory("");
      setDate(new Date().toISOString().split("T")[0]);
      setShowForm(false);
      loadAlbums();
    }
  }

  async function togglePublic(albumId: string, current: boolean) {
    await supabase
      .from("gallery_albums")
      .update({ is_public: !current })
      .eq("id", albumId);
    loadAlbums();
  }

  async function deleteAlbum(albumId: string) {
    if (!confirm("이 앨범과 모든 사진을 삭제하시겠습니까?")) return;

    // 삭제 시점에 이미지 목록 확보 (lazy 로드 안 됐을 수 있음)
    const images = albumImages[albumId] ?? (await fetchAlbumImages(albumId));
    const paths = images.map((img) => {
      try {
        const url = new URL(img.image_url);
        return url.pathname.split("/gallery/")[1];
      } catch {
        return "";
      }
    }).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("gallery").remove(paths);
    }

    await supabase.from("gallery_albums").delete().eq("id", albumId);
    setAlbumImages((prev) => {
      const next = { ...prev };
      delete next[albumId];
      return next;
    });
    loadAlbums();
  }

  async function uploadImages(albumId: string, files: File[]) {
    if (files.length > MAX_UPLOAD_FILES) {
      alert(`한 번에 최대 ${MAX_UPLOAD_FILES}장까지 업로드할 수 있습니다.`);
      return;
    }

    // ── 1단계: 사전검증 ────────────────────────────────────────
    // 업로드 시작 전에 모든 파일을 검사해서 즉시 사용자에게 거부 사유 제공
    const validFiles: File[] = [];
    const preflightFailures: string[] = [];
    for (const f of files) {
      const r = preflightCheck(f);
      if (r.ok) {
        validFiles.push(f);
      } else {
        preflightFailures.push(`${f.name}: ${r.reason}`);
        console.error("[gallery upload] preflight fail", f.name, r.reason);
      }
    }

    if (validFiles.length === 0) {
      setUploadFailures((prev) => ({ ...prev, [albumId]: preflightFailures }));
      alert(
        `업로드 가능한 파일이 없습니다.\n\n` +
          preflightFailures.slice(0, 10).join("\n") +
          (preflightFailures.length > 10
            ? `\n…외 ${preflightFailures.length - 10}장`
            : ""),
      );
      return;
    }

    if (preflightFailures.length > 0) {
      const proceed = confirm(
        `${preflightFailures.length}장은 업로드할 수 없습니다 (HEIC/형식/용량). ` +
          `${validFiles.length}장만 업로드할까요?\n\n` +
          preflightFailures.slice(0, 5).join("\n") +
          (preflightFailures.length > 5
            ? `\n…외 ${preflightFailures.length - 5}장`
            : ""),
      );
      if (!proceed) return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: validFiles.length });

    const album = albums.find((a) => a.id === albumId);
    const existingCount = imageCounts[albumId] ?? album?.images.length ?? 0;
    const failures: string[] = [...preflightFailures];
    let successCount = 0;
    let firstUploadedUrl: string | null = null;

    for (let i = 0; i < validFiles.length; i++) {
      const original = validFiles[i];

      // MAX_IMAGE_SIZE(10MB) 초과면 자동 압축
      let toUpload = original;
      if (original.size > MAX_IMAGE_SIZE) {
        try {
          const result = await compressImage(original, MAX_IMAGE_SIZE);
          toUpload = result.file;
        } catch (e) {
          const reason = e instanceof Error ? e.message : "압축 실패";
          failures.push(`${original.name}: ${reason}`);
          console.error("[gallery upload] compress fail", original.name, e);
          setUploadProgress({ done: i + 1, total: validFiles.length });
          continue;
        }
      }

      const ext = safeExtension(toUpload.name, ALLOWED_IMAGE_EXTENSIONS);
      const path = `${albumId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(path, toUpload, { contentType: toUpload.type });

      if (uploadError) {
        failures.push(`${original.name}: 스토리지 업로드 실패 (${uploadError.message})`);
        console.error("[gallery upload] storage fail", original.name, uploadError);
        setUploadProgress({ done: i + 1, total: validFiles.length });
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from("gallery_images").insert({
        album_id: albumId,
        image_url: urlData.publicUrl,
        sort_order: existingCount + successCount,
      });

      if (dbError) {
        failures.push(`${original.name}: DB 저장 실패 (${dbError.message})`);
        console.error("[gallery upload] db fail", original.name, dbError);
        // 스토리지 고아 파일 정리
        await supabase.storage.from("gallery").remove([path]).catch(() => {});
        setUploadProgress({ done: i + 1, total: validFiles.length });
        continue;
      }

      if (firstUploadedUrl === null) firstUploadedUrl = urlData.publicUrl;
      successCount++;
      setUploadProgress({ done: i + 1, total: validFiles.length });
    }

    // 빈 앨범에 처음 업로드된 사진이 있으면 thumbnail 설정
    if (existingCount === 0 && firstUploadedUrl) {
      await supabase
        .from("gallery_albums")
        .update({ thumbnail_url: firstUploadedUrl })
        .eq("id", albumId);
    }

    setUploading(false);
    setUploadProgress(null);

    if (failures.length > 0) {
      setUploadFailures((prev) => ({ ...prev, [albumId]: failures }));
    } else {
      setUploadFailures((prev) => {
        const next = { ...prev };
        delete next[albumId];
        return next;
      });
    }

    // 결과 요약 — 화면에도 남고, 알림으로도 안내
    if (failures.length > 0) {
      alert(
        `${successCount}장 업로드 완료, ${failures.length}장 실패.\n` +
          `자세한 내용은 앨범 아래 빨간 박스에 표시됩니다 (콘솔에도 기록).`,
      );
    } else if (validFiles.length > 1) {
      alert(`${successCount}장 업로드 완료`);
    }

    // 펼쳐진 앨범이면 이미지 캐시 갱신, 아니면 카운트만 갱신
    if (expandedAlbums.has(albumId)) {
      await refreshAlbumImages(albumId);
    } else {
      setImageCounts((prev) => ({
        ...prev,
        [albumId]: (prev[albumId] ?? 0) + successCount,
      }));
    }
    // 썸네일이 새로 설정된 경우 앨범 목록도 다시 로드
    if (existingCount === 0 && firstUploadedUrl) {
      loadAlbums();
    }
  }

  async function deleteImage(imageId: string, imageUrl: string, albumId: string) {
    try {
      const path = new URL(imageUrl).pathname.split("/gallery/")[1];
      if (path) {
        await supabase.storage.from("gallery").remove([path]);
      }
    } catch {
      /* URL 파싱 실패 — 무시하고 DB 삭제 진행 */
    }
    await supabase.from("gallery_images").delete().eq("id", imageId);
    await refreshAlbumImages(albumId);
  }

  function startEdit(album: GalleryAlbum) {
    const { category: initCat, subCategory: initSub } = splitTagsToCategoryAndSub(
      album.tags,
      album.category,
    );
    setEditingId(album.id);
    setEditTitle(album.title);
    setEditCategory(initCat);
    setEditSubCategory(initSub);
    setEditDate(album.date ?? "");
    setEditIsPublic(album.is_public);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditCategory(GALLERY_CATEGORIES[0]);
    setEditSubCategory("");
    setEditDate("");
    setEditIsPublic(false);
  }

  async function saveEdit(albumId: string) {
    const subSafe = hasSubCategories(editCategory) ? editSubCategory || null : null;
    const check = GalleryAlbumUpdateSchema.safeParse({
      title: editTitle,
      category: editCategory,
      subCategory: subSafe,
      date: editDate || null,
      isPublic: editIsPublic,
    });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }

    setEditSaving(true);
    try {
      const tags = buildTagsFromCategory(editCategory, subSafe);
      const { error } = await supabase
        .from("gallery_albums")
        .update({
          title: editTitle,
          category: editCategory,
          tags,
          date: editDate || null,
          is_public: editIsPublic,
        })
        .eq("id", albumId);

      if (error) {
        alert(`수정 실패: ${error.message}`);
        return;
      }

      cancelEdit();
      await loadAlbums();
    } finally {
      setEditSaving(false);
    }
  }

  async function setAsThumbnail(albumId: string, imageUrl: string) {
    const { error } = await supabase
      .from("gallery_albums")
      .update({ thumbnail_url: imageUrl })
      .eq("id", albumId);
    if (error) {
      alert(`썸네일 변경 실패: ${error.message}`);
      return;
    }
    // 헤더 썸네일은 albums 상태에 들어 있으므로 in-place 갱신
    setAlbums((prev) =>
      prev.map((a) => (a.id === albumId ? { ...a, thumbnail_url: imageUrl } : a)),
    );
  }

  function dismissFailures(albumId: string) {
    setUploadFailures((prev) => {
      const next = { ...prev };
      delete next[albumId];
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">갤러리 관리</h1>
        <button
          data-tour="gallery-new"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          {showForm ? "취소" : "새 앨범"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createAlbum}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                앨범 제목
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubCategory("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {GALLERY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {hasSubCategories(category) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  하위부서
                </label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">선택 안함</option>
                  {getSubCategories(category).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                날짜
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            앨범 생성
          </button>
        </form>
      )}

      <div className="space-y-4">
        {albums.map((album) => {
          const isExpanded = expandedAlbums.has(album.id);
          const isAlbumLoading = albumLoadingIds.has(album.id);
          const images = albumImages[album.id] ?? [];
          const count = imageCounts[album.id] ?? 0;
          const failures = uploadFailures[album.id];

          return (
            <div
              key={album.id}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => toggleExpand(album.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={18} className="shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="shrink-0 text-gray-400" />
                  )}
                  {album.thumbnail_url && (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      <Image
                        src={album.thumbnail_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-gray-900">{album.title}</h3>
                    <p className="text-sm text-gray-500">
                      {album.category} &middot; {album.date} &middot; {count}장
                      {authorMap[album.id]?.name ? ` · 작성: ${authorMap[album.id]?.name}` : ""}
                    </p>
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => togglePublic(album.id, album.is_public)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      album.is_public
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    title={album.is_public ? "공개 중" : "비공개"}
                  >
                    {album.is_public ? <Eye size={14} /> : <EyeOff size={14} />}
                    {album.is_public ? "공개" : "비공개"}
                  </button>
                  <button
                    data-tour="gallery-upload"
                    onClick={() => {
                      fileInputRef.current?.setAttribute("data-album-id", album.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploading
                      ? uploadProgress
                        ? `업로드 ${uploadProgress.done}/${uploadProgress.total}`
                        : "업로드 중..."
                      : `사진 추가 (최대 ${MAX_UPLOAD_FILES}장)`}
                  </button>
                  {canEdit(me, authorMap[album.id]?.id) && (
                    <button
                      onClick={() =>
                        editingId === album.id ? cancelEdit() : startEdit(album)
                      }
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        editingId === album.id
                          ? "bg-gray-200 text-gray-700"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      <Pencil size={14} />
                      {editingId === album.id ? "수정 취소" : "수정"}
                    </button>
                  )}
                  {canDelete(me, authorMap[album.id]?.id) && (
                    <button
                      onClick={() => deleteAlbum(album.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                  )}
                </div>
              </div>

              {editingId === album.id && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        제목
                      </label>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        카테고리
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => {
                          setEditCategory(e.target.value);
                          setEditSubCategory("");
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        {GALLERY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    {hasSubCategories(editCategory) ? (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          하위부서
                        </label>
                        <select
                          value={editSubCategory}
                          onChange={(e) => setEditSubCategory(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">선택 안함</option>
                          {getSubCategories(editCategory).map((sub) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div />
                    )}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        날짜
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-3">
                      <input
                        type="checkbox"
                        checked={editIsPublic}
                        onChange={(e) => setEditIsPublic(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      홈페이지에 공개
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(album.id)}
                      disabled={editSaving}
                      className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {editSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              )}

              {failures && failures.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                      <AlertCircle size={16} />
                      업로드 실패 {failures.length}장
                    </div>
                    <button
                      onClick={() => dismissFailures(album.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      닫기
                    </button>
                  </div>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-red-700">
                    {failures.map((line, idx) => (
                      <li key={idx} className="break-all">• {line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isExpanded && (
                <div className="mt-4">
                  {isAlbumLoading ? (
                    <p className="py-4 text-center text-sm text-gray-400">
                      이미지 불러오는 중...
                    </p>
                  ) : images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {images.map((img) => {
                        const isCurrentThumbnail = album.thumbnail_url === img.image_url;
                        return (
                          <div key={img.id} className="group relative aspect-square">
                            <Image
                              src={img.image_url}
                              alt=""
                              fill
                              className="rounded-lg object-cover"
                              sizes="100px"
                            />
                            {isCurrentThumbnail && (
                              <span
                                className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white"
                                title="현재 썸네일"
                              >
                                <Star size={10} className="fill-white" />
                                썸네일
                              </span>
                            )}
                            {canEdit(me, authorMap[album.id]?.id) && !isCurrentThumbnail && (
                              <button
                                onClick={() => setAsThumbnail(album.id, img.image_url)}
                                className="absolute left-1 top-1 hidden rounded-full bg-amber-500 p-1 text-white group-hover:block"
                                title="썸네일로 지정"
                              >
                                <Star size={12} />
                              </button>
                            )}
                            {canDelete(me, authorMap[album.id]?.id) && (
                              <button
                                onClick={() => deleteImage(img.id, img.image_url, album.id)}
                                className="absolute right-1 top-1 hidden rounded-full bg-red-500 p-1 text-white group-hover:block"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-gray-400">
                      사진을 추가해 주세요
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {albums.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            아직 앨범이 없습니다. 새 앨범을 만들어 보세요.
          </p>
        )}

        {hasMore && albums.length > 0 && (
          <div className="pt-2 text-center">
            <button
              onClick={loadMoreAlbums}
              disabled={loadingMore}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? "불러오는 중..." : "더보기"}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const albumId = fileInputRef.current?.getAttribute("data-album-id");
          const picked = e.target.files;
          if (albumId && picked && picked.length > 0) {
            // FileList → Array 로 스냅샷. 이후 input.value="" 가
            // input.files 를 비워도 업로드 루프는 영향 없음.
            const snapshot = Array.from(picked);
            console.log(`[gallery] picked ${snapshot.length} file(s)`);
            e.target.value = "";
            uploadImages(albumId, snapshot);
          }
        }}
      />
    </div>
  );
}
