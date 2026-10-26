import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GalleryImage } from "@/types/gallery";

type Params = Promise<{ id: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("gallery_images")
    .select("*")
    .eq("album_id", id)
    // 최근 올린 사진이 앞에 오도록 역순 정렬
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false });

  return NextResponse.json((data ?? []) as GalleryImage[]);
}
