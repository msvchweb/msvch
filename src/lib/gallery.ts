import { createClient } from "@/lib/supabase/server";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const supabase = await createClient();

  const { data: albums } = await supabase
    .from("gallery_albums")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false });

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
    date: album.date as string | null,
    thumbnail_url: album.thumbnail_url as string | null,
    is_public: album.is_public as boolean,
    created_at: album.created_at as string,
    images: (images?.filter((img) => img.album_id === album.id) ?? []) as GalleryImage[],
  }));
}
