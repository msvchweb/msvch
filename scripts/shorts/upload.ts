import { readFileSync } from "fs";
import { supabase } from "./lib/supabase";
import { putObject } from "../lib/r2";
import type { HighlightSegment } from "./highlight";
import type { ClipMetadata } from "./metadata";

interface UploadedClip {
  id: string;
}

export async function uploadClips(
  jobId: string,
  clipPaths: string[],
  highlights: HighlightSegment[],
  metadata: ClipMetadata[],
): Promise<UploadedClip[]> {
  const clips: UploadedClip[] = [];

  for (let i = 0; i < clipPaths.length; i++) {
    const filePath = clipPaths[i];
    const h = highlights[i];
    const m = metadata[i];

    // R2 업로드 — key 규칙은 앱의 prefix 컨벤션(`shorts/…`)을 그대로 따른다.
    const storageKey = `shorts/${jobId}/clip_${i}.mp4`;
    const fileBuffer = readFileSync(filePath);
    const videoUrl = await putObject(storageKey, fileBuffer, "video/mp4");

    // DB 삽입
    const { data: clip, error: insertError } = await supabase
      .from("shorts_clips")
      .insert({
        job_id: jobId,
        clip_index: i,
        start_sec: h.start_sec,
        end_sec: h.end_sec,
        title: h.title,
        hook: h.hook,
        transcript: h.reason,
        caption_yt: m.caption_yt,
        caption_ig: m.caption_ig,
        video_url: videoUrl,
        review_status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !clip) {
      throw new Error(
        `클립 DB 삽입 실패: ${insertError?.message ?? "unknown"}`,
      );
    }

    clips.push({ id: clip.id as string });
  }

  return clips;
}
