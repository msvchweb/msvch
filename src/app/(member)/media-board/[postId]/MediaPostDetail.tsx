"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { BoardCommentSchema } from "@/lib/validation";
import { MeetingNoteContent } from "@/components/ui/MeetingNoteContent";
import type { BoardComment, BoardPost } from "@/types/board";

/**
 * 미디어선교부 전용 상세 — 본문을 MeetingNoteContent(마크다운 렌더러)로 렌더 (O3 확정).
 * 댓글 로직은 일반 게시판과 동일(기존 board comments API 재사용).
 */
export function MediaPostDetail({
  boardId,
  boardTitle,
  post,
  comments: initialComments,
}: {
  boardId: string;
  boardTitle: string;
  post: BoardPost;
  comments: BoardComment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState<BoardComment[]>(initialComments);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function deletePost() {
    if (!confirm("이 글을 삭제하시겠습니까? 댓글도 함께 사라집니다.")) return;
    const r = await fetch(`/api/boards/${boardId}/posts/${post.id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    router.push("/media-board");
    router.refresh();
  }

  async function deleteComment(c: BoardComment) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const r = await fetch(
      `/api/boards/${boardId}/posts/${post.id}/comments/${c.id}`,
      { method: "DELETE" },
    );
    if (!r.ok) {
      alert("삭제 실패");
      return;
    }
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const check = BoardCommentSchema.safeParse({ content });
    if (!check.success) {
      alert(check.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const r = await fetch(`/api/boards/${boardId}/posts/${post.id}/comments`, {
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
    const created = (await r.json()) as BoardComment;
    setComments((prev) => [...prev, created]);
    setContent("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/media-board"
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        {boardTitle}
      </Link>

      <article className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">{post.title}</h1>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>
            <span>{post.authorName}</span>
            <span className="mx-2">·</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>
          {post.canDelete && (
            <button
              onClick={deletePost}
              className="flex items-center gap-1 text-red-600 hover:text-red-800"
            >
              <Trash2 size={12} />
              삭제
            </button>
          )}
        </div>

        <div className="mt-5">
          <MeetingNoteContent content={post.content} title={post.title} />
        </div>

        {post.images.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {post.images.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                <Image
                  src={url}
                  alt={`첨부 ${i + 1}`}
                  width={300}
                  height={300}
                  className="aspect-square w-full object-cover"
                  unoptimized
                />
              </a>
            ))}
          </div>
        )}
      </article>

      {/* 댓글 */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          댓글 {comments.length}
        </h2>

        <ul className="mb-4 space-y-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              첫 댓글을 작성해보세요.
            </p>
          ) : (
            comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg bg-gray-50 px-4 py-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                      {c.authorName}
                    </span>
                    <span className="mx-2">·</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                  {c.canDelete && (
                    <button
                      onClick={() => deleteComment(c)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-gray-700">{c.content}</p>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={submitComment}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글 작성..."
            rows={2}
            maxLength={1000}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              댓글 등록
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
