"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare, Loader2, ImageIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BoardPost, CursorPage } from "@/types/board";
import { MediaPostForm } from "./MediaPostForm";

export function MediaBoardList({
  boardId,
  initialItems,
  initialCursor,
  basePath = "/media-board",
}: {
  boardId: string;
  initialItems: BoardPost[];
  initialCursor: string | null;
  basePath?: string;
}) {
  const [items, setItems] = useState<BoardPost[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const r = await fetch(
      `/api/boards/${boardId}/posts?cursor=${encodeURIComponent(cursor)}&limit=20`,
      { credentials: "same-origin" },
    );
    setLoading(false);
    if (!r.ok) return;
    const page = (await r.json()) as CursorPage<BoardPost>;
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
  }

  function handleCreated(post: BoardPost) {
    setItems((prev) => [post, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={14} />
          {showForm ? "취소" : "글쓰기"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <MediaPostForm boardId={boardId} onCreated={handleCreated} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray-400">
          아직 게시글이 없습니다. 회의록을 업로드하거나 첫 글을 작성해보세요!
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`${basePath}/${p.id}`}
                className="block px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="line-clamp-1 font-medium text-gray-900">
                    {p.title}
                  </h3>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                    <MessageSquare size={12} />
                    {p.commentCount}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <span>{p.authorName}</span>
                  <span>·</span>
                  <span>{formatDate(p.createdAt)}</span>
                  {p.images.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <ImageIcon size={10} />
                        {p.images.length}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
