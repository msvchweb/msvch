import { Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMediaDeptBoard, getViewerContext, listPosts } from "@/lib/boards";
import { MediaBoardList } from "@/app/(member)/media-board/MediaBoardList";

export const metadata: Metadata = { title: "미디어선교부" };
export const dynamic = "force-dynamic";

export default async function AdminMediaBoardPage() {
  const supabase = await createClient();
  const board = await getMediaDeptBoard(supabase);

  if (!board) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-16 text-center">
          <Clapperboard
            size={32}
            className="mx-auto mb-3 text-gray-300"
            aria-hidden
          />
          <h1 className="text-lg font-semibold text-gray-900">
            미디어선교부 게시판 접근 권한이 없습니다.
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            운영진에게 미디어선교부 게시판 등록을 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const initial = await listPosts(supabase, board.id, {
    limit: 20,
    cursor: null,
    viewerId: userId,
    viewerIsAdminOrMaster: isAdminOrMaster,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            게시판
          </p>
          <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
            {board.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {board.description ?? "회의록과 미디어선교부 자료를 공유합니다."}
          </p>
        </div>
      </div>

      <MediaBoardList
        boardId={board.id}
        initialItems={initial.items}
        initialCursor={initial.nextCursor}
        basePath="/admin/media-board"
      />
    </div>
  );
}
