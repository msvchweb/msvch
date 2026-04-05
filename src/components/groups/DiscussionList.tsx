"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import type { GroupPost } from "@/types/supabase";

export function DiscussionList({
  groupId,
  initialPosts,
}: {
  groupId: string;
  initialPosts: GroupPost[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("group_posts").insert({
      group_id: groupId,
      author_id: user.id,
      title,
      content,
    });

    if (!error) {
      setTitle("");
      setContent("");
      setShowForm(false);
      // Refresh posts
      const { data } = await supabase
        .from("group_posts")
        .select("*, profiles(name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (data) setPosts(data as GroupPost[]);
    }

    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? "취소" : "글쓰기"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-6"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            required
            className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            required
            rows={5}
            className="mb-3 w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {posts.map((post) => (
          <div key={post.id} className="px-6 py-4">
            <h3 className="font-medium text-gray-900">{post.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-600">
              {post.content}
            </p>
            <div className="mt-3 flex gap-3 text-xs text-gray-400">
              <span>{post.profiles.name}</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="px-6 py-12 text-center text-gray-400">
            아직 게시글이 없습니다. 첫 글을 작성해보세요!
          </p>
        )}
      </div>
    </div>
  );
}
