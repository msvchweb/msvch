import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { ShortsTriggerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();

    const parsed = ShortsTriggerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "videoId와 videoTitle은 필수이며, 각 필드의 길이 제한을 확인하세요." },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // 중복 체크
    const { data: existing } = await supabase
      .from("shorts_jobs")
      .select("id, status")
      .eq("video_id", body.videoId)
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: `이미 작업이 존재합니다 (${existing.status})`,
          jobId: existing.id,
        },
        { status: 409 },
      );
    }

    // Job 생성
    const { data: job, error: insertError } = await supabase
      .from("shorts_jobs")
      .insert({
        video_id: body.videoId,
        video_title: body.videoTitle,
        video_published_at: body.videoPublishedAt ?? null,
        video_thumbnail: body.videoThumbnail ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !job) {
      console.error("Shorts job insert error:", insertError);
      return NextResponse.json(
        { error: "Job 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    // GitHub Actions workflow_dispatch
    const ghToken = process.env.GITHUB_PAT;
    if (!ghToken) {
      return NextResponse.json(
        { error: "GITHUB_PAT 환경변수가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const dispatchRes = await fetch(
      "https://api.github.com/repos/msvchweb/msvch/actions/workflows/sermon-shorts.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            videoId: body.videoId,
            jobId: job.id as string,
          },
        }),
      },
    );

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      console.error("GitHub Actions dispatch failed:", errText);
      await supabase
        .from("shorts_jobs")
        .update({
          status: "failed",
          error: "GitHub Actions 트리거 실패",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json(
        { error: "쇼츠 생성 작업을 시작하지 못했습니다." },
        { status: 502 },
      );
    }

    return NextResponse.json({ jobId: job.id, status: "pending" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
