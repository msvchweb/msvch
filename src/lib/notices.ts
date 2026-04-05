import { createClient } from "@/lib/supabase/server";
import type { Notice, Weekly } from "@/types/notice";

export async function getNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false });

  return (data ?? []) as Notice[];
}

export async function getNoticeBySlug(slug: string): Promise<Notice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  return (data as Notice) ?? null;
}

export async function getWeeklies(): Promise<Weekly[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeklies")
    .select("*")
    .order("date", { ascending: false })
    .limit(20);

  return (data ?? []) as Weekly[];
}
