/**
 * 주보 사진 → 캘린더 주간 자동 등록 (실패 시 3시간마다 재시도).
 *
 * 설계: _workspace/01_planner_plan.md (2026-09-14)
 *
 * 호출 1회(틱) — GitHub Actions 가 3시간마다 POST /api/admin/cron/weekly-event-sync
 *   1. now 가 [토 22:00 KST, +24시간) 안이고 그 주 실행 기록을 이번 호출이 새로 넣었을 때만
 *      대상 주보마다 작업을 만든다 (weekly_id + 사진 해시가 같은 작업이 있으면 만들지 않음)
 *   2. 처리할 작업을 최대 3건 골라 조건부 UPDATE 로 선점한 뒤 1건씩 처리
 *
 * 작업 1건 — 만료 확인 → 주보 다시 읽기 → 사진 추출 → 기준 날짜 → 신뢰도 보정
 *   → 등록 여부(날짜·지난 일정·신뢰도·중복) → events INSERT → 결과 저장
 *
 * DB 접근은 WeeklyEventSyncStore 뒤에 둔다 — 라우트는 Supabase 구현을, 테스트는 메모리 구현을 쓴다.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GeminiHttpError, GeminiTimeoutError } from "@/lib/gemini";
import {
  adjustConfidenceByDateRange,
  adjustConfidenceByDayOfWeek,
} from "@/lib/news-event-extractor";
import {
  WeeklyEventSyncError,
  type WeeklyPhotoExtractInput,
  type WeeklyPhotoExtractResult,
} from "@/lib/weekly-photo-event-extractor";
import type { ExtractedEvent } from "@/types/event-extraction";
import type {
  WeeklyEventSyncErrorKind,
  WeeklyEventSyncJobResult,
  WeeklyEventSyncJobStatus,
  WeeklyEventSyncSkippedItem,
  WeeklyEventSyncTickResult,
} from "@/types/weekly-event-sync";

// ──────────────────────────────────────────────
//  상수
// ──────────────────────────────────────────────

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const KST_OFFSET_MS = 9 * HOUR_MS;

/** 토요일 22:00 KST 이후 이 시간 안의 첫 호출만 주간 실행을 만든다 */
export const RUN_WINDOW_MS = DAY_MS;
/** 실패 후 다음 시도까지 — 3시간 간격 호출의 오차 흡수 */
export const RETRY_DELAY_MS = 2 * HOUR_MS + 50 * MINUTE_MS;
/** 작업 생성 후 이 기간이 지나면 만료 (주보 일정이 이미 지남) */
export const JOB_EXPIRY_MS = 14 * DAY_MS;
/** running 인 채로 이 시간이 지나면 중간에 멈춘 작업으로 보고 다시 처리 */
export const STALE_RUNNING_MS = 15 * MINUTE_MS;
export const MAX_JOBS_PER_TICK = 3;
/** transient 가 아닌 실패(invalid_response·photo_fetch·config)는 이 횟수째에 failed */
export const MAX_NON_TRANSIENT_ATTEMPTS = 3;
/** 기존 검수 모달의 자동 체크 기준과 동일 */
export const MIN_AUTO_INSERT_CONFIDENCE = 0.6;
export const LAST_ERROR_MAX_LENGTH = 2000;

/** 일시 장애로 보고 횟수 제한 없이 다시 시도하는 Gemini HTTP 상태 */
const TRANSIENT_GEMINI_STATUS = new Set([429, 500, 502, 503, 504]);

// ──────────────────────────────────────────────
//  날짜 (KST)
// ──────────────────────────────────────────────

