import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getBoardById, getViewerContext, listPosts } from "@/lib/boards";
import { BoardPostList } from "./BoardPostList";

export const dynamic = "force-dynamic";

type Params = Promise<{ boardId: string }>;

export default async function BoardPage({ params }: { params: Params }) {
  const { boardId } = await params;
  const supabase = await createClient();
  const board = await getBoardById(supabase, boardId);
  if (!board) notFound();

  const { userId, isAdminOrMaster } = await getViewerContext(supabase);
  const initial = await listPosts(supabase, boardId, {
    limit: 20,
    cursor: null,
    viewerId: userId,
    viewerIsAdminOrMaster: isAdminOrMaster,
  });

  return (
    <>
      <PageHeader
        title={board.title}
        description={board.description ?? undefined}
      />
      <Container>
        <BoardPostList
          boardId={boardId}
          initialItems={initial.items}
          initialCursor={initial.nextCursor}
        />
      </Container>
    </>
  );
}
