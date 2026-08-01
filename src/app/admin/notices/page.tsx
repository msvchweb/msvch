"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Plus, Eye, EyeOff, Trash2, Edit3, X, ImageIcon, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  NoticeSchema,
  validateFile,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
} from "@/lib/validation";
import { uploadToR2, type UploadToR2Result } from "@/lib/r2/upload-client";
import {
  compressImage,
  toWebImage,
  CONTENT_IMAGE_PRESET,
} from "@/lib/image-compress";
import { fetchAuthorRecordMap, type ContentAuthor } from "@/lib/content-authors";
import { useMe, canDelete } from "@/lib/use-me";
import type { Notice } from "@/types/notice";

const CATEGORIES = ["일반", "긴급", "행사"] as const;
const HERO_STORAGE_PREFIX = "admin-hero";
/** 압축 전 절대 상한 — 브라우저 OOM 방지 */
const HERO_HARD_MAX_BYTES = 50 * 1024 * 1024;

export default function AdminNoticesPage() {
  const me = useMe();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [authorMap, setAuthorMap] = useState<Record<string, ContentAuthor>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("일반");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supabase = createClient();

  useEffect(() => { loadNotices(); }, []);

  async function loadNotices() {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Notice[];
    setNotices(list);
    const map = await fetchAuthorRecordMap(
      supabase,
      "notice",
      list.map((n) => n.id),
    );
    setAuthorMap(map);
    setLoading(false);
  }

  function resetForm() {
    setTitle(""); setSlug(""); setCategory("일반");
    setContent(""); setDate("");
    setEditing(null); setShowForm(false);
  }

  function startEdit(notice: Notice) {
    setTitle(notice.title);
    setSlug(notice.slug);
    setCategory(notice.category);
    setContent(notice.content);
    setDate(notice.date ?? "");
    setEditing(notice);
    setShowForm(true);
  }

  function generateSlug(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50) + "-" + Date.now().toString(36);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = NoticeSchema.safeParse({
      title,
      slug: slug || undefined,
      category,
      content,
      date: date || undefined,
    });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }

    const finalSlug = check.data.slug || generateSlug(title);

    if (editing) {
      await supabase
        .from("notices")
        .update({
          title: check.data.title,
          slug: finalSlug,
          category: check.data.category,
          content: check.data.content,
          date: check.data.date || null,
        })
        .eq("id", editing.id);
    } else {
      await supabase.from("notices").insert({
        title: check.data.title,
        slug: finalSlug,
        category: check.data.category,
        content: check.data.content,
        date: check.data.date || null,
        is_public: false,
      });
    }
    resetForm();
    loadNotices();
  }

  async function togglePublic(id: string, current: boolean) {
    await supabase.from("notices").update({ is_public: !current }).eq("id", id);
    await revalidateHome();
    loadNotices();
  }

  async function deleteNotice(id: string) {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    await revalidateHome();
    loadNotices();
  }

  /** 히어로 슬라이더 + 홈 ISR 캐시 무효화 (관리자 세션 인증) */
  async function revalidateHome() {
    try {
      await fetch("/api/admin/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: ["/", "/api/home/hero-slides"] }),
      });
    } catch {
      // 캐시 실패는 사용자에게 즉시 영향 없음 — 다음 요청에서 TTL로 갱신됨
    }
  }

  async function uploadHeroImage(notice: Notice, file: File) {
    // 1차 검증: 확장자 + 절대 상한 (50MB)
    const baseCheck = validateFile(
      file,
      ALLOWED_IMAGE_EXTENSIONS,
      HERO_HARD_MAX_BYTES,
    );
    if (!baseCheck.ok) {
      alert(baseCheck.reason);
      return;
    }

    setUploadingId(notice.id);
    try {
      // 홈 히어로 슬라이더가 이 파일을 그대로 로드한다(이미지 최적화 미사용).
      // 항상 webp 로 줄여 저장한다 — 실측 1.8MB PNG → 154KB.
      let toUpload: Blob = file;
      let uploadName = file.name;
      const web = await toWebImage(file, CONTENT_IMAGE_PRESET);
      if (web) {
        toUpload = web;
        uploadName = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
      } else if (file.size > MAX_BLOG_IMAGE_SIZE) {
        try {
          const result = await compressImage(file, MAX_BLOG_IMAGE_SIZE);
          toUpload = result.file;
          uploadName = result.file.name;
        } catch (e) {
          alert(e instanceof Error ? e.message : "이미지 압축 실패");
          return;
        }
      }

      let uploaded: UploadToR2Result;
      try {
        uploaded = await uploadToR2({
          file: toUpload,
          filename: uploadName,
          prefix: "blog-images",
          scope: [HERO_STORAGE_PREFIX, notice.id],
        });
      } catch (e) {
        alert(`업로드 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`);
        return;
      }

      const rest = notice.images.slice(1);
      const newImages = [uploaded.publicUrl, ...rest];

      const { error: updateError } = await supabase
        .from("notices")
        .update({ images: newImages })
        .eq("id", notice.id);

      if (updateError) {
        alert(`DB 업데이트 실패: ${updateError.message}`);
        return;
      }

      await revalidateHome();
      await loadNotices();
    } finally {
      setUploadingId(null);
    }
  }

  async function removeHeroImage(notice: Notice) {
    if (notice.images.length === 0) return;
    if (!confirm("히어로 이미지(첫번째 사진)를 제거할까요?\n본문 내 [IMG:..] 마커는 그대로 유지됩니다.")) return;

    setUploadingId(notice.id);
    try {
      const remaining = notice.images.slice(1);
      const { error } = await supabase
        .from("notices")
        .update({ images: remaining })
        .eq("id", notice.id);

      if (error) {
        alert(`제거 실패: ${error.message}`);
        return;
      }

      await revalidateHome();
      await loadNotices();
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">공지사항 관리</h1>
        <button
          data-tour="notice-new"
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 sm:w-auto"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "새 공지"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">카테고리</label>
              <select
                value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">슬러그 (URL, 비우면 자동생성)</label>
              <input
                value={slug} onChange={(e) => setSlug(e.target.value)}
                placeholder="easter-2026"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">날짜</label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              rows={8} required maxLength={50000}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
            {editing ? "수정 저장" : "공지 생성"}
          </button>
        </form>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
              <th className="px-4 py-3 font-medium text-gray-600">히어로</th>
              <th className="px-4 py-3 font-medium text-gray-600">제목</th>
              <th className="px-4 py-3 font-medium text-gray-600">카테고리</th>
              <th className="px-4 py-3 font-medium text-gray-600">날짜</th>
              <th className="px-4 py-3 font-medium text-gray-600">작성자</th>
              <th className="px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notices.map((notice) => {
              const hero = notice.images[0];
              const isBusy = uploadingId === notice.id;
              return (
                <tr key={notice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[notice.id]?.click()}
                        disabled={isBusy}
                        className="relative h-12 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50 transition-colors hover:border-primary-400 disabled:opacity-50"
                        title={hero ? "히어로 사진 교체" : "히어로 사진 업로드"}
                      >
                        {hero ? (
                          <Image
                            src={hero}
                            alt="히어로"
                            fill
                            sizes="80px"
                            className="object-cover"
                            unoptimized={hero.startsWith("http")}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-400">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        {isBusy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-700">
                            <Upload size={14} className="animate-pulse" />
                          </div>
                        )}
                      </button>
                      <input
                        ref={(el) => { fileInputRefs.current[notice.id] = el; }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) await uploadHeroImage(notice, f);
                        }}
                      />
                      {hero && !isBusy && (
                        <button
                          type="button"
                          onClick={() => removeHeroImage(notice)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="히어로 이미지 제거"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{notice.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{notice.category}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-400">
                    {notice.date ? formatDate(notice.date) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {authorMap[notice.id]?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      data-tour="notice-publish"
                      onClick={() => togglePublic(notice.id, notice.is_public)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        notice.is_public ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {notice.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                      {notice.is_public ? "공개" : "비공개"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(notice)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Edit3 size={14} />
                      </button>
                      {canDelete(me, authorMap[notice.id]?.id) && (
                        <button onClick={() => deleteNotice(notice.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {notices.length === 0 && (
          <p className="py-8 text-center text-gray-400">공지사항이 없습니다.</p>
        )}
      </div>

      {/* 모바일 카드 */}
      <div className="space-y-3 md:hidden">
        {notices.map((notice) => {
          const hero = notice.images[0];
          const isBusy = uploadingId === notice.id;
          return (
            <div key={notice.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[notice.id]?.click()}
                  disabled={isBusy}
                  className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 disabled:opacity-50"
                  title={hero ? "히어로 사진 교체" : "히어로 사진 업로드"}
                >
                  {hero ? (
                    <Image
                      src={hero}
                      alt="히어로"
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized={hero.startsWith("http")}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  {isBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Upload size={14} className="animate-pulse text-gray-700" />
                    </div>
                  )}
                </button>
                <input
                  ref={(el) => { fileInputRefs.current[notice.id] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) await uploadHeroImage(notice, f);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{notice.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span>{notice.category}</span>
                    {notice.date && <span className="text-gray-400">· {formatDate(notice.date)}</span>}
                    {authorMap[notice.id]?.name && <span className="text-gray-400">· {authorMap[notice.id]?.name}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <button
                  data-tour="notice-publish"
                  onClick={() => togglePublic(notice.id, notice.is_public)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    notice.is_public ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {notice.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                  {notice.is_public ? "공개" : "비공개"}
                </button>
                <div className="flex items-center gap-1">
                  {hero && !isBusy && (
                    <button
                      type="button"
                      onClick={() => removeHeroImage(notice)}
                      className="rounded-lg p-2 text-gray-400 active:bg-red-50 active:text-red-600"
                      title="히어로 제거"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <button onClick={() => startEdit(notice)} className="rounded-lg p-2 text-gray-500 active:bg-gray-100">
                    <Edit3 size={16} />
                  </button>
                  {canDelete(me, authorMap[notice.id]?.id) && (
                    <button onClick={() => deleteNotice(notice.id)} className="rounded-lg p-2 text-gray-400 active:bg-red-50 active:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {notices.length === 0 && (
          <p className="py-8 text-center text-gray-400">공지사항이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
