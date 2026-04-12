export type JobStatus =
  | "pending"
  | "downloading"
  | "transcribing"
  | "selecting"
  | "editing"
  | "ready_for_review"
  | "published"
  | "failed";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ShortsJob {
  id: string;
  video_id: string;
  video_title: string;
  video_published_at: string | null;
  video_thumbnail: string | null;
  status: JobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShortsClip {
  id: string;
  job_id: string;
  clip_index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  title: string | null;
  hook: string | null;
  transcript: string | null;
  caption_yt: string | null;
  caption_ig: string | null;
  video_url: string | null;
  review_status: ReviewStatus;
  reviewer_note: string | null;
  youtube_video_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ShortsSettings {
  id: number;
  auto_publish: boolean;
  max_clips_per_sermon: number;
  daily_publish_limit: number;
  highlight_prompt: string | null;
  metadata_prompt: string | null;
  updated_at: string;
}

/** Gemini 하이라이트 선정 결과 */
export interface HighlightSegment {
  start_sec: number;
  end_sec: number;
  title: string;
  hook: string;
  reason: string;
}

/** Gemini 메타데이터 생성 결과 */
export interface ClipMetadata {
  title_yt: string;
  caption_yt: string;
  caption_ig: string;
}

/** Job + clips 조인 (API 응답용) */
export interface ShortsJobWithClips extends ShortsJob {
  clips: ShortsClip[];
}
