import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { hasShortsAccess } from "@/lib/shorts/permissions";
import { parseLimit } from "@/lib/validation";
import { shortsHttpError } from "@/lib/shorts/http";
import type { ShortsJob, ShortsClip } from "@/types/shorts";
export const revalidate = 0;
export async function GET(req: NextRequest) {
  try {
    const db = await createApiClient(req);
    const {
      data: { user },
    } = await db.auth.getUser();
    const profile = user
      ? (await db.from("profiles").select("role").eq("id", user.id).single())
          .data
      : null;
    const admin = hasShortsAccess(profile?.role);
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"), 20);
    let query = db
      .from("shorts_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!admin || req.nextUrl.searchParams.get("published") === "true")
      query = query.eq("status", "published");
    else if (req.nextUrl.searchParams.get("status"))
      query = query.eq("status", req.nextUrl.searchParams.get("status"));
    const { data: jobs, error } = await query;
    if (error) throw error;
    if (!jobs?.length) return NextResponse.json([]);
    const ids = jobs.map((j) => j.id);
    const { data: clips, error: clipError } = await db
      .from("shorts_clips")
      .select("*")
      .in("job_id", ids)
      .order("clip_index");
    if (clipError) throw clipError;
    const attempts = admin
      ? await db
          .from("shorts_job_attempts")
          .select("*")
          .in("job_id", ids)
          .order("attempt_no", { ascending: false })
      : { data: [], error: null };
    if (attempts.error) throw attempts.error;
    const publications = admin
      ? await db
          .from("shorts_publications")
          .select(
            "id,clip_id,platform,content_version,test_only,status,scheduled_at,next_attempt_at,attempt_count,provider_id,provider_url,published_at,error_code,created_at,updated_at",
          )
          .in(
            "clip_id",
            (clips ?? []).map((c) => c.id),
          )
      : { data: [], error: null };
    if (publications.error) throw publications.error;
    return NextResponse.json(
      (jobs as ShortsJob[]).map((job) => {
        const current = (clips as ShortsClip[]).filter(
          (c) =>
            c.job_id === job.id &&
            (admin ? c.attempt_id === job.review_attempt_id : !!c.published_at),
        );
        if (!admin)
          return {
            id: job.id,
            video_id: job.video_id,
            video_title: job.video_title,
            status: job.status,
            clips: current.map((c) => ({
              id: c.id,
              title: c.title,
              video_url: c.video_url,
              youtube_video_id: c.youtube_video_id,
              published_at: c.published_at,
            })),
          };
        return {
          ...job,
          clips: current,
          attempts: attempts.data?.filter((a) => a.job_id === job.id) ?? [],
          publications:
            publications.data?.filter((p) =>
              current.some((c) => c.id === p.clip_id),
            ) ?? [],
          checked_at: new Date().toISOString(),
        };
      }),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
