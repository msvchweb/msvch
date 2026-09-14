/**
 * 주보 사진 → 캘린더 주간 자동 등록 — 플랫폼 공용 DTO.
 *
 * `POST /api/admin/cron/weekly-event-sync` 응답 형태.
 * 설계: camelCase, 안정적 형태 (시스템 전용 엔드포인트지만 다른 DTO 와 같은 규칙).
 */

export type WeeklyEventSyncJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "retry_scheduled"
  | "failed";

export type WeeklyEventSyncErrorKind =
  | "transient"
  | "invalid_response"
  | "photo_fetch"
  | "config"
  | "superseded"
  | "expired";

export interface WeeklyEventSyncSkippedItem {
  title: string;
  date: string | null;
  reason: string;
}

export interface WeeklyEventSyncJobResult {
  jobId: string;
  weeklyId: string;
  status: WeeklyEventSyncJobStatus;
  attempts: number;
  insertedCount: number;
  skippedCount: number;
  /** ISO 8601. 재시도 예정이 없으면 null */
  nextRetryAt: string | null;
  errorKind: WeeklyEventSyncErrorKind | null;
  errorMessage: string | null;
}

export interface WeeklyEventSyncTickResult {
  /** ISO 8601 */
  now: string;
  /** 이번 호출이 주간 실행을 새로 만들었으면 그 주 토요일 (YYYY-MM-DD), 아니면 null */
  createdRunWeek: string | null;
  createdJobs: number;
  processed: WeeklyEventSyncJobResult[];
}