/** YYYY-MM-DD 에 days 일을 더한 날짜 */
export function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 시각의 KST 날짜 (YYYY-MM-DD) */
export function kstDateOf(instant: Date): string {
  return new Date(instant.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM-DD 형식이고 실제 달력에 있는 날짜인지 */
export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** now 이전(같은 시각 포함)의 가장 가까운 토요일 22:00 KST */
export function latestSaturday2200Kst(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  // 토=0, 일=1, 월=2, ... 금=6
  const daysSinceSaturday = (kst.getUTCDay() + 1) % 7;
  let startMs =
    Date.UTC(
      kst.getUTCFullYear(),
      kst.getUTCMonth(),
      kst.getUTCDate() - daysSinceSaturday,
      22,
      0,
      0,
      0,
    ) - KST_OFFSET_MS;
  if (startMs > now.getTime()) startMs -= 7 * DAY_MS;
  return new Date(startMs);
}

export interface RunWeekWindow {
  /** 해당 주 토요일 (KST 날짜, YYYY-MM-DD) */
  runWeek: string;
  /** 토요일 22:00 KST 시각 */
  startsAt: Date;
}

/** now 가 [토 22:00 KST, +24시간) 안이면 그 주 실행 정보, 아니면 null */
export function currentRunWeek(now: Date): RunWeekWindow | null {
  const startsAt = latestSaturday2200Kst(now);
  if (now.getTime() - startsAt.getTime() >= RUN_WINDOW_MS) return null;
  return { runWeek: kstDateOf(startsAt), startsAt };
}

export interface TargetWeeklyRange {
  /** date 가 dateFrom ~ dateTo (양 끝 포함) 인 주보 — S−13일 */
  dateFrom: string;
  /** S+8일 */
  dateTo: string;
  /** date 가 없는 주보는 created_at 이 이 시각(ISO) 이후 — S−14일 */
  undatedCreatedFrom: string;
}

export function targetWeeklyRange(window: RunWeekWindow): TargetWeeklyRange {
  return {
    dateFrom: addDaysToDate(window.runWeek, -13),
    dateTo: addDaysToDate(window.runWeek, 8),
    undatedCreatedFrom: new Date(
      window.startsAt.getTime() - 14 * DAY_MS,
    ).toISOString(),
  };
}

/** sha256(photo_images.join("\n")) */
export function hashPhotoImages(photoImages: string[]): string {
  return createHash("sha256").update(photoImages.join("\n")).digest("hex");
}

// ──────────────────────────────────────────────
//  오류 분류와 재시도
// ──────────────────────────────────────────────

export function classifyError(err: Error): WeeklyEventSyncErrorKind {
  if (err instanceof WeeklyEventSyncError) return err.kind;
  if (err instanceof GeminiHttpError) {
    return TRANSIENT_GEMINI_STATUS.has(err.status) ? "transient" : "config";
  }
  if (err instanceof GeminiTimeoutError) return "transient";
  // 그 밖(fetch 네트워크 오류 등)은 일시적 실패로 본다. 상한은 14일 만료.
  return "transient";
}

export interface FailureOutcome {
  status: "retry_scheduled" | "failed";
  attempts: number;
  /** ISO 8601. failed 면 null */
  nextRetryAt: string | null;
}

export function decideFailureOutcome(input: {
  kind: WeeklyEventSyncErrorKind;
  /** 실패 전 attempts */
  attempts: number;
  now: Date;
}): FailureOutcome {
  const { kind, attempts, now } = input;
  if (kind === "superseded" || kind === "expired") {
    return { status: "failed", attempts, nextRetryAt: null };
  }

  const nextAttempts = attempts + 1;
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString();
  if (kind === "transient" || nextAttempts < MAX_NON_TRANSIENT_ATTEMPTS) {
    return {
      status: "retry_scheduled",
      attempts: nextAttempts,
      nextRetryAt: retryAt,
    };
  }
  return { status: "failed", attempts: nextAttempts, nextRetryAt: null };
}

/** last_error 저장·로그용 — API 키 제거 후 2000자 이내로 자른다 */
export function sanitizeErrorMessage(message: string): string {
  let out = message.replace(/([?&]key=)[^&\s"'<>]+/gi, "$1[redacted]");
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) out = out.split(apiKey).join("[redacted]");
  // 코드 포인트 단위로 잘라 서로게이트 쌍이 깨지지 않게 한다 (DB length() 도 문자 단위)
  const chars = Array.from(out);
  return chars.length > LAST_ERROR_MAX_LENGTH
    ? chars.slice(0, LAST_ERROR_MAX_LENGTH).join("")
    : out;
}

// ──────────────────────────────────────────────
//  등록 여부 판단 (필터·중복)
// ──────────────────────────────────────────────

/** 제목 정규화: 연도 표기("2026년", "2026") 제거 → 공백·문장부호·따옴표 제거 */
export function normalizeEventTitle(title: string): string {
  return title
    .replace(/(^|\D)(?:19|20)\d{2}(?!\d)(?:\s*년)?/g, "$1")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export interface ComparableEvent {
  title: string;
  date: string;
  /** HH:mm 또는 HH:mm:ss. null = 종일/미정 */
  startTime: string | null;
}

function toHourMinute(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/**
 * 같은 날짜 + (정규화 제목이 같거나 한쪽이 다른 쪽을 포함)
 * + (start_time 이 같거나 둘 중 하나가 null)
 */
export function isDuplicateEvent(a: ComparableEvent, b: ComparableEvent): boolean {
  if (a.date !== b.date) return false;

  const titleA = normalizeEventTitle(a.title);
  const titleB = normalizeEventTitle(b.title);
  const titleMatches =
    titleA === titleB ||
    (titleA.length > 0 &&
      titleB.length > 0 &&
      (titleA.includes(titleB) || titleB.includes(titleA)));
  if (!titleMatches) return false;

  const startA = toHourMinute(a.startTime);
  const startB = toHourMinute(b.startTime);
  return startA === null || startB === null || startA === startB;
}

/** events INSERT 1행 (service role) */
export interface EventInsertRow {
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  notify: false;
  created_by: null;
  source_weekly_id: string;
  source_news_index: number | null;
  extracted_by_ai: true;
}

export function buildEventInsertRow(input: {
  candidate: ExtractedEvent;
  date: string;
  endTime: string | null;
  weeklyId: string;
}): EventInsertRow {
  const { candidate, date, endTime, weeklyId } = input;
  const index = candidate.sourceNewsIndex;
  return {
    title: candidate.title,
    description: candidate.description,
    location: candidate.location,
    date,
    start_time: candidate.startTime,
    end_time: endTime,
    notify: false,
    created_by: null,
    source_weekly_id: weeklyId,
    source_news_index: index !== null && index >= 0 && index <= 49 ? index : null,
    extracted_by_ai: true,
  };
}

export interface EventSelection {
  toInsert: EventInsertRow[];
  skipped: WeeklyEventSyncSkippedItem[];
}

/**
 * 후보별 등록 여부.
 * 날짜 없음 → 날짜 오류(형식은 맞지만 달력에 없는 날짜) → 지난 일정(KST 오늘 이전)
 * → 신뢰도 < 0.6 → endTime 정리 → 중복
 * (중복 비교 대상: 같은 날짜의 기존 events 전부 + 이 작업에서 먼저 등록하기로 한 후보)
 */
export function selectEventsToInsert(input: {
  candidates: ExtractedEvent[];
  weeklyId: string;
  todayKst: string;
  existingEvents: ComparableEvent[];
}): EventSelection {
  const toInsert: EventInsertRow[] = [];
  const skipped: WeeklyEventSyncSkippedItem[] = [];
  const accepted: ComparableEvent[] = [];

  for (const c of input.candidates) {
    const date = c.date;
    if (!date) {
      skipped.push({ title: c.title, date: null, reason: "날짜 없음" });
      continue;
    }
    if (!isRealIsoDate(date)) {
      skipped.push({ title: c.title, date, reason: "날짜 오류" });
      continue;
    }
    if (date < input.todayKst) {
      skipped.push({ title: c.title, date, reason: "지난 일정" });
      continue;
    }
    if (c.confidence < MIN_AUTO_INSERT_CONFIDENCE) {
      skipped.push({ title: c.title, date, reason: "신뢰도 낮음" });
      continue;
    }

    // endTime ≤ startTime 이거나 startTime 없이 endTime 만 있으면 endTime 만 버린다
    const endTime =
      c.startTime && c.endTime && c.endTime > c.startTime ? c.endTime : null;

    const comparable: ComparableEvent = {
      title: c.title,
      date,
      startTime: c.startTime,
    };
    const duplicate =
      input.existingEvents.some((e) => isDuplicateEvent(comparable, e)) ||
      accepted.some((e) => isDuplicateEvent(comparable, e));
    if (duplicate) {
      skipped.push({ title: c.title, date, reason: "이미 등록된 일정" });
      continue;
    }

    accepted.push(comparable);
    toInsert.push(
      buildEventInsertRow({ candidate: c, date, endTime, weeklyId: input.weeklyId }),
    );
  }

  return { toInsert, skipped };
}

// ──────────────────────────────────────────────
//  저장소
// ──────────────────────────────────────────────

export interface SyncWeeklyRow {
  id: string;
  date: string | null;
  is_published: boolean;
  photo_images: string[];
  created_at: string;
}

export interface SyncJobRow {
  id: string;
  run_week: string;
  weekly_id: string;
  photos_hash: string;
  status: WeeklyEventSyncJobStatus;
  attempts: number;
  started_at: string | null;
  created_at: string;
}

export interface NewSyncJobRow {
  run_week: string;
  weekly_id: string;
  photos_hash: string;
}

export interface ExistingEventRow {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
}

export interface SyncJobUpdate {
  status: WeeklyEventSyncJobStatus;
  attempts?: number;
  next_retry_at?: string | null;
  finished_at?: string | null;
  error_kind?: WeeklyEventSyncErrorKind | null;
  last_error?: string | null;
  model?: string | null;
  bulletin_date?: string | null;
  anchor_date?: string | null;
  date_mismatch?: boolean;
  inserted_event_ids?: string[];
  skipped?: WeeklyEventSyncSkippedItem[];
}

export interface DueJobQuery {
  nowIso: string;
  staleBeforeIso: string;
  limit: number;
}

export type EventInsertResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface WeeklyEventSyncStore {
  /** INSERT ... ON CONFLICT DO NOTHING. 이번 호출이 넣었으면 true */
  insertRunIfAbsent(runWeek: string): Promise<boolean>;
  deleteRun(runWeek: string): Promise<void>;
  listTargetWeeklies(range: TargetWeeklyRange): Promise<SyncWeeklyRow[]>;
  /** (weekly_id, photos_hash) 충돌은 건너뛴다. 새로 만든 작업 수 */
  insertJobsIfAbsent(rows: NewSyncJobRow[]): Promise<number>;
  /** pending / 재시도 시각이 된 retry_scheduled / 멈춘 running — created_at 오름차순 */
  listDueJobs(query: DueJobQuery): Promise<SyncJobRow[]>;
  /** 목록 조회 때의 상태 조건을 건 조건부 UPDATE. 갱신된 행이 있으면 true */
  claimJob(job: SyncJobRow, query: DueJobQuery): Promise<boolean>;
  getWeekly(id: string): Promise<SyncWeeklyRow | null>;
  listEventsOnDates(dates: string[]): Promise<ExistingEventRow[]>;
  insertEvent(row: EventInsertRow): Promise<EventInsertResult>;
  updateJob(id: string, update: SyncJobUpdate): Promise<void>;
}

const WEEKLY_COLUMNS = "id, date, is_published, photo_images, created_at";
const JOB_COLUMNS =
  "id, run_week, weekly_id, photos_hash, status, attempts, started_at, created_at";

function dbError(action: string, message: string): WeeklyEventSyncError {
  return new WeeklyEventSyncError("transient", `DB ${action} 실패: ${message}`);
}

/** service role 클라이언트로 만든 저장소 (RLS 우회 — cron 라우트 전용) */
export function createSupabaseWeeklyEventSyncStore(
  supabase: SupabaseClient,
): WeeklyEventSyncStore {
  return {
    async insertRunIfAbsent(runWeek) {
      const { data, error } = await supabase
        .from("weekly_event_sync_runs")
        .upsert(
          { run_week: runWeek },
          { onConflict: "run_week", ignoreDuplicates: true },
        )
        .select("run_week");
      if (error) throw dbError("주간 실행 기록", error.message);
      return (data ?? []).length > 0;
    },

    async deleteRun(runWeek) {
      const { error } = await supabase
        .from("weekly_event_sync_runs")
        .delete()
        .eq("run_week", runWeek);
      if (error) throw dbError("주간 실행 기록 삭제", error.message);
    },

    async listTargetWeeklies(range) {
      const [dated, undated] = await Promise.all([
        supabase
          .from("weeklies")
          .select(WEEKLY_COLUMNS)
          .eq("is_published", true)
          .gte("date", range.dateFrom)
          .lte("date", range.dateTo),
        supabase
          .from("weeklies")
          .select(WEEKLY_COLUMNS)
          .eq("is_published", true)
          .is("date", null)
          .gte("created_at", range.undatedCreatedFrom),
      ]);
      if (dated.error) throw dbError("대상 주보 조회", dated.error.message);
      if (undated.error) throw dbError("대상 주보 조회", undated.error.message);
      return [...(dated.data ?? []), ...(undated.data ?? [])] as SyncWeeklyRow[];
    },

    async insertJobsIfAbsent(rows) {
      if (rows.length === 0) return 0;
      const { data, error } = await supabase
        .from("weekly_event_sync_jobs")
        .upsert(rows, {
          onConflict: "weekly_id,photos_hash",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw dbError("작업 생성", error.message);
      return (data ?? []).length;
    },

    async listDueJobs(query) {
      const jobs = () =>
        supabase.from("weekly_event_sync_jobs").select(JOB_COLUMNS);
      const [pending, retry, stale] = await Promise.all([
        jobs()
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(query.limit),
        jobs()
          .eq("status", "retry_scheduled")
          .lte("next_retry_at", query.nowIso)
          .order("created_at", { ascending: true })
          .limit(query.limit),
        jobs()
          .eq("status", "running")
          .lt("started_at", query.staleBeforeIso)
          .order("created_at", { ascending: true })
          .limit(query.limit),
      ]);
      if (pending.error) throw dbError("작업 조회", pending.error.message);
      if (retry.error) throw dbError("작업 조회", retry.error.message);
      if (stale.error) throw dbError("작업 조회", stale.error.message);

      const rows = [
        ...(pending.data ?? []),
        ...(retry.data ?? []),
        ...(stale.data ?? []),
      ] as SyncJobRow[];
      return rows
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .slice(0, query.limit);
    },

    async claimJob(job, query) {
      if (
        job.status !== "pending" &&
        job.status !== "retry_scheduled" &&
        job.status !== "running"
      ) {
        return false;
      }

      let request = supabase
        .from("weekly_event_sync_jobs")
        .update({ status: "running", started_at: query.nowIso })
        .eq("id", job.id)
        .eq("status", job.status);
      if (job.status === "retry_scheduled") {
        request = request.lte("next_retry_at", query.nowIso);
      } else if (job.status === "running") {
        request = request.lt("started_at", query.staleBeforeIso);
      }

      const { data, error } = await request.select("id");
      if (error) throw dbError("작업 선점", error.message);
      return (data ?? []).length > 0;
    },

    async getWeekly(id) {
      const { data, error } = await supabase
        .from("weeklies")
        .select(WEEKLY_COLUMNS)
        .eq("id", id)
        .maybeSingle<SyncWeeklyRow>();
      if (error) throw dbError("주보 조회", error.message);
      return data;
    },

    async listEventsOnDates(dates) {
      if (dates.length === 0) return [];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date, start_time")
        .in("date", dates);
      if (error) throw dbError("기존 일정 조회", error.message);
      return (data ?? []) as ExistingEventRow[];
    },

    async insertEvent(row) {
      const { data, error } = await supabase
        .from("events")
        .insert(row)
        .select("id")
        .single<{ id: string }>();
      if (error || !data) {
        return { ok: false, error: error?.message ?? "INSERT 실패" };
      }
      return { ok: true, id: data.id };
    },

    async updateJob(id, update) {
      const { error } = await supabase
        .from("weekly_event_sync_jobs")
        .update(update)
        .eq("id", id);
      if (error) throw dbError("작업 저장", error.message);
    },
  };
}

// ──────────────────────────────────────────────
//  호출 1회 (틱)
// ──────────────────────────────────────────────

export type WeeklyPhotoExtractor = (
  input: WeeklyPhotoExtractInput,
) => Promise<WeeklyPhotoExtractResult>;

export interface WeeklyEventSyncDeps {
  store: WeeklyEventSyncStore;
  extract: WeeklyPhotoExtractor;
  now: Date;
}

interface JobSuccess {
  model: string;
  bulletinDate: string | null;
  anchorDate: string;
  dateMismatch: boolean;
  insertedEventIds: string[];
  skipped: WeeklyEventSyncSkippedItem[];
}

export async function runWeeklyEventSyncTick(
  deps: WeeklyEventSyncDeps,
): Promise<WeeklyEventSyncTickResult> {
  const { store, now } = deps;
  let createdRunWeek: string | null = null;
  let createdJobs = 0;

  const window = currentRunWeek(now);
  if (window && (await store.insertRunIfAbsent(window.runWeek))) {
    createdRunWeek = window.runWeek;
    try {
      createdJobs = await createJobsForRun(store, window);
    } catch (err) {
      // 작업 없이 실행 기록만 남으면 그 주가 통째로 빠진다 → 기록을 지워 다음 호출이 다시 만들게 한다
      try {
        await store.deleteRun(window.runWeek);
      } catch (rollbackErr) {
        console.error(
          "[weekly-event-sync] 주간 실행 기록 되돌리기 실패",
          rollbackErr instanceof Error
            ? sanitizeErrorMessage(rollbackErr.message)
            : rollbackErr,
        );
      }
      throw err;
    }
  }

  const query: DueJobQuery = {
    nowIso: now.toISOString(),
    staleBeforeIso: new Date(now.getTime() - STALE_RUNNING_MS).toISOString(),
    limit: MAX_JOBS_PER_TICK,
  };
  const dueJobs = await store.listDueJobs(query);

  const processed: WeeklyEventSyncJobResult[] = [];
  for (const job of dueJobs) {
    if (!(await store.claimJob(job, query))) continue;
    processed.push(await processJob(deps, job));
  }

  return {
    now: now.toISOString(),
    createdRunWeek,
    createdJobs,
    processed,
  };
}

async function createJobsForRun(
  store: WeeklyEventSyncStore,
  window: RunWeekWindow,
): Promise<number> {
  const weeklies = await store.listTargetWeeklies(targetWeeklyRange(window));
  const rows: NewSyncJobRow[] = weeklies
    .filter((w) => w.is_published && w.photo_images.length > 0)
    .map((w) => ({
      run_week: window.runWeek,
      weekly_id: w.id,
      photos_hash: hashPhotoImages(w.photo_images),
    }));
  if (rows.length === 0) return 0;
  return store.insertJobsIfAbsent(rows);
}

async function processJob(
  deps: WeeklyEventSyncDeps,
  job: SyncJobRow,
): Promise<WeeklyEventSyncJobResult> {
  const { store, now } = deps;

  if (now.getTime() - new Date(job.created_at).getTime() > JOB_EXPIRY_MS) {
    return failJob(
      store,
      job,
      new WeeklyEventSyncError(
        "expired",
        "작업 생성 후 14일이 지나 처리하지 않습니다.",
      ),
      now,
    );
  }

  let success: JobSuccess;
  try {
    success = await attemptJob(deps, job);
  } catch (err) {
    return failJob(
      store,
      job,
      err instanceof Error ? err : new Error(String(err)),
      now,
    );
  }

  await store.updateJob(job.id, {
    status: "succeeded",
    next_retry_at: null,
    finished_at: now.toISOString(),
    error_kind: null,
    last_error: null,
    model: success.model,
    bulletin_date: success.bulletinDate,
    anchor_date: success.anchorDate,
    date_mismatch: success.dateMismatch,
    inserted_event_ids: success.insertedEventIds,
    skipped: success.skipped,
  });

  return {
    jobId: job.id,
    weeklyId: job.weekly_id,
    status: "succeeded",
    attempts: job.attempts,
    insertedCount: success.insertedEventIds.length,
    skippedCount: success.skipped.length,
    nextRetryAt: null,
    errorKind: null,
    errorMessage: null,
  };
}

async function attemptJob(
  deps: WeeklyEventSyncDeps,
  job: SyncJobRow,
): Promise<JobSuccess> {
  const { store, extract, now } = deps;

  const weekly = await store.getWeekly(job.weekly_id);
  if (!weekly) {
    throw new WeeklyEventSyncError("superseded", "주보가 삭제되었습니다.");
  }
  if (!weekly.is_published) {
    throw new WeeklyEventSyncError("superseded", "주보가 비공개로 바뀌었습니다.");
  }
  if (hashPhotoImages(weekly.photo_images) !== job.photos_hash) {
    throw new WeeklyEventSyncError("superseded", "주보 사진이 바뀌었습니다.");
  }

  // weekly.date 가 없을 때의 기준: 실행 주 토요일 다음 날(주일)
  const sundayAfterRun = addDaysToDate(job.run_week, 1);
  const extraction = await extract({
    photoUrls: weekly.photo_images,
    referenceDate: weekly.date ?? sundayAfterRun,
  });

  const bulletinDate =
    extraction.bulletinDate !== null && isRealIsoDate(extraction.bulletinDate)
      ? extraction.bulletinDate
      : null;
  const anchorDate = bulletinDate ?? weekly.date ?? sundayAfterRun;
  const dateMismatch =
    bulletinDate !== null && weekly.date !== null && bulletinDate !== weekly.date;

  const candidates = extraction.candidates
    .map((c) => adjustConfidenceByDayOfWeek(c))
    .map((c) => adjustConfidenceByDateRange(c, anchorDate));

  // 달력에 없는 날짜(예: 2026-09-31)가 섞이면 DB date 조회 전체가 실패하므로 조회에 넣지 않는다.
  // 그런 후보는 selectEventsToInsert 가 "날짜 오류"로 건너뛰어 INSERT 에도 가지 않는다.
  const dates = Array.from(
    new Set(
      candidates.flatMap((c) => (c.date && isRealIsoDate(c.date) ? [c.date] : [])),
    ),
  );
  const existing = await store.listEventsOnDates(dates);

  const selection = selectEventsToInsert({
    candidates,
    weeklyId: weekly.id,
    todayKst: kstDateOf(now),
    existingEvents: existing.map((e) => ({
      title: e.title,
      date: e.date,
      startTime: e.start_time,
    })),
  });

  const insertedEventIds: string[] = [];
  const skipped: WeeklyEventSyncSkippedItem[] = [...selection.skipped];
  for (const row of selection.toInsert) {
    const result = await store.insertEvent(row);
    if (result.ok) {
      insertedEventIds.push(result.id);
    } else {
      skipped.push({
        title: row.title,
        date: row.date,
        reason: `등록 실패: ${result.error}`,
      });
    }
  }

  return {
    model: extraction.model,
    bulletinDate,
    anchorDate,
    dateMismatch,
    insertedEventIds,
    skipped,
  };
}

async function failJob(
  store: WeeklyEventSyncStore,
  job: SyncJobRow,
  error: Error,
  now: Date,
): Promise<WeeklyEventSyncJobResult> {
  const kind = classifyError(error);
  const outcome = decideFailureOutcome({ kind, attempts: job.attempts, now });
  const message = sanitizeErrorMessage(error.message || error.name);

  await store.updateJob(job.id, {
    status: outcome.status,
    attempts: outcome.attempts,
    next_retry_at: outcome.nextRetryAt,
    finished_at: outcome.status === "failed" ? now.toISOString() : null,
    error_kind: kind,
    last_error: message,
  });
  console.error(
    `[weekly-event-sync] job ${job.id} ${kind} → ${outcome.status}: ${message}`,
  );

  return {
    jobId: job.id,
    weeklyId: job.weekly_id,
    status: outcome.status,
    attempts: outcome.attempts,
    insertedCount: 0,
    skippedCount: 0,
    nextRetryAt: outcome.nextRetryAt,
    errorKind: kind,
    errorMessage: message,
  };
}
