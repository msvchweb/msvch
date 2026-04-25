import { NextRequest, NextResponse } from "next/server";
import { getHeroSlides } from "@/lib/notices";
import { parseLimit } from "@/lib/validation";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = parseLimit(limitParam, 5);
  const slides = await getHeroSlides(limit);
  return NextResponse.json(slides);
}
