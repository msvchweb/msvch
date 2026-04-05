"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Eye, EyeOff, Trash2, Edit3, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Notice } from "@/types/notice";

const CATEGORIES = ["일반", "긴급", "행사"] as const;

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<string>("일반");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const supabase = createClient();

  useEffect(() => { loadNotices(); }, []);

  async function loadNotices() {
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("date", { ascending: false });
    setNotices((data ?? []) as Notice[]);
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
    const finalSlug = slug || generateSlug(title);

    if (editing) {
      await supabase
        .from("notices")
        .update({ title, slug: finalSlug, category, content, date: date || null })
        .eq("id", editing.id);
    } else {
      await supabase.from("notices").insert({
        title,
        slug: finalSlug,
        category,
        content,
        date: date || null,
        is_public: false,
      });
    }
    resetForm();
    loadNotices();
  }

  async function togglePublic(id: string, current: boolean) {
    await supabase.from("notices").update({ is_public: !current }).eq("id", id);
    loadNotices();
  }

  async function deleteNotice(id: string) {
    if (!confirm("이 공지사항을 삭제하시겠습니까?")) return;
    await supabase.from("notices").delete().eq("id", id);
    loadNotices();
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">공지사항 관리</h1>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "새 공지"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
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
              rows={8} required
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
            {editing ? "수정 저장" : "공지 생성"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
              <th className="px-4 py-3 font-medium text-gray-600">제목</th>
              <th className="px-4 py-3 font-medium text-gray-600">카테고리</th>
              <th className="px-4 py-3 font-medium text-gray-600">날짜</th>
              <th className="px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notices.map((notice) => (
              <tr key={notice.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{notice.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{notice.category}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-gray-400">
                  {notice.date ? formatDate(notice.date) : "-"}
                </td>
                <td className="px-4 py-3">
                  <button
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
                    <button onClick={() => deleteNotice(notice.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {notices.length === 0 && (
          <p className="py-8 text-center text-gray-400">공지사항이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
