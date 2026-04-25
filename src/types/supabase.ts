export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "member" | "staff" | "admin" | "master";
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: { name: string };
}
