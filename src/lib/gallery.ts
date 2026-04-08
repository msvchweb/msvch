import { createClient } from "@/lib/supabase/server";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

export interface GetAlbumsOptions {
  /** AND 필터: 이 태그를 모두 포함하는 앨범 */
  tags?: string[];
  /** OR 필터: 이 태그 중 하나라도 포함하는 앨범 */
  anyTags?: string[];
  limit?: number;
}

export async function getGalleryAlbums(options: GetAlbumsOptions = {}): Promise<GalleryAlbum[]> {
  const supabase = await createClient();
  const { tags, anyTags, limit } = options;

  let query = supabase
    .from("gallery_albums")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false });

  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }
  if (anyTags && anyTags.length > 0) {
    query = query.overlaps("tags", anyTags);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data: albums } = await query;
  if (!albums || albums.length === 0) return [];

  const albumIds = albums.map((a) => a.id as string);
  const { data: images } = await supabase
    .from("gallery_images")
    .select("*")
    .in("album_id", albumIds)
    .order("sort_order", { ascending: true });

  return albums.map((album) => ({
    id: album.id as string,
    title: album.title as string,
    category: album.category as string | null,
    tags: (album.tags as string[] | null) ?? [],
    date: album.date as string | null,
    thumbnail_url: album.thumbnail_url as string | null,
    is_public: album.is_public as boolean,
    created_at: album.created_at as string,
    images: (images?.filter((img) => img.album_id === album.id) ?? []) as GalleryImage[],
  }));
}
