import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Users, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listVisibleBoards } from "@/lib/boards";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "소모임 게시판" };
export const dynamic = "force-dynamic";

export default async function BoardsListPage() {
  const supabase = await createClient();
  const boards = await listVisibleBoards(supabase);

  return (
    <>
      <PageHeader
        title="소모임 게시판"
        description="내가 속한 게시판 목록"
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          {boards.length === 0 ? (
            <p className="py-20 text-center text-gray-400">
              아직 속한 게시판이 없습니다.
              <br />
              운영진에게 게시판 등록을 요청해 주세요.
            </p>
          ) : (
            <ul className="space-y-3">
              {boards.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/boards/${b.id}`}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">
                          {b.title}
                          {!b.isVisible && (
                            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              숨김
                            </span>
                          )}
                        </h3>
                        {b.description && (
                          <p className="mt-1 text-sm text-gray-500">
                            {b.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {b.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} />
                          {b.postCount}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </>
  );
}
