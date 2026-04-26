import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentType = "notice" | "weekly" | "gallery_album";

export interface ContentAuthor {
  /** 작성자 user id (UUID). 미상이면 null */
  id: string | null;
  /** 작성 시점의 닉네임 스냅샷. 미상이면 null */
  name: string | null;
}

/**
 * 컨텐츠 ID 목록에 대한 작성자 정보 맵.
 * RLS 상 staff 만 SELECT 가 허용되므로, 비-staff 세션에서는 빈 맵이 반환된다.
 *
 * 반환 형태: { [content_id]: { id, name } }
 */
export async function fetchAuthorRecordMap(
  supabase: SupabaseClient,
  contentType: ContentType,
  ids: string[],
): Promise<Record<string, ContentAuthor>> {
  if (ids.length === 0) return {};

  const { data } = await supabase
    .from("content_authors")
    .select("content_id, author_id, author_name")
    .eq("content_type", contentType)
    .in("content_id", ids);

  const map: Record<string, ContentAuthor> = {};
  ((data ?? []) as {
    content_id: string;
    author_id: string | null;
    author_name: string | null;
  }[]).forEach((row) => {
    map[row.content_id] = { id: row.author_id, name: row.author_name };
  });
  return map;
}

/**
 * 컨텐츠 ID 목록에 대한 작성자 닉네임 맵.
 * 기존 호환용 — 닉네임만 필요할 때 사용.
 */
export async function fetchAuthorMap(
  supabase: SupabaseClient,
  contentType: ContentType,
  ids: string[],
): Promise<Record<string, string>> {
  const records = await fetchAuthorRecordMap(supabase, contentType, ids);
  const map: Record<string, string> = {};
  Object.entries(records).forEach(([id, rec]) => {
    if (rec.name) map[id] = rec.name;
  });
  return map;
}
