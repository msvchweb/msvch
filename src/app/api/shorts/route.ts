import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ShortsJob, ShortsClip, ShortsJobWithClips } from "@/types/shorts";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = req.nextUrl;

  const status = searchParams.get("status");
  const published = searchParams.get("published");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  let jobQuery = supabase
    .from("shorts_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) jobQuery = jobQuery.eq("status", status);
  if (published === "true") jobQuery = jobQuery.eq("status", "published");

  const { data: jobs } = await jobQuery;
  if (!jobs || jobs.length === 0) return NextResponse.json([]);

  const jobIds = jobs.map((j) => j.id as string);
  const { data: clips } = await supabase
    .from("shorts_clips")
    .select("*")
    .in("job_id", jobIds)
    .order("clip_index", { ascending: true });

  const clipsByJob: Record<string, ShortsClip[]> = {};
  for (const clip of (clips ?? []) as ShortsClip[]) {
    if (!clipsByJob[clip.job_id]) clipsByJob[clip.job_id] = [];
    clipsByJob[clip.job_id].push(clip);
  }

  const result: ShortsJobWithClips[] = (jobs as ShortsJob[]).map((job) => ({
    ...job,
    clips: clipsByJob[job.id] ?? [],
  }));

  return NextResponse.json(result);
}
