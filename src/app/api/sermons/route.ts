import { NextResponse } from "next/server";
import { getSermonVideos } from "@/lib/youtube";

export async function GET() {
  const videos = await getSermonVideos(15);
  return NextResponse.json(videos);
}
