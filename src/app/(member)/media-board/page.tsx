import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getMediaDeptBoard, getViewerContext, listPosts } from "@/lib/boards";
import { MediaBoardList } from "./MediaBoardList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "미디어선교부 게시판" };
export const dynamic = "force-dynamic";

export default async function MediaBoardPage() {
  const supabase = await createClient();
  // RLS 게이트 — 비멤버(non admin/master)에게는 null. 라우트 자체 가드(UI+RLS 이중 방어).
  const board = await getMediaDeptBoard(supabase);

  if (!board) {
    return (
      <>
        <PageHeader title="미디어선교부 게시판" />
        <Container>
          <p className="py-20 text-center text-gray-400">
            미디어선교부 게시판 접근 권한이 없습니다.
            <br />
            운영진에게 게시판 등록을 요청해 주세요.
          </p>
        </Container>
      </>
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
    <>
      <PageHeader
        title={board.title}
        description={board.description ?? "회의록·자료 공유"}
      />
      <Container>
        <MediaBoardList
          boardId={board.id}
          initialItems={initial.items}
          initialCursor={initial.nextCursor}
        />
      </Container>
    </>
  );
}
