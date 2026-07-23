import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectRelationIds } from "@/lib/mobile-bulletin";
import type { MobileBulletinRelations, MobileService, WorshipResource } from "@/types/mobile-bulletin";

export async function loadMobileBulletinRelations(
  supabase: SupabaseClient,
  services: MobileService[],
): Promise<MobileBulletinRelations> {
  const { resourceIds, videoIds } = collectRelationIds(services);
  const resourcesQuery = resourceIds.length
    ? supabase
        .from("worship_resources")
        .select("id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at")
        .in("id", resourceIds)
    : Promise.resolve({ data: [], error: null });
  const videosQuery = videoIds.length
    ? supabase.from("sermon_videos").select("video_id").in("video_id", videoIds)
    : Promise.resolve({ data: [], error: null });
  const [resourcesResult, videosResult] = await Promise.all([resourcesQuery, videosQuery]);

  if (resourcesResult.error) console.error("mobile bulletin resources query failed");
  if (videosResult.error) console.error("mobile bulletin videos query failed");

  const resources = resourcesResult.error ? [] : (resourcesResult.data ?? []) as WorshipResource[];
  const videos = videosResult.error ? [] : (videosResult.data ?? []) as { video_id: string }[];
  return {
    resourcesById: Object.fromEntries(resources.map((resource) => [resource.id, resource])),
    validVideoIds: videos.map((row) => row.video_id),
  };
}
