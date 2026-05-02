import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import {
  getBoardById,
  getPostWithComments,
  getViewerContext,
} from "@/lib/boards";
import { BoardPostDetail } from "./BoardPostDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ boardId: string; postId: string }>;

export default async function BoardPostPage({
  params,
}: {
  params: Params;
}) {
  const { boardId, postId } = await params;
  const supabase = await createClient();
  const board = await getBoardById(supabase, boardId);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const data = await getPostWithComments(
    supabase,
    postId,
    userId,
    isAdminOrMaster,
  );
  if (!data) notFound();

  return (
    <Container>
      <BoardPostDetail
        boardId={boardId}
        boardTitle={board.title}
        post={data.post}
        comments={data.comments}
      />
    </Container>
  );
}
