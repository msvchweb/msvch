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
  highlight_count: 5 | 10;
  active_attempt_id: string | null;
  review_attempt_id: string | null;
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
  attempt_id: string | null;
  selection_reason: string | null;
  title_yt: string | null;
  transcript_status: "verified" | "unverified";
  rendered_duration_sec: number | null;
  selection_data: Record<string, unknown> | null;
  media_check: { valid: boolean; warnings: string[] } | null;
  content_version: number;
  approved_version: number | null;
  reject_category: string | null;
}

export interface ShortsSettings {
  id: number;
  auto_publish: boolean;
  bgm_enabled: boolean;
  publishing_enabled: boolean;
  auto_generate_enabled: boolean;
  auto_generate_after: string | null;
  source_playlist_id: string | null;
  allowed_categories: string[];
  max_clips_per_sermon: number;
  daily_publish_limit: number;
  highlight_prompt: string | null;
  metadata_prompt: string | null;
  updated_at: string;
}

/** Gemini 하이라이트 선정 결과 */
export type Mood = "solemn" | "uplifting" | "peaceful" | "reflective";
export interface VoicedChunk {
  start: number;
  end: number;
}
export interface HighlightSelection {
  start_id: string;
  end_id: string;
  quote_start: string;
  quote_end: string;
  title: string;
  hook: string;
  reason: string;
  topic: string;
  keywords: string[];
  card_text: string;
  mood: Mood;
  scores: {
    hook: number;
    standalone: number;
    empathy: number;
    completeness: number;
    context: number;
  };
}
export interface HighlightSegment {
  id: string;
  start_sec: number;
  end_sec: number;
  title: string;
  hook: string;
  reason: string;
  keywords: string[];
  card_text: string;
  mood: Mood;
  voiced: VoicedChunk[];
  transcript: string;
  selection_data: HighlightSelection & { total_score: number };
}

/** Gemini 메타데이터 생성 결과 */
export interface ClipMetadata {
  clip_id: string;
  title_yt: string;
  caption_yt: string;
  caption_ig: string;
}

/** Job + clips 조인 (API 응답용) */
export interface ShortsJobWithClips extends ShortsJob {
  clips: ShortsClip[];
  attempts?: ShortsAttempt[];
  publications?: ShortsPublication[];
  checked_at?: string;
}

export interface ShortsAttempt {
  id: string;
  job_id: string;
  attempt_no: number;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  github_run_id: string | null;
  github_run_attempt: number | null;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  transcription_source: string | null;
}
export interface SubtitleSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}
export type ShortsPlatform = "youtube" | "instagram";
export interface ShortsPublication {
  id: string;
  clip_id: string;
  platform: ShortsPlatform;
  content_version: number;
  test_only: boolean;
  status:
    | "queued"
    | "processing"
    | "retry_wait"
    | "needs_attention"
    | "test_uploaded"
    | "published"
    | "canceled";
  scheduled_at: string;
  next_attempt_at: string | null;
  attempt_count: number;
  public_request_started: boolean;
  quota_date: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  worker_run_id: string | null;
  provider_id: string | null;
  provider_url: string | null;
  published_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
export interface PublicationLease {
  publication: ShortsPublication;
  leaseToken: string;
  recovery?: boolean;
}
