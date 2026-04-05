import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { DiscussionList } from "@/components/groups/DiscussionList";
import { notFound } from "next/navigation";
import type { Group, GroupPost } from "@/types/supabase";

type Params = Promise<{ groupId: string }>;

export default async function GroupDetailPage({
  params,
}: {
  params: Params;
}) {
  const { groupId } = await params;
  const supabase = await createClient();

  const { data: group } = (await supabase
    .from("groups")
    .select("*")
    .eq("slug", groupId)
    .single()) as { data: Group | null };

  if (!group) notFound();

  const { data: posts } = (await supabase
    .from("group_posts")
    .select("*, profiles(name)")
    .eq("group_id", group.id)
    .order("created_at", { ascending: false })) as { data: GroupPost[] | null };

  return (
    <>
      <PageHeader
        title={group.name}
        description={group.description ?? undefined}
      />
      <Container>
        <DiscussionList groupId={group.id} initialPosts={posts ?? []} />
      </Container>
    </>
  );
}
