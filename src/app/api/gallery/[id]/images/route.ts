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
    .order("sort_order", { ascending: true });

  return NextResponse.json((data ?? []) as GalleryImage[]);
}
