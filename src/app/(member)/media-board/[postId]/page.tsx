import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import {
  getMediaDeptBoard,
  getPostWithComments,
  getViewerContext,
} from "@/lib/boards";
import { MediaPostDetail } from "./MediaPostDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ postId: string }>;

export default async function MediaBoardPostPage({
  params,
}: {
  params: Params;
}) {
  const { postId } = await params;
  const supabase = await createClient();
  // RLS 가 멤버/admin 에게만 전용 게시판 노출 — 비멤버는 board=null → notFound (UI+RLS 이중 방어).
  const board = await getMediaDeptBoard(supabase);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const data = await getPostWithComments(
    supabase,
    postId,
    userId,
    isAdminOrMaster,
  );
  // 전용 게시판 글이 아니면 차단
  if (!data || data.post.boardId !== board.id) notFound();

  return (
    <Container>
      <MediaPostDetail
        boardId={board.id}
        boardTitle={board.title}
        post={data.post}
        comments={data.comments}
      />
    </Container>
  );
}
