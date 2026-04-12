import { readFileSync } from "fs";
import { supabase } from "./lib/supabase";
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

    // Storage 업로드
    const storagePath = `${jobId}/clip_${i}.mp4`;
    const fileBuffer = readFileSync(filePath);

    const { error: uploadError } = await supabase.storage
      .from("shorts")
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage 업로드 실패: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("shorts")
      .getPublicUrl(storagePath);

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
        video_url: urlData.publicUrl,
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
