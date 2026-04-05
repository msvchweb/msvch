import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import type { Group } from "@/types/supabase";

export const metadata: Metadata = { title: "그룹" };

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .order("created_at") as { data: Group[] | null };

  return (
    <>
      <PageHeader title="그룹" description="교회 그룹에 참여하세요" />
      <Container>
        <div className="mx-auto max-w-2xl space-y-4">
          {groups?.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.slug}`}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 transition hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                <Users className="text-primary-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{group.name}</h3>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
            </Link>
          ))}
          {(!groups || groups.length === 0) && (
            <p className="py-12 text-center text-gray-400">
              아직 생성된 그룹이 없습니다.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
