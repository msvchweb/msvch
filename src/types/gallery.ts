export interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;
  date: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  images: GalleryImage[];
}

export interface GalleryImage {
  id: string;
  album_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}
