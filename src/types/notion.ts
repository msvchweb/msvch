export interface NoticeItem {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  date: string | null;
  coverImage?: string;
}

export interface NoticeDetail extends NoticeItem {
  content: string;
}

export interface WeeklyItem {
  id: string;
  title: string;
  date: string | null;
  pdfUrl: string | null;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;
  date: string | null;
  thumbnail: string | null;
  images: string[];
}
