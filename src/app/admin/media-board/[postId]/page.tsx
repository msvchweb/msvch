import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMediaDeptBoard,
  getPostWithComments,
  getViewerContext,
} from "@/lib/boards";
import { MediaPostDetail } from "@/app/(member)/media-board/[postId]/MediaPostDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ postId: string }>;

export default async function AdminMediaBoardPostPage({
  params,
}: {
  params: Params;
}) {
  const { postId } = await params;
  const supabase = await createClient();
  const board = await getMediaDeptBoard(supabase);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const data = await getPostWithComments(
    supabase,
    postId,
    userId,
    isAdminOrMaster,
  );
  if (!data || data.post.boardId !== board.id) notFound();

  return (
    <MediaPostDetail
      boardId={board.id}
      boardTitle={board.title}
      post={data.post}
      comments={data.comments}
      basePath="/admin/media-board"
    />
  );
}
