"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, EyeOff, Trash2, Users, Loader2, Clapperboard } from "lucide-react";
import type { Board } from "@/types/board";
import { BoardCreateSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/boards", { credentials: "same-origin" });
    if (r.ok) {
      const data = (await r.json()) as Board[];
      setBoards(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      void load();
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardCreateSchema.safeParse({
      title,
      description: description || undefined,
    });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch("/api/admin/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.data),
    });
    setSubmitting(false);
    if (!r.ok) {
      alert("생성 실패");
      return;
    }
    setTitle("");
    setDescription("");
    setShowForm(false);
    void load();
  }

  async function toggleVisible(b: Board) {
    const r = await fetch(`/api/admin/boards/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !b.isVisible }),
    });
    if (!r.ok) {
      alert("토글 실패");
      return;
    }
    void load();
  }

  async function deleteBoard(b: Board) {
    if (
      !confirm(
        `"${b.title}" 게시판을 영구 삭제합니다. 글·댓글·이미지가 모두 사라집니다. 계속할까요?`,
      )
    ) {
      return;
    }
    const r = await fetch(`/api/admin/boards/${b.id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    void load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            소모임 게시판
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            소모임별 게시판을 신설하고 멤버를 지정합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={16} />
          새 게시판
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
        >
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              제목 *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="예) 24목장 게시판"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "생성 중..." : "생성"}
          </button>
          <p className="mt-3 text-xs text-gray-500">
            생성 후 행 클릭 → &quot;멤버&quot;에서 멤버를 추가하세요.
          </p>
        </form>
      )}

      {boards.length === 0 ? (
        <p className="py-20 text-center text-gray-400">게시판이 없습니다.</p>
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-sm">
                  <th className="px-4 py-3 font-medium text-gray-600">제목</th>
                  <th className="px-4 py-3 font-medium text-gray-600">멤버</th>
                  <th className="px-4 py-3 font-medium text-gray-600">글</th>
                  <th className="px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {boards.map((b) => (
                  <tr key={b.id} className={cn("hover:bg-gray-50", b.isMediaDept && "bg-amber-50/50")}>
                    <td className="px-4 py-3">
                      <Link
                        href={b.isMediaDept ? "/media-board" : `/boards/${b.id}`}
                        className="block hover:text-primary-700"
                      >
                        <div className="flex items-center gap-2 font-medium text-gray-900 hover:text-primary-700">
                          {b.title}
                          {b.isMediaDept && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              미디어선교부
                            </span>
                          )}
                        </div>
                        {b.description && (
                          <div className="text-xs text-gray-500">
                            {b.description}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {b.memberCount}명
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {b.postCount}건
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          b.isVisible
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {b.isVisible ? "공개" : "숨김"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/boards/${b.id}/members`}
                          className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                        >
                          <Users size={12} />
                          멤버
                        </Link>
                        <button
                          onClick={() => toggleVisible(b)}
                          title={b.isVisible ? "숨김 처리" : "다시 공개"}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                        >
                          {b.isVisible ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                        </button>
                        <button
                          onClick={() => deleteBoard(b)}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="space-y-3 md:hidden">
            {boards.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "rounded-xl border border-gray-200 bg-white p-4",
                  b.isMediaDept && "border-amber-200 bg-amber-50/30"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={b.isMediaDept ? "/media-board" : `/boards/${b.id}`}
                    className="min-w-0 flex-1 hover:text-primary-700"
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-900 hover:text-primary-700">
                      {b.title}
                      {b.isMediaDept && (
                        <Clapperboard size={14} className="text-amber-600" />
                      )}
                    </div>
                    {b.description && (
                      <div className="text-xs text-gray-500">
                        {b.description}
                      </div>
                    )}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      b.isVisible
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {b.isVisible ? "공개" : "숨김"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  멤버 {b.memberCount}명 · 글 {b.postCount}건
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/admin/boards/${b.id}/members`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                  >
                    <Users size={12} />
                    멤버
                  </Link>
                  <button
                    onClick={() => toggleVisible(b)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
                  >
                    {b.isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                    {b.isVisible ? "숨김" : "공개"}
                  </button>
                  <button
                    onClick={() => deleteBoard(b)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
