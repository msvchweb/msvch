import { createClient } from "@/lib/supabase/server";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

export interface GetAlbumsOptions {
  /** AND 필터: 이 태그를 모두 포함하는 앨범 */
  tags?: string[];
  /** OR 필터: 이 태그 중 하나라도 포함하는 앨범 */
  anyTags?: string[];
  limit?: number;
  /** true이면 이미지도 함께 로드 (기본: false) */
  withImages?: boolean;
}

export async function getGalleryAlbums(options: GetAlbumsOptions = {}): Promise<GalleryAlbum[]> {
  const supabase = await createClient();
  const { tags, anyTags, limit, withImages } = options;

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

  let imagesByAlbum: Record<string, GalleryImage[]> = {};

  if (withImages) {
    const albumIds = albums.map((a) => a.id as string);
    const { data: images } = await supabase
      .from("gallery_images")
      .select("*")
      .in("album_id", albumIds)
      .order("sort_order", { ascending: true });

    for (const img of (images ?? []) as GalleryImage[]) {
      if (!imagesByAlbum[img.album_id]) imagesByAlbum[img.album_id] = [];
      imagesByAlbum[img.album_id].push(img);
    }
  }

  return albums.map((album) => {
    const id = album.id as string;
    return {
      id,
      title: album.title as string,
      category: album.category as string | null,
      tags: (album.tags as string[] | null) ?? [],
      date: album.date as string | null,
      thumbnail_url: album.thumbnail_url as string | null,
      is_public: album.is_public as boolean,
      created_at: album.created_at as string,
      images: imagesByAlbum[id] ?? [],
    };
  });
}
