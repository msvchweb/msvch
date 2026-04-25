import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentType = "notice" | "weekly" | "gallery_album";

/**
 * 컨텐츠 ID 목록에 대한 작성자 닉네임 맵을 가져온다.
 * RLS 상 staff 만 SELECT 가 허용되므로, 비-staff 세션에서는 빈 맵이 반환된다.
 *
 * 반환 형태: { [content_id]: author_name }
 */
export async function fetchAuthorMap(
  supabase: SupabaseClient,
  contentType: ContentType,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("content_authors")
    .select("content_id, author_name")
    .eq("content_type", contentType)
    .in("content_id", ids);

  const map: Record<string, string> = {};
  ((data ?? []) as { content_id: string; author_name: string | null }[]).forEach(
    (row) => {
      if (row.author_name) map[row.content_id] = row.author_name;
    },
  );
  return map;
}
