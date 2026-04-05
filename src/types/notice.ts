export interface Notice {
  id: string;
  title: string;
  slug: string;
  category: "일반" | "긴급" | "행사";
  content: string;
  is_public: boolean;
  date: string | null;
  created_at: string;
}

export interface Weekly {
  id: string;
  title: string;
  date: string | null;
  pdf_url: string | null;
  created_at: string;
}
