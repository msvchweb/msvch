"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Upload, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

const CATEGORIES = ["예배", "교회학교", "교회행사", "봉사센터", "새가족"] as const;

const SUB_CATEGORIES: Record<string, string[]> = {
  교회학교: ["영유치부", "아동부", "청소년부", "청년부"],
  봉사센터: ["반찬", "이미용", "비전문화", "탁구"],
};

export default function AdminGalleryPage() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [subCategory, setSubCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadAlbums();
  }, []);

  async function loadAlbums() {
    const { data: albumsData } = await supabase
      .from("gallery_albums")
      .select("*")
      .order("date", { ascending: false });

    if (!albumsData) {
      setLoading(false);
      return;
    }

    const albumIds = albumsData.map((a) => a.id as string);
    const { data: imagesData } = await supabase
      .from("gallery_images")
      .select("*")
      .in("album_id", albumIds)
      .order("sort_order");

    const result: GalleryAlbum[] = albumsData.map((album) => ({
      id: album.id as string,
      title: album.title as string,
      category: album.category as string | null,
      tags: (album.tags as string[] | null) ?? [],
      date: album.date as string | null,
      thumbnail_url: album.thumbnail_url as string | null,
      is_public: album.is_public as boolean,
      created_at: album.created_at as string,
      images: (imagesData?.filter((img) => img.album_id === album.id) ?? []) as GalleryImage[],
    }));

    setAlbums(result);
    setLoading(false);
  }

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    const tags: string[] = [category];
    if (subCategory) tags.push(subCategory);

    const { error } = await supabase.from("gallery_albums").insert({
      title,
      category,
      tags,
      date: date || null,
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

    // Delete storage files
    const album = albums.find((a) => a.id === albumId);
    if (album) {
      const paths = album.images.map((img) => {
        const url = new URL(img.image_url);
        return url.pathname.split("/gallery/")[1];
      }).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("gallery").remove(paths);
      }
    }

    await supabase.from("gallery_albums").delete().eq("id", albumId);
    loadAlbums();
  }

  async function uploadImages(albumId: string, files: FileList) {
    setUploading(true);
    const album = albums.find((a) => a.id === albumId);
    const existingCount = album?.images.length ?? 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const path = `${albumId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(path, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(path);

        await supabase.from("gallery_images").insert({
          album_id: albumId,
          image_url: urlData.publicUrl,
          sort_order: existingCount + i,
        });

        // Set first image as thumbnail if none
        if (existingCount === 0 && i === 0) {
          await supabase
            .from("gallery_albums")
            .update({ thumbnail_url: urlData.publicUrl })
            .eq("id", albumId);
        }
      }
    }

    setUploading(false);
    loadAlbums();
  }

  async function deleteImage(imageId: string, imageUrl: string) {
    const path = new URL(imageUrl).pathname.split("/gallery/")[1];
    if (path) {
      await supabase.storage.from("gallery").remove([path]);
    }
    await supabase.from("gallery_images").delete().eq("id", imageId);
    loadAlbums();
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">갤러리 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          {showForm ? "취소" : "새 앨범"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createAlbum}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-6"
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
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {SUB_CATEGORIES[category] && (
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
                  {SUB_CATEGORIES[category].map((sub) => (
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

      <div className="space-y-6">
        {albums.map((album) => (
          <div
            key={album.id}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{album.title}</h3>
                <p className="text-sm text-gray-500">
                  {album.category} &middot; {album.date} &middot;{" "}
                  {album.images.length}장
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                  onClick={() => {
                    fileInputRef.current?.setAttribute("data-album-id", album.id);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 disabled:opacity-50"
                >
                  <Upload size={14} />
                  {uploading ? "업로드 중..." : "사진 추가"}
                </button>
                <button
                  onClick={() => deleteAlbum(album.id)}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>

            {album.images.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {album.images.map((img) => (
                  <div key={img.id} className="group relative aspect-square">
                    <Image
                      src={img.image_url}
                      alt=""
                      fill
                      className="rounded-lg object-cover"
                      sizes="100px"
                    />
                    <button
                      onClick={() => deleteImage(img.id, img.image_url)}
                      className="absolute right-1 top-1 hidden rounded-full bg-red-500 p-1 text-white group-hover:block"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">
                사진을 추가해 주세요
              </p>
            )}
          </div>
        ))}

        {albums.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            아직 앨범이 없습니다. 새 앨범을 만들어 보세요.
          </p>
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
          if (albumId && e.target.files && e.target.files.length > 0) {
            uploadImages(albumId, e.target.files);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
