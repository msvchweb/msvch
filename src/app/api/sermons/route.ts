import { NextResponse } from "next/server";
import { getSermonVideos } from "@/lib/sermons";

export async function GET() {
  const videos = await getSermonVideos(50);
  return NextResponse.json(videos);
}
