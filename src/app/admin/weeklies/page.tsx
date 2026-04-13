"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Upload, FileText, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  validateFile,
  safeExtension,
  ALLOWED_PDF_EXTENSIONS,
  MAX_PDF_SIZE,
  WeeklySchema,
} from "@/lib/validation";
import type { Weekly } from "@/types/notice";

export default function AdminWeekliesPage() {
  const [weeklies, setWeeklies] = useState<Weekly[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => { loadWeeklies(); }, []);

  async function loadWeeklies() {
    const { data } = await supabase
      .from("weeklies")
      .select("*")
      .order("date", { ascending: false });
    setWeeklies((data ?? []) as Weekly[]);
    setLoading(false);
  }

  async function createWeekly(e: React.FormEvent) {
    e.preventDefault();
    const check = WeeklySchema.safeParse({ title, date: date || undefined });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    const { error } = await supabase.from("weeklies").insert({
      title: check.data.title,
      date: check.data.date || null,
    });
    if (!error) {
      setTitle(""); setDate(""); setShowForm(false);
      loadWeeklies();
    }
  }

  async function uploadPdf(weeklyId: string, file: File) {
    const check = validateFile(file, ALLOWED_PDF_EXTENSIONS, MAX_PDF_SIZE);
    if (!check.ok) {
      alert(check.reason);
      return;
    }

    setUploading(true);
    const ext = safeExtension(file.name, ALLOWED_PDF_EXTENSIONS);
    const path = `${weeklyId}.${ext}`;

    // Remove old file if exists
    await supabase.storage.from("weeklies").remove([path]);

    const { error: uploadError } = await supabase.storage
      .from("weeklies")
      .upload(path, file);

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("weeklies")
        .getPublicUrl(path);

      await supabase
        .from("weeklies")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", weeklyId);
    }

    setUploading(false);
    loadWeeklies();
  }

  async function deleteWeekly(w: Weekly) {
    if (!confirm("이 주보를 삭제하시겠습니까?")) return;

    if (w.pdf_url) {
      const path = new URL(w.pdf_url).pathname.split("/weeklies/")[1];
      if (path) await supabase.storage.from("weeklies").remove([path]);
    }

    await supabase.from("weeklies").delete().eq("id", w.id);
    loadWeeklies();
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">주보 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "새 주보"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createWeekly} className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
              <input
                value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder="2026년 4월 둘째주 주보"
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
          <button type="submit" className="mt-4 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700">
            주보 생성
          </button>
        </form>
      )}

      <div className="space-y-3">
        {weeklies.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="text-primary-500" size={20} />
              <div>
                <p className="font-medium text-gray-900">{w.title}</p>
                <p className="text-sm text-gray-400">
                  {w.date ? formatDate(w.date) : "-"}
                  {w.pdf_url && " · PDF 첨부됨"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fileInputRef.current?.setAttribute("data-weekly-id", w.id);
                  fileInputRef.current?.click();
                }}
                disabled={uploading}
                className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100 disabled:opacity-50"
              >
                <Upload size={14} />
                {uploading ? "업로드 중..." : "PDF 업로드"}
              </button>
              {w.pdf_url && (
                <a
                  href={w.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                >
                  보기
                </a>
              )}
              <button
                onClick={() => deleteWeekly(w)}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {weeklies.length === 0 && (
          <p className="py-12 text-center text-gray-400">주보가 없습니다.</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const weeklyId = fileInputRef.current?.getAttribute("data-weekly-id");
          if (weeklyId && e.target.files?.[0]) {
            uploadPdf(weeklyId, e.target.files[0]);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
