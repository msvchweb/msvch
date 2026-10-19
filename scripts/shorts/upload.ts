import { readFileSync } from "node:fs";
import { shortsDb } from "../../src/lib/shorts/db";
import { putImmutableObject } from "../lib/r2";
import type { HighlightSegment } from "./highlight";
import type { ClipMetadata } from "./metadata";
import type { MediaCheck } from "./verify-clip";
export function clipStorageKey(
  jobId: string,
  attemptId: string,
  index: number,
) {
  return `shorts/${jobId}/${attemptId}/clip_${index}.mp4`;
}
export async function uploadClips(
  jobId: string,
  attemptId: string,
  runId: string,
  runAttempt: number,
  clips: {
    outputPath: string;
    highlight: HighlightSegment;
    mediaCheck: MediaCheck;
  }[],
  metadata: ClipMetadata[],
  signal?: AbortSignal,
) {
  const db = shortsDb(),
    uploaded: { id: string }[] = [];
  for (const [i, clip] of clips.entries()) {
    const { data: existing, error: readError } = await db
      .from("shorts_clips")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("clip_index", i)
      .maybeSingle();
    if (readError) throw new Error("clip_read_failed");
    if (existing) {
      uploaded.push(existing);
      continue;
    }
    const h = clip.highlight,
      m = metadata.find((m) => m.clip_id === h.id);
    if (!m || !clip.mediaCheck.valid) throw new Error("invalid_clip_upload");
    const videoUrl = await putImmutableObject(
      clipStorageKey(jobId, attemptId, i),
      readFileSync(clip.outputPath),
      "video/mp4",
      signal,
    );
    const { data, error } = await db.rpc("shorts_save_clip", {
      p_attempt: attemptId,
      p_run: runId,
      p_run_attempt: runAttempt,
      p_clip: {
        clip_index: i,
        start_sec: h.start_sec,
        end_sec: h.end_sec,
        title: h.title,
        hook: h.hook,
        transcript: h.transcript,
        selection_reason: h.reason,
        title_yt: m.title_yt,
        caption_yt: m.caption_yt,
        caption_ig: m.caption_ig,
        video_url: videoUrl,
        selection_data: h.selection_data,
        media_check: clip.mediaCheck,
        rendered_duration_sec: clip.mediaCheck.duration,
      },
    });
    if (error || !data) throw new Error("clip_save_failed");
    uploaded.push({ id: data });
  }
  return uploaded;
}
