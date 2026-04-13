import { NextRequest, NextResponse } from "next/server";
import { getGalleryAlbums } from "@/lib/gallery";
import { parseLimit } from "@/lib/validation";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tags = searchParams.getAll("tag");
  const anyTags = searchParams.getAll("anyTag");
  const limitParam = searchParams.get("limit");

  const albums = await getGalleryAlbums({
    tags: tags.length > 0 ? tags : undefined,
    anyTags: anyTags.length > 0 ? anyTags : undefined,
    limit: limitParam ? parseLimit(limitParam) : undefined,
  });

  return NextResponse.json(albums);
}
