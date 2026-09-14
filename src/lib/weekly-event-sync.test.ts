/**
 * 주보 사진 → 캘린더 주간 자동 등록 — 단위 테스트 (PLAN Acceptance Criteria 3~8).
 *
 * 외부 호출(Gemini·주보 사진 서버·Supabase REST)은 전역 fetch 모킹 또는 메모리 저장소로 대체한다.
 * 픽스처에는 실명·전화번호를 넣지 않는다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/cron/weekly-event-sync/route";
import {
  callGeminiSingleModel,
  GeminiHttpError,
  GeminiTimeoutError,
  type GeminiPart,
} from "@/lib/gemini";
import {
  adjustConfidenceByDayOfWeek,
  buildEventExtractionRules,
  dayOfWeekKo,
  extractEventsFromNews,
} from "@/lib/news-event-extractor";
import {
  classifyError,
  currentRunWeek,
  decideFailureOutcome,
  hashPhotoImages,
  isDuplicateEvent,
  isRealIsoDate,
  normalizeEventTitle,
  RETRY_DELAY_MS,
  runWeeklyEventSyncTick,
  selectEventsToInsert,
  targetWeeklyRange,
  type DueJobQuery,
  type EventInsertResult,
  type EventInsertRow,
  type ExistingEventRow,
  type NewSyncJobRow,
  type RunWeekWindow,
  type SyncJobRow,
  type SyncJobUpdate,
  type SyncWeeklyRow,
  type TargetWeeklyRange,
  type WeeklyEventSyncStore,
  type WeeklyPhotoExtractor,
} from "@/lib/weekly-event-sync";
import {
  buildWeeklyPhotoPrompt,
  extractEventsFromWeeklyPhotos,
  parseWeeklyPhotoResponse,
  WeeklyEventSyncError,
  type WeeklyPhotoExtractResult,
} from "@/lib/weekly-photo-event-extractor";
import type { ExtractedEvent } from "@/types/event-extraction";
import type {
  WeeklyEventSyncErrorKind,
  WeeklyEventSyncSkippedItem,
  WeeklyEventSyncTickResult,
} from "@/types/weekly-event-sync";

// ──────────────────────────────────────────────
//  공통 도우미
// ──────────────────────────────────────────────

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const CDN_BASE = "https://cdn.test";
const GEMINI_HOST = "generativelanguage.googleapis.com";

/** KST 벽시계 시각(YYYY-MM-DDTHH:mm) → Date */
function kst(wallClock: string): Date {
  return new Date(`${wallClock}:00+09:00`);
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/** 2026-09-12(토) 22:00 KST — 테스트 기준 주간 실행 시각 */
const RUN_START = kst("2026-09-12T22:00");

beforeEach(() => {
  // 실패 작업 로그(console.error)가 테스트 출력을 덮지 않게 한다
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

type FetchHandler = (
  url: string,
  init: RequestInit | undefined,
) => Response | Promise<Response>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if ("url" in input) return input.url;
  return input.toString();
}

/** 전역 fetch 를 가짜로 바꾸고 호출 기록을 돌려준다 */
function stubFetch(handler: FetchHandler): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
  return calls;
}

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function geminiTextResponse(text: string): Response {
  return jsonResponse(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
  );
}

/** 3바이트짜리 가짜 주보 사진 (base64 "AQID") */
function imageResponse(): Response {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/webp" },
  });
}

interface GeminiRequestBody {
  contents: { parts: GeminiPart[] }[];
  generationConfig?: { responseMimeType?: string };
}

function geminiRequestBody(call: FetchCall): GeminiRequestBody {
  return JSON.parse(String(call.init?.body)) as GeminiRequestBody;
}

function geminiCalls(calls: FetchCall[]): FetchCall[] {
  return calls.filter((c) => c.url.includes(GEMINI_HOST));
}

/** promise 가 거부될 때의 Error */
async function rejectionOf<T>(promise: Promise<T>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof Error) return err;
    throw new Error(`Error 가 아닌 값으로 거부됨: ${String(err)}`);
  }
  throw new Error("거부되지 않았습니다.");
}

/** 동기 함수가 던진 Error */
function thrownBy(fn: () => void): Error {
  try {
    fn();
  } catch (err) {
    if (err instanceof Error) return err;
    throw new Error(`Error 가 아닌 값을 던짐: ${String(err)}`);
  }
  throw new Error("예외가 발생하지 않았습니다.");
}

function mustRunWeek(now: Date): RunWeekWindow {
  const runWindow = currentRunWeek(now);
  if (!runWindow) {
    throw new Error(`${now.toISOString()} 는 주간 실행 시간대가 아닙니다.`);
  }
  return runWindow;
}

// ──────────────────────────────────────────────
//  픽스처 (실명·전화번호 없음)
// ──────────────────────────────────────────────

function photoUrls(weeklyId: string, count = 2): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${CDN_BASE}/weeklies/${weeklyId}/p${i + 1}.webp`,
  );
}

function makeWeekly(overrides: Partial<SyncWeeklyRow> = {}): SyncWeeklyRow {
  const id = overrides.id ?? "weekly-0913";
  return {
    id,
    date: "2026-09-13",
    is_published: true,
    photo_images: photoUrls(id),
    created_at: "2026-09-10T03:00:00.000Z",
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    title: "가을 수련회",
    date: "2026-09-19",
    startTime: "14:00",
    endTime: null,
    location: "본당",
    description: null,
    sourceNewsIndex: 0,
    sourceQuote: null,
    confidence: 0.9,
    rruleHint: null,
    ...overrides,
  };
}

function extraction(
  overrides: Partial<WeeklyPhotoExtractResult> = {},
): WeeklyPhotoExtractResult {
  return {
    model: "gemini-3.8-flash",
    bulletinDate: null,
    candidates: [],
    skipped: [],
    ...overrides,
  };
}

// ──────────────────────────────────────────────
//  메모리 저장소 — Supabase 구현과 같은 조건으로 동작
// ──────────────────────────────────────────────

interface MemoryJob extends SyncJobRow {
  next_retry_at: string | null;
  finished_at: string | null;
  error_kind: WeeklyEventSyncErrorKind | null;
  last_error: string | null;
  model: string | null;
  bulletin_date: string | null;
  anchor_date: string | null;
  date_mismatch: boolean;
  inserted_event_ids: string[];
  skipped: WeeklyEventSyncSkippedItem[];
}

interface MemoryEvent extends ExistingEventRow {
  /** 주간 동기화가 INSERT 한 행. 미리 넣어 둔 수동 입력 일정은 null */
  inserted: EventInsertRow | null;
}

class MemoryStore implements WeeklyEventSyncStore {
  /** 작업 created_at 기본값 now() 를 흉내 낸다 */
  clock: Date;
  readonly runs = new Set<string>();
  weeklies: SyncWeeklyRow[] = [];
  jobs: MemoryJob[] = [];
  events: MemoryEvent[] = [];
  /** 이 제목의 INSERT 는 DB 오류로 실패시킨다 */
  readonly failInsertTitles = new Set<string>();
  /** listEventsOnDates 에 전달된 날짜 목록 (호출 순서대로) */
  readonly listedDateCalls: string[][] = [];
  /** insertEvent 에 전달된 행 (실패한 INSERT 포함, 호출 순서대로) */
  readonly insertCalls: EventInsertRow[] = [];
  private sequence = 0;

  constructor(clock: Date) {
    this.clock = clock;
  }

  async insertRunIfAbsent(runWeek: string): Promise<boolean> {
    if (this.runs.has(runWeek)) return false;
    this.runs.add(runWeek);
    return true;
  }

  async deleteRun(runWeek: string): Promise<void> {
    this.runs.delete(runWeek);
    this.jobs = this.jobs.filter((j) => j.run_week !== runWeek);
  }

  async listTargetWeeklies(range: TargetWeeklyRange): Promise<SyncWeeklyRow[]> {
    return this.weeklies.filter(
      (w) =>
        w.is_published &&
        (w.date !== null
          ? w.date >= range.dateFrom && w.date <= range.dateTo
          : w.created_at >= range.undatedCreatedFrom),
    );
  }

  async insertJobsIfAbsent(rows: NewSyncJobRow[]): Promise<number> {
    let created = 0;
    for (const row of rows) {
      const exists = this.jobs.some(
        (j) => j.weekly_id === row.weekly_id && j.photos_hash === row.photos_hash,
      );
      if (exists) continue;
      this.addJob(row);
      created++;
    }
    return created;
  }

  addJob(row: NewSyncJobRow & Partial<MemoryJob>): MemoryJob {
    this.sequence++;
    const job: MemoryJob = {
      id: `job-${this.sequence}`,
      status: "pending",
      attempts: 0,
      started_at: null,
      created_at: this.clock.toISOString(),
      next_retry_at: null,
      finished_at: null,
      error_kind: null,
      last_error: null,
      model: null,
      bulletin_date: null,
      anchor_date: null,
      date_mismatch: false,
      inserted_event_ids: [],
      skipped: [],
      ...row,
    };
    this.jobs.push(job);
    return job;
  }

  private isDue(job: MemoryJob, query: DueJobQuery): boolean {
    if (job.status === "pending") return true;
    if (job.status === "retry_scheduled") {
      return job.next_retry_at !== null && job.next_retry_at <= query.nowIso;
    }
    if (job.status === "running") {
      return job.started_at !== null && job.started_at < query.staleBeforeIso;
    }
    return false;
  }

  async listDueJobs(query: DueJobQuery): Promise<SyncJobRow[]> {
    return this.jobs
      .filter((j) => this.isDue(j, query))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
      .slice(0, query.limit)
      .map((j) => ({
        id: j.id,
        run_week: j.run_week,
        weekly_id: j.weekly_id,
        photos_hash: j.photos_hash,
        status: j.status,
        attempts: j.attempts,
        started_at: j.started_at,
        created_at: j.created_at,
      }));
  }

  async claimJob(job: SyncJobRow, query: DueJobQuery): Promise<boolean> {
    const current = this.jobs.find((j) => j.id === job.id);
    if (!current || current.status !== job.status || !this.isDue(current, query)) {
      return false;
    }
    current.status = "running";
    current.started_at = query.nowIso;
    return true;
  }

  async getWeekly(id: string): Promise<SyncWeeklyRow | null> {
    return this.weeklies.find((w) => w.id === id) ?? null;
  }

  async listEventsOnDates(dates: string[]): Promise<ExistingEventRow[]> {
    this.listedDateCalls.push([...dates]);
    // PG date 캐스팅처럼 달력에 없는 날짜가 하나라도 섞이면 조회 전체가 실패한다 (Supabase 구현의 dbError 와 같은 종류)
    const outOfRange = dates.find((d) => !isRealIsoDate(d));
    if (outOfRange !== undefined) {
      throw new WeeklyEventSyncError(
        "transient",
        `DB 기존 일정 조회 실패: date/time field value out of range: "${outOfRange}"`,
      );
    }
    return this.events
      .filter((e) => dates.includes(e.date))
      .map((e) => ({ id: e.id, title: e.title, date: e.date, start_time: e.start_time }));
  }

  async insertEvent(row: EventInsertRow): Promise<EventInsertResult> {
    this.insertCalls.push(row);
    if (this.failInsertTitles.has(row.title)) {
      return { ok: false, error: "check constraint violation" };
    }
    this.sequence++;
    const id = `event-${this.sequence}`;
    this.events.push({
      id,
      title: row.title,
      date: row.date,
      // DB time 컬럼은 HH:mm:ss 로 돌려준다
      start_time: row.start_time ? `${row.start_time}:00` : null,
      inserted: row,
    });
    return { ok: true, id };
  }

  async updateJob(id: string, update: SyncJobUpdate): Promise<void> {
    const index = this.jobs.findIndex((j) => j.id === id);
    if (index < 0) throw new Error(`job ${id} 없음`);
    this.jobs[index] = { ...this.jobs[index], ...update };
  }

  addManualEvent(event: ExistingEventRow): void {
    this.events.push({ ...event, inserted: null });
  }

  insertedRows(): EventInsertRow[] {
    return this.events.flatMap((e) => (e.inserted ? [e.inserted] : []));
  }
}

function tick(
  store: MemoryStore,
  extract: WeeklyPhotoExtractor,
  now: Date,
): Promise<WeeklyEventSyncTickResult> {
  store.clock = now;
  return runWeeklyEventSyncTick({ store, extract, now });
}

// ──────────────────────────────────────────────
//  주간 실행 시각
// ──────────────────────────────────────────────

describe("주간 실행 시각 (토 22:00 KST 부터 24시간)", () => {
  it.each<{ label: string; wallClock: string; expected: string | null }>([
    { label: "토 21:59", wallClock: "2026-09-12T21:59", expected: null },
    { label: "토 22:00", wallClock: "2026-09-12T22:00", expected: "2026-09-12" },
    { label: "일 21:59", wallClock: "2026-09-13T21:59", expected: "2026-09-12" },
    { label: "일 22:00", wallClock: "2026-09-13T22:00", expected: null },
    { label: "월 10:00", wallClock: "2026-09-14T10:00", expected: null },
  ])("$label KST → $expected", async ({ wallClock, expected }) => {
    const now = kst(wallClock);
    expect(currentRunWeek(now)?.runWeek ?? null).toBe(expected);

    const store = new MemoryStore(now);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => extraction());
    const result = await tick(store, extract, now);

    expect(result.createdRunWeek).toBe(expected);
    expect(result.createdJobs).toBe(expected ? 1 : 0);
    expect(store.runs.size).toBe(expected ? 1 : 0);
  });

  it("대상 주보 범위: date 는 S−13일 ~ S+8일, date 없는 주보는 S−14일 이후 생성분", () => {
    expect(targetWeeklyRange(mustRunWeek(RUN_START))).toEqual({
      dateFrom: "2026-08-30",
      dateTo: "2026-09-20",
      undatedCreatedFrom: "2026-08-29T13:00:00.000Z",
    });
  });

  it("창 안의 첫 호출만 작업을 만든다 — 공개·사진 있는·범위 안 주보만", async () => {
    const store = new MemoryStore(RUN_START);
    const target = makeWeekly({ id: "weekly-target" });
    store.weeklies = [
      target,
      makeWeekly({ id: "weekly-unpublished", is_published: false }),
      makeWeekly({ id: "weekly-no-photos", photo_images: [] }),
      makeWeekly({ id: "weekly-too-old", date: "2026-08-29" }),
      makeWeekly({ id: "weekly-undated", date: null, created_at: "2026-09-11T00:00:00.000Z" }),
    ];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => extraction());

    const first = await tick(store, extract, RUN_START);
    expect(first.createdRunWeek).toBe("2026-09-12");
    expect(first.createdJobs).toBe(2);
    expect(store.jobs.map((j) => j.weekly_id)).toEqual(["weekly-target", "weekly-undated"]);
    expect(store.jobs[0].photos_hash).toBe(hashPhotoImages(target.photo_images));

    const second = await tick(store, extract, kst("2026-09-13T01:00"));
    expect(second.createdRunWeek).toBeNull();
    expect(second.createdJobs).toBe(0);
    expect(store.jobs).toHaveLength(2);
  });

  it("같은 주보·같은 사진의 작업이 이미 있으면 다음 주 실행에서 다시 만들지 않는다", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => {
      throw new WeeklyEventSyncError("config", "GEMINI_API_KEY가 설정되지 않았습니다.");
    });
    await tick(store, extract, RUN_START);

    const nextWeek = await tick(store, extract, addMs(RUN_START, 7 * DAY_MS));
    expect(nextWeek.createdRunWeek).toBe("2026-09-19");
    expect(nextWeek.createdJobs).toBe(0);
    expect(store.jobs).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
//  오류 분류
// ──────────────────────────────────────────────

describe("오류 분류", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_CDN_BASE_URL", CDN_BASE);
  });

  it.each([429, 500, 502, 503, 504])("Gemini HTTP %i → transient", async (status) => {
    stubFetch(() => jsonResponse('{"error":{"message":"busy"}}', status));
    const err = await rejectionOf(
      callGeminiSingleModel({ model: "gemini-3.8-flash", parts: [{ text: "x" }], timeoutMs: 5000 }),
    );
    expect(err).toBeInstanceOf(GeminiHttpError);
    expect(classifyError(err)).toBe("transient");
  });

  it("Gemini 응답 시간 초과 → transient", async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const err = await rejectionOf(
      callGeminiSingleModel({ model: "gemini-3.8-flash", parts: [{ text: "x" }], timeoutMs: 20 }),
    );
    expect(err).toBeInstanceOf(GeminiTimeoutError);
    expect(classifyError(err)).toBe("transient");
  });

  it("네트워크 오류 → transient", () => {
    expect(classifyError(new TypeError("fetch failed"))).toBe("transient");
  });

  it.each([400, 401, 403, 404])("Gemini HTTP %i → config", async (status) => {
    stubFetch(() => jsonResponse('{"error":{"message":"bad request"}}', status));
    const err = await rejectionOf(
      callGeminiSingleModel({ model: "gemini-3.8-flash", parts: [{ text: "x" }], timeoutMs: 5000 }),
    );
    expect(err).toBeInstanceOf(GeminiHttpError);
    expect(classifyError(err)).toBe("config");
  });

  it("GEMINI_API_KEY 없음 → config (사진·Gemini 요청을 보내지 않음)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const calls = stubFetch(() => imageResponse());
    const err = await rejectionOf(
      extractEventsFromWeeklyPhotos({ photoUrls: photoUrls("weekly-0913"), referenceDate: "2026-09-13" }),
    );
    expect(err).toBeInstanceOf(WeeklyEventSyncError);
    expect(classifyError(err)).toBe("config");
    expect(calls).toHaveLength(0);
  });

  it("JSON 이 아닌 응답 → invalid_response", async () => {
    stubFetch((url) =>
      url.includes(GEMINI_HOST)
        ? geminiTextResponse("이번 주에는 등록할 일정이 없습니다.")
        : imageResponse(),
    );
    const err = await rejectionOf(
      extractEventsFromWeeklyPhotos({ photoUrls: photoUrls("weekly-0913"), referenceDate: "2026-09-13" }),
    );
    expect(err).toBeInstanceOf(WeeklyEventSyncError);
    expect(classifyError(err)).toBe("invalid_response");
  });

  it("스키마 불일치 응답 → invalid_response", async () => {
    stubFetch((url) =>
      url.includes(GEMINI_HOST)
        ? geminiTextResponse('{"bulletinDate":null,"candidates":[{"title":"가을 수련회","date":"9월 19일"}],"skipped":[]}')
        : imageResponse(),
    );
    const err = await rejectionOf(
      extractEventsFromWeeklyPhotos({ photoUrls: photoUrls("weekly-0913"), referenceDate: "2026-09-13" }),
    );
    expect(err).toBeInstanceOf(WeeklyEventSyncError);
    expect(classifyError(err)).toBe("invalid_response");
  });

  it("빈 응답·bulletinDate 누락도 invalid_response, 코드펜스로 감싼 정상 응답은 통과", () => {
    for (const raw of ["", "   ", '{"candidates":[],"skipped":[]}']) {
      expect(classifyError(thrownBy(() => parseWeeklyPhotoResponse(raw)))).toBe("invalid_response");
    }
    expect(
      parseWeeklyPhotoResponse('```json\n{"bulletinDate":"2026-09-13","candidates":[],"skipped":[]}\n```'),
    ).toEqual({ bulletinDate: "2026-09-13", candidates: [], skipped: [] });
  });
});

// ──────────────────────────────────────────────
//  재시도·만료·주보 변경
// ──────────────────────────────────────────────

describe("재시도와 만료", () => {
  it("transient 실패: next_retry_at = now + 2시간 50분, 횟수가 쌓여도 failed 가 되지 않는다", async () => {
    expect(RETRY_DELAY_MS).toBe(2 * HOUR_MS + 50 * MINUTE_MS);

    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => {
      throw new GeminiHttpError(503, "Gemini API 오류 (gemini-3.8-flash): 503 overloaded");
    });

    const first = await tick(store, extract, RUN_START);
    expect(first.processed).toEqual([
      {
        jobId: store.jobs[0].id,
        weeklyId: "weekly-0913",
        status: "retry_scheduled",
        attempts: 1,
        insertedCount: 0,
        skippedCount: 0,
        nextRetryAt: "2026-09-12T15:50:00.000Z",
        errorKind: "transient",
        errorMessage: "Gemini API 오류 (gemini-3.8-flash): 503 overloaded",
      },
    ]);
    expect(store.jobs[0]).toMatchObject({
      status: "retry_scheduled",
      attempts: 1,
      next_retry_at: "2026-09-12T15:50:00.000Z",
      error_kind: "transient",
      finished_at: null,
    });

    // 재시도 시각 전 호출은 처리하지 않는다
    const early = await tick(store, extract, addMs(RUN_START, 2 * HOUR_MS));
    expect(early.processed).toEqual([]);

    let now = RUN_START;
    for (let attempt = 2; attempt <= 12; attempt++) {
      now = addMs(now, 3 * HOUR_MS);
      const result = await tick(store, extract, now);
      expect(result.processed).toHaveLength(1);
      expect(result.processed[0]).toMatchObject({
        status: "retry_scheduled",
        attempts: attempt,
        errorKind: "transient",
        nextRetryAt: addMs(now, RETRY_DELAY_MS).toISOString(),
      });
    }
    expect(store.jobs[0]).toMatchObject({ status: "retry_scheduled", attempts: 12 });
    expect(extract).toHaveBeenCalledTimes(12);
  });

  it("invalid_response 는 3회째 failed", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => {
      throw new WeeklyEventSyncError("invalid_response", "Gemini 응답이 JSON 형식이 아닙니다.");
    });

    const r1 = await tick(store, extract, RUN_START);
    expect(r1.processed[0]).toMatchObject({ status: "retry_scheduled", attempts: 1, errorKind: "invalid_response" });

    const r2 = await tick(store, extract, addMs(RUN_START, 3 * HOUR_MS));
    expect(r2.processed[0]).toMatchObject({ status: "retry_scheduled", attempts: 2, errorKind: "invalid_response" });

    const third = addMs(RUN_START, 6 * HOUR_MS);
    const r3 = await tick(store, extract, third);
    expect(r3.processed[0]).toMatchObject({
      status: "failed",
      attempts: 3,
      nextRetryAt: null,
      errorKind: "invalid_response",
    });
    expect(store.jobs[0]).toMatchObject({
      status: "failed",
      attempts: 3,
      next_retry_at: null,
      finished_at: third.toISOString(),
      error_kind: "invalid_response",
    });

    const r4 = await tick(store, extract, addMs(RUN_START, 9 * HOUR_MS));
    expect(r4.processed).toEqual([]);
    expect(extract).toHaveBeenCalledTimes(3);
  });

  it("photo_fetch·config 도 3회째 failed, superseded·expired 는 즉시 failed", () => {
    for (const kind of ["photo_fetch", "config", "invalid_response"] as const) {
      expect(decideFailureOutcome({ kind, attempts: 1, now: RUN_START })).toEqual({
        status: "retry_scheduled",
        attempts: 2,
        nextRetryAt: "2026-09-12T15:50:00.000Z",
      });
      expect(decideFailureOutcome({ kind, attempts: 2, now: RUN_START })).toEqual({
        status: "failed",
        attempts: 3,
        nextRetryAt: null,
      });
    }
    for (const kind of ["superseded", "expired"] as const) {
      expect(decideFailureOutcome({ kind, attempts: 0, now: RUN_START })).toEqual({
        status: "failed",
        attempts: 0,
        nextRetryAt: null,
      });
    }
    expect(decideFailureOutcome({ kind: "transient", attempts: 500, now: RUN_START })).toMatchObject({
      status: "retry_scheduled",
      attempts: 501,
    });
  });

  it("생성 후 14일이 지난 작업 → failed / expired (사진 추출을 다시 호출하지 않음)", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => {
      throw new GeminiHttpError(503, "busy");
    });
    await tick(store, extract, RUN_START);
    expect(extract).toHaveBeenCalledTimes(1);

    const later = addMs(RUN_START, 15 * DAY_MS);
    const result = await tick(store, extract, later);
    expect(result.processed).toHaveLength(1);
    expect(result.processed[0]).toMatchObject({ status: "failed", errorKind: "expired", nextRetryAt: null });
    expect(store.jobs[0]).toMatchObject({
      status: "failed",
      error_kind: "expired",
      finished_at: later.toISOString(),
    });
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it("중간에 멈춘 running 작업은 시작 후 15분이 지나야 다시 처리한다", async () => {
    const store = new MemoryStore(RUN_START);
    const weekly = makeWeekly();
    store.weeklies = [weekly];
    store.runs.add("2026-09-12");
    const now = addMs(RUN_START, 3 * HOUR_MS);
    store.addJob({
      run_week: "2026-09-12",
      weekly_id: weekly.id,
      photos_hash: hashPhotoImages(weekly.photo_images),
      status: "running",
      started_at: addMs(now, -10 * MINUTE_MS).toISOString(),
    });
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => extraction());

    expect((await tick(store, extract, now)).processed).toEqual([]);
    const later = await tick(store, extract, addMs(now, 6 * MINUTE_MS));
    expect(later.processed).toMatchObject([{ status: "succeeded" }]);
  });

  it.each<{ label: string; mutate: (store: MemoryStore) => void }>([
    {
      label: "사진이 바뀜",
      mutate: (store) => {
        store.weeklies[0] = { ...store.weeklies[0], photo_images: photoUrls("weekly-0913", 3) };
      },
    },
    {
      label: "비공개로 바뀜",
      mutate: (store) => {
        store.weeklies[0] = { ...store.weeklies[0], is_published: false };
      },
    },
    {
      label: "삭제됨",
      mutate: (store) => {
        store.weeklies = [];
      },
    },
  ])("주보가 $label → failed / superseded (다시 추출하지 않음)", async ({ mutate }) => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => {
      throw new GeminiHttpError(503, "busy");
    });
    await tick(store, extract, RUN_START);

    mutate(store);
    const result = await tick(store, extract, addMs(RUN_START, 3 * HOUR_MS));
    expect(result.processed[0]).toMatchObject({ status: "failed", errorKind: "superseded", nextRetryAt: null });
    expect(store.jobs[0]).toMatchObject({ status: "failed", error_kind: "superseded" });
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────
//  등록 여부 — 필터·중복
// ──────────────────────────────────────────────

describe("등록 여부 — 필터·중복", () => {
  it("제목 정규화: 연도 표기·공백·문장부호·따옴표 제거", () => {
    expect(normalizeEventTitle("2026 청년사랑 알파코스")).toBe("청년사랑알파코스");
    expect(normalizeEventTitle('2026년 "청년사랑" 알파코스!')).toBe("청년사랑알파코스");
    expect(normalizeEventTitle("청년사랑 알파코스")).toBe("청년사랑알파코스");
  });

  it("같은 날 '2026 청년사랑 알파코스' 와 '청년사랑 알파코스' → 중복", () => {
    expect(
      isDuplicateEvent(
        { title: "2026 청년사랑 알파코스", date: "2026-09-13", startTime: "13:30:00" },
        { title: "청년사랑 알파코스", date: "2026-09-13", startTime: "13:30" },
      ),
    ).toBe(true);

    const selection = selectEventsToInsert({
      candidates: [makeCandidate({ title: "청년사랑 알파코스", date: "2026-09-13", startTime: "13:30" })],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [{ title: "2026 청년사랑 알파코스", date: "2026-09-13", startTime: "13:30:00" }],
    });
    expect(selection.toInsert).toEqual([]);
    expect(selection.skipped).toEqual([
      { title: "청년사랑 알파코스", date: "2026-09-13", reason: "이미 등록된 일정" },
    ]);
  });

  it("한쪽 제목이 다른 쪽을 포함하고 시작 시간이 한쪽만 있으면 중복, 날짜가 다르면 중복 아님", () => {
    const alpha = { title: "청년사랑 알파코스", date: "2026-09-13", startTime: "13:30" };
    expect(isDuplicateEvent({ title: "알파코스", date: "2026-09-13", startTime: null }, alpha)).toBe(true);
    expect(isDuplicateEvent({ title: "알파코스", date: "2026-09-20", startTime: null }, alpha)).toBe(false);
  });

  it("같은 날 '노방 전도' 11:00 과 14:00 → 둘 다 등록", () => {
    const selection = selectEventsToInsert({
      candidates: [
        makeCandidate({ title: "노방 전도", date: "2026-09-19", startTime: "11:00", location: null }),
        makeCandidate({ title: "노방 전도", date: "2026-09-19", startTime: "14:00", location: null }),
      ],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });
    expect(selection.toInsert.map((r) => [r.title, r.start_time])).toEqual([
      ["노방 전도", "11:00"],
      ["노방 전도", "14:00"],
    ]);
    expect(selection.skipped).toEqual([]);
  });

  it("같은 작업에서 먼저 등록하기로 한 후보와 같으면 중복", () => {
    const selection = selectEventsToInsert({
      candidates: [makeCandidate(), makeCandidate({ title: "2026 가을 수련회" })],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });
    expect(selection.toInsert).toHaveLength(1);
    expect(selection.skipped).toEqual([
      { title: "2026 가을 수련회", date: "2026-09-19", reason: "이미 등록된 일정" },
    ]);
  });

  it("필터: 지난 날짜·confidence 0.5·날짜 없음 → 등록 안 함 (KST 오늘·0.6 은 등록)", () => {
    const selection = selectEventsToInsert({
      candidates: [
        makeCandidate({ title: "지난 행사", date: "2026-09-11" }),
        makeCandidate({ title: "신뢰도 낮은 행사", date: "2026-09-19", confidence: 0.5 }),
        makeCandidate({ title: "날짜 없는 행사", date: null }),
        makeCandidate({ title: "오늘 행사", date: "2026-09-12" }),
        makeCandidate({ title: "경계 신뢰도 행사", date: "2026-09-20", confidence: 0.6 }),
      ],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });
    expect(selection.toInsert.map((r) => r.title)).toEqual(["오늘 행사", "경계 신뢰도 행사"]);
    expect(selection.skipped).toEqual([
      { title: "지난 행사", date: "2026-09-11", reason: "지난 일정" },
      { title: "신뢰도 낮은 행사", date: "2026-09-19", reason: "신뢰도 낮음" },
      { title: "날짜 없는 행사", date: null, reason: "날짜 없음" },
    ]);
  });

  it("endTime ≤ startTime 이거나 startTime 없이 endTime 만 있으면 endTime 만 버리고 등록", () => {
    const selection = selectEventsToInsert({
      candidates: [
        makeCandidate({ title: "A 모임", startTime: "14:00", endTime: "13:00" }),
        makeCandidate({ title: "B 모임", startTime: "14:00", endTime: "14:00" }),
        makeCandidate({ title: "C 모임", startTime: null, endTime: "16:00" }),
        makeCandidate({ title: "D 모임", startTime: "14:00", endTime: "16:00" }),
      ],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });
    expect(selection.toInsert.map((r) => [r.title, r.start_time, r.end_time])).toEqual([
      ["A 모임", "14:00", null],
      ["B 모임", "14:00", null],
      ["C 모임", null, null],
      ["D 모임", "14:00", "16:00"],
    ]);
  });

  it("source_news_index 가 0~49 밖이면 null", () => {
    const selection = selectEventsToInsert({
      candidates: [makeCandidate({ sourceNewsIndex: -1 }), makeCandidate({ title: "겨울 수련회", sourceNewsIndex: 49 })],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });
    expect(selection.toInsert.map((r) => r.source_news_index)).toEqual([null, 49]);
  });
});

// ──────────────────────────────────────────────
//  작업 처리 — events 자동 등록
// ──────────────────────────────────────────────

describe("작업 처리 — events 자동 등록", () => {
  it("등록 행은 notify=false, extracted_by_ai=true, source_weekly_id 설정, created_by=null", async () => {
    const store = new MemoryStore(RUN_START);
    const weekly = makeWeekly();
    store.weeklies = [weekly];
    store.addManualEvent({
      id: "manual-1",
      title: "2026 청년사랑 알파코스",
      date: "2026-09-13",
      start_time: "13:30:00",
    });
    const extract = vi.fn<WeeklyPhotoExtractor>(async () =>
      extraction({
        bulletinDate: "2026-09-13",
        candidates: [
          makeCandidate({ endTime: "17:00", description: "준비물: 성경" }),
          makeCandidate({ title: "노방 전도", startTime: "11:00", location: null, sourceNewsIndex: 7 }),
          makeCandidate({ title: "노방 전도", startTime: "14:00", location: null, sourceNewsIndex: 7 }),
          makeCandidate({ title: "청년사랑 알파코스", date: "2026-09-13", startTime: "13:30", sourceNewsIndex: 4 }),
          makeCandidate({ title: "지난 기도 모임", date: "2026-09-09", sourceNewsIndex: 2 }),
          makeCandidate({ title: "신뢰도 낮은 모임", date: "2026-09-20", confidence: 0.5, sourceNewsIndex: 8 }),
        ],
      }),
    );

    const result = await tick(store, extract, RUN_START);

    expect(extract).toHaveBeenCalledWith({ photoUrls: weekly.photo_images, referenceDate: "2026-09-13" });
    expect(result.processed).toHaveLength(1);
    expect(result.processed[0]).toMatchObject({
      weeklyId: "weekly-0913",
      status: "succeeded",
      attempts: 0,
      insertedCount: 3,
      skippedCount: 3,
      nextRetryAt: null,
      errorKind: null,
      errorMessage: null,
    });

    const inserted = store.insertedRows();
    expect(inserted).toHaveLength(3);
    for (const row of inserted) {
      expect(row).toMatchObject({
        notify: false,
        extracted_by_ai: true,
        source_weekly_id: "weekly-0913",
        created_by: null,
      });
    }
    expect(inserted[0]).toEqual({
      title: "가을 수련회",
      description: "준비물: 성경",
      location: "본당",
      date: "2026-09-19",
      start_time: "14:00",
      end_time: "17:00",
      notify: false,
      created_by: null,
      source_weekly_id: "weekly-0913",
      source_news_index: 0,
      extracted_by_ai: true,
    });

    const job = store.jobs[0];
    expect(job).toMatchObject({
      status: "succeeded",
      model: "gemini-3.8-flash",
      bulletin_date: "2026-09-13",
      anchor_date: "2026-09-13",
      date_mismatch: false,
      finished_at: RUN_START.toISOString(),
      next_retry_at: null,
      error_kind: null,
      last_error: null,
    });
    expect(job.inserted_event_ids).toEqual(
      store.events.filter((e) => e.inserted !== null).map((e) => e.id),
    );
    expect(job.skipped).toEqual([
      { title: "청년사랑 알파코스", date: "2026-09-13", reason: "이미 등록된 일정" },
      { title: "지난 기도 모임", date: "2026-09-09", reason: "지난 일정" },
      { title: "신뢰도 낮은 모임", date: "2026-09-20", reason: "신뢰도 낮음" },
    ]);
  });

  it("기준 날짜: 인쇄 발행일이 weekly.date 보다 우선하고, 다르면 date_mismatch=true", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly({ date: "2026-09-13" })];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () =>
      extraction({
        bulletinDate: "2026-09-06",
        candidates: [
          // 인쇄 발행일(9/6) 기준 369일 뒤 → 범위 보정으로 신뢰도 0.4 → 등록 안 함
          // (weekly.date 9/13 기준이었다면 362일이라 보정되지 않았을 것)
          makeCandidate({ title: "내년 가을 수련회", date: "2027-09-10" }),
          makeCandidate({ title: "가을 수련회", date: "2026-09-19" }),
        ],
      }),
    );

    await tick(store, extract, RUN_START);

    expect(store.jobs[0]).toMatchObject({
      status: "succeeded",
      bulletin_date: "2026-09-06",
      anchor_date: "2026-09-06",
      date_mismatch: true,
    });
    expect(store.jobs[0].skipped).toEqual([
      { title: "내년 가을 수련회", date: "2027-09-10", reason: "신뢰도 낮음" },
    ]);
    expect(store.insertedRows().map((r) => r.title)).toEqual(["가을 수련회"]);
  });

  it("인쇄 발행일을 못 읽으면 weekly.date, 둘 다 없으면 실행 주 다음 날(주일)이 기준", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [
      makeWeekly({ id: "weekly-dated", date: "2026-09-06" }),
      makeWeekly({ id: "weekly-undated", date: null, created_at: "2026-09-11T00:00:00.000Z" }),
    ];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () => extraction({ bulletinDate: null }));

    await tick(store, extract, RUN_START);

    expect(extract.mock.calls.map(([input]) => input.referenceDate)).toEqual(["2026-09-06", "2026-09-13"]);
    expect(
      store.jobs.map((j) => [j.weekly_id, j.anchor_date, j.bulletin_date, j.date_mismatch]),
    ).toEqual([
      ["weekly-dated", "2026-09-06", null, false],
      ["weekly-undated", "2026-09-13", null, false],
    ]);
  });

  it("INSERT 오류는 그 후보만 건너뛰고 작업은 계속한다", async () => {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    store.failInsertTitles.add("가을 수련회");
    const extract = vi.fn<WeeklyPhotoExtractor>(async () =>
      extraction({
        candidates: [makeCandidate(), makeCandidate({ title: "노방 전도", startTime: "11:00" })],
      }),
    );

    const result = await tick(store, extract, RUN_START);

    expect(result.processed[0]).toMatchObject({ status: "succeeded", insertedCount: 1, skippedCount: 1 });
    expect(store.insertedRows().map((r) => r.title)).toEqual(["노방 전도"]);
    expect(store.jobs[0].skipped).toEqual([
      { title: "가을 수련회", date: "2026-09-19", reason: "등록 실패: check constraint violation" },
    ]);
  });
});

// ──────────────────────────────────────────────
//  실제로 없는 날짜 후보 (PLAN 2차 수정, AC 8)
// ──────────────────────────────────────────────

describe("실제로 없는 날짜 후보 — 같은 날짜 일정 조회·INSERT 전에 '날짜 오류'로 건너뜀 (AC 8)", () => {
  const INVALID_DATES: readonly string[] = ["2026-09-31", "2026-02-30"];

  /** 유효 후보 2건 사이에 형식만 맞고 달력에 없는 날짜 후보 2건을 섞은 응답으로 틱 1회 */
  async function runMixedDateTick(): Promise<{ store: MemoryStore; result: WeeklyEventSyncTickResult }> {
    const store = new MemoryStore(RUN_START);
    store.weeklies = [makeWeekly()];
    const extract = vi.fn<WeeklyPhotoExtractor>(async () =>
      extraction({
        candidates: [
          makeCandidate({ title: "가을 수련회", date: "2026-09-19", sourceNewsIndex: 0 }),
          makeCandidate({ title: "교회 대청소", date: "2026-09-31", startTime: "10:00", sourceNewsIndex: 1 }),
          makeCandidate({ title: "노방 전도", date: "2026-09-20", startTime: "11:00", location: null, sourceNewsIndex: 2 }),
          makeCandidate({ title: "구역 모임", date: "2026-02-30", startTime: "19:30", sourceNewsIndex: 3 }),
        ],
      }),
    );
    const result = await tick(store, extract, RUN_START);
    return { store, result };
  }

  it("유효 후보와 2026-09-31·2026-02-30 후보가 섞이면 없는 날짜 후보만 skipped('날짜 오류'), 유효 후보는 등록, 작업은 succeeded", async () => {
    const { store, result } = await runMixedDateTick();

    expect(result.processed).toHaveLength(1);
    expect(result.processed[0]).toMatchObject({
      weeklyId: "weekly-0913",
      status: "succeeded",
      attempts: 0,
      insertedCount: 2,
      skippedCount: 2,
      nextRetryAt: null,
      errorKind: null,
      errorMessage: null,
    });
    expect(store.insertedRows().map((r) => [r.title, r.date])).toEqual([
      ["가을 수련회", "2026-09-19"],
      ["노방 전도", "2026-09-20"],
    ]);

    const job = store.jobs[0];
    expect(job).toMatchObject({ status: "succeeded", error_kind: null, last_error: null, next_retry_at: null });
    expect(job.inserted_event_ids).toHaveLength(2);
    expect(job.skipped).toEqual([
      { title: "교회 대청소", date: "2026-09-31", reason: "날짜 오류" },
      { title: "구역 모임", date: "2026-02-30", reason: "날짜 오류" },
    ]);
  });

  it("저장소의 같은 날짜 일정 조회와 INSERT 에 달력에 없는 날짜가 전달되지 않는다", async () => {
    const { store } = await runMixedDateTick();

    expect(store.listedDateCalls).toEqual([["2026-09-19", "2026-09-20"]]);
    expect(store.insertCalls.map((r) => r.date)).toEqual(["2026-09-19", "2026-09-20"]);
    for (const invalid of INVALID_DATES) {
      expect(store.listedDateCalls.flat()).not.toContain(invalid);
      expect(store.insertCalls.map((r) => r.date)).not.toContain(invalid);
    }
  });

  it("selectEventsToInsert: '날짜 없음' 다음, '지난 일정'·'신뢰도 낮음' 보다 먼저 '날짜 오류'로 판정하고, 실제 있는 윤년 2월 29일은 등록", () => {
    const selection = selectEventsToInsert({
      candidates: [
        makeCandidate({ title: "날짜 없는 행사", date: null }),
        // KST 오늘(9/12)보다 앞선 문자열이지만 "지난 일정"이 아니라 "날짜 오류"
        makeCandidate({ title: "2월 행사", date: "2026-02-30" }),
        // 신뢰도도 낮지만 "날짜 오류"가 먼저
        makeCandidate({ title: "9월 말 행사", date: "2026-09-31", confidence: 0.5 }),
        makeCandidate({ title: "윤년 행사", date: "2028-02-29" }),
      ],
      weeklyId: "weekly-0913",
      todayKst: "2026-09-12",
      existingEvents: [],
    });

    expect(selection.toInsert.map((r) => [r.title, r.date])).toEqual([["윤년 행사", "2028-02-29"]]);
    expect(selection.skipped).toEqual([
      { title: "날짜 없는 행사", date: null, reason: "날짜 없음" },
      { title: "2월 행사", date: "2026-02-30", reason: "날짜 오류" },
      { title: "9월 말 행사", date: "2026-09-31", reason: "날짜 오류" },
    ]);
  });
});

// ──────────────────────────────────────────────
//  주보 사진 추출 — 모델·사진·요청 형태
// ──────────────────────────────────────────────

describe("주보 사진 추출 — 모델·사진·요청 형태", () => {
  const EMPTY_RESPONSE = '{"bulletinDate":null,"candidates":[],"skipped":[]}';

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_CDN_BASE_URL", CDN_BASE);
    vi.stubEnv("GEMINI_EVENT_SYNC_MODEL", undefined);
  });

  it("기본 모델 gemini-3.8-flash 하나만 호출하고, 503 이어도 2.5 계열로 넘어가지 않는다", async () => {
    const calls = stubFetch((url) =>
      url.includes(GEMINI_HOST) ? jsonResponse('{"error":{"code":503}}', 503) : imageResponse(),
    );

    const err = await rejectionOf(
      extractEventsFromWeeklyPhotos({ photoUrls: photoUrls("weekly-0913"), referenceDate: "2026-09-13" }),
    );

    expect(err).toBeInstanceOf(GeminiHttpError);
    expect(classifyError(err)).toBe("transient");
    const gemini = geminiCalls(calls);
    expect(gemini).toHaveLength(1);
    expect(gemini[0].url).toContain("/v1beta/models/gemini-3.8-flash:generateContent");
    expect(calls.some((c) => c.url.includes("gemini-2.5") || c.url.includes("flash-latest"))).toBe(false);
  });

  it("GEMINI_EVENT_SYNC_MODEL 이 있으면 그 모델만 쓰고, JSON 응답 형식 + 사진 inlineData 로 요청한다", async () => {
    vi.stubEnv("GEMINI_EVENT_SYNC_MODEL", "gemini-sync-test-model");
    const responseJson = JSON.stringify({
      bulletinDate: "2026-09-13",
      candidates: [makeCandidate()],
      skipped: [{ sourceNewsIndex: 5, reason: "봉사 당번 안내" }],
    });
    const calls = stubFetch((url) =>
      url.includes(GEMINI_HOST) ? geminiTextResponse(responseJson) : imageResponse(),
    );

    const result = await extractEventsFromWeeklyPhotos({
      photoUrls: photoUrls("weekly-0913"),
      referenceDate: "2026-09-13",
    });

    expect(result).toEqual({
      model: "gemini-sync-test-model",
      bulletinDate: "2026-09-13",
      candidates: [makeCandidate()],
      skipped: [{ sourceNewsIndex: 5, reason: "봉사 당번 안내" }],
    });
    const gemini = geminiCalls(calls);
    expect(gemini).toHaveLength(1);
    expect(gemini[0].url).toContain("/models/gemini-sync-test-model:generateContent");

    const body = geminiRequestBody(gemini[0]);
    expect(body.generationConfig).toEqual({ responseMimeType: "application/json" });
    expect(body.contents).toHaveLength(1);
    const [promptPart, ...imageParts] = body.contents[0].parts;
    expect(promptPart).toEqual({ text: buildWeeklyPhotoPrompt("2026-09-13") });
    expect(imageParts).toEqual([
      { inlineData: { mimeType: "image/webp", data: "AQID" } },
      { inlineData: { mimeType: "image/webp", data: "AQID" } },
    ]);
  });

  it("사진은 허용 URL 을 앞에서부터 최대 4장만 내려받는다", async () => {
    const urls = ["https://evil.test/weeklies/weekly-0913/p0.webp", ...photoUrls("weekly-0913", 6)];
    const calls = stubFetch((url) =>
      url.includes(GEMINI_HOST) ? geminiTextResponse(EMPTY_RESPONSE) : imageResponse(),
    );

    await extractEventsFromWeeklyPhotos({ photoUrls: urls, referenceDate: "2026-09-13" });

    expect(calls.filter((c) => !c.url.includes(GEMINI_HOST)).map((c) => c.url)).toEqual(
      photoUrls("weekly-0913", 4),
    );
    expect(geminiRequestBody(geminiCalls(calls)[0]).contents[0].parts).toHaveLength(5);
  });

  it.each<{ label: string; urls: string[]; respond: () => Response }>([
    {
      label: "허용된 URL 이 없음",
      urls: ["https://evil.test/weeklies/weekly-0913/p1.webp"],
      respond: () => imageResponse(),
    },
    {
      label: "모든 사진이 404",
      urls: photoUrls("weekly-0913"),
      respond: () => new Response("not found", { status: 404 }),
    },
    {
      label: "이미지가 아님",
      urls: photoUrls("weekly-0913"),
      respond: () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }),
    },
    {
      label: "용량 초과",
      urls: photoUrls("weekly-0913"),
      respond: () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "content-type": "image/webp", "content-length": String(11 * 1024 * 1024) },
        }),
    },
  ])("사진 $label → photo_fetch (Gemini 호출 없음)", async ({ urls, respond }) => {
    const calls = stubFetch(() => respond());

    const err = await rejectionOf(extractEventsFromWeeklyPhotos({ photoUrls: urls, referenceDate: "2026-09-13" }));

    expect(err).toBeInstanceOf(WeeklyEventSyncError);
    expect(classifyError(err)).toBe("photo_fetch");
    expect(geminiCalls(calls)).toHaveLength(0);
  });

  it("사진 서버 5xx → transient", async () => {
    stubFetch(() => new Response("bad gateway", { status: 502 }));

    const err = await rejectionOf(
      extractEventsFromWeeklyPhotos({ photoUrls: photoUrls("weekly-0913"), referenceDate: "2026-09-13" }),
    );

    expect(err).toBeInstanceOf(WeeklyEventSyncError);
    expect(classifyError(err)).toBe("transient");
  });

  it("사진 프롬프트: 교회소식만·인쇄 발행일 bulletinDate·운영 안내 제외 + 추출 규칙 1~8 공유", () => {
    const prompt = buildWeeklyPhotoPrompt("2026-09-13");
    expect(prompt).toContain('제목이 "교회소식"인 섹션만 읽으세요');
    expect(prompt).toContain("첫 번호 항목의 인덱스가 0");
    expect(prompt).toContain("bulletinDate 로 출력하세요");
    expect(prompt).toContain("식당 봉사");
    expect(prompt).toContain('"bulletinDate": "YYYY-MM-DD or null"');
    expect(prompt).toContain(buildEventExtractionRules());
  });
});

// ──────────────────────────────────────────────
//  요일 계산 (PLAN 1차 수정 — 서버 시간대와 무관)
// ──────────────────────────────────────────────

describe("요일 계산 — 서버 시간대와 무관 (로컬 KST·TZ=UTC 모두 통과)", () => {
  it.each([
    { date: "2026-09-06", expected: "일" },
    { date: "2026-09-19", expected: "토" },
    { date: "2026-04-19", expected: "일" },
  ])("dayOfWeekKo($date) → $expected", ({ date, expected }) => {
    expect(dayOfWeekKo(date)).toBe(expected);
  });

  it("원문 단편에 '(토)' 가 있고 날짜가 실제 토요일이면 adjustConfidenceByDayOfWeek 가 confidence 를 깎지 않는다", () => {
    const saturday = makeCandidate({
      date: "2026-09-19",
      sourceQuote: "청년부 가을 수련회 9/19(토) 오후 2시",
      confidence: 0.9,
    });
    const adjusted = adjustConfidenceByDayOfWeek(saturday);
    expect(adjusted.confidence).toBe(0.9);
    expect(adjusted).toEqual(saturday);

    // 대조: 같은 날짜인데 원문 요일이 어긋나면 기존 규칙대로 0.5 로 낮춘다 (위 결과가 요일 비교를 거쳤음을 확인)
    const mismatch = makeCandidate({
      date: "2026-09-19",
      sourceQuote: "청년부 가을 수련회 9/19(금) 오후 2시",
      confidence: 0.9,
    });
    expect(adjustConfidenceByDayOfWeek(mismatch).confidence).toBe(0.5);
  });
});

// ──────────────────────────────────────────────
//  기존 텍스트 추출 프롬프트 불변
// ──────────────────────────────────────────────

describe("기존 extractEventsFromNews 프롬프트 불변", () => {
  /**
   * 2026-09-14 변경 전 코드를 로컬(KST)에서 실행해 캡처한 머리 부분.
   * 요일은 캡처 값을 그대로 받는다 — 테스트 안에서 계산하면 실행 환경 시간대를 따라 기대값이 바뀐다 (TZ=UTC 에서 "토").
   */
  function headerBefore(anchorDate: string, capturedDayKo: string): string[] {
    return [
      "당신은 한국 개신교 교회 주보의 \"교회소식\" 섹션을 분석해 캘린더 일정으로 옮길 수 있는 항목을 뽑아내는 전문가입니다.",
      "",
      "[기준 정보]",
      `- 주보 발행일: ${anchorDate} (${capturedDayKo}요일)`,
      "- \"오늘\", \"이번 주\", \"주일\", \"다음 주\" 등 상대 표현은 모두 위 발행일 기준으로 해석하세요.",
      "- 시간대는 한국 표준시 (KST). 모든 출력 날짜는 절대 날짜 (YYYY-MM-DD).",
      "",
    ];
  }

  /** 2026-09-14 변경 전 코드로 캡처한 "[추출 규칙]" ~ 끝 */
  const RULES_AND_OUTPUT_BEFORE = [
    "[추출 규칙]",
    "1. 일자(또는 일자 후보)가 본문에 명시된 항목만 일정 후보로 추출.",
    "   - \"5/9(토) 오후 5시\" → date=2026-05-09, startTime=17:00",
    "   - \"오늘 3부예배 직후\" → date=발행일, startTime=null",
    "   - \"매주 화요일\" → 발행일 이후 첫 화요일을 date 로, rruleHint=\"FREQ=WEEKLY;BYDAY=TU\"",
    "2. 일자 정보가 전혀 없는 안내(예: \"교회 인터넷 홈페이지 개편 진행 중\")는 절대 추출 금지 — skipped 에 사유 기록.",
    "3. 한 항목 안에 여러 날짜가 있으면 각각 별개 후보로 분리.",
    "4. 동일 행사의 부속 정보(준비물·문의처)는 description 에 합쳐서 작성.",
    "5. 본문에 없는 정보를 만들어내지 마세요. 모르면 null.",
    "6. confidence:",
    "   - 절대 날짜 + 시간 + 장소 모두 명시 → 0.9 이상",
    "   - 시간 또는 장소 누락 → 0.7",
    "   - 일자 추정만 가능 → 0.5",
    "   - 자신 없음 → 0.3 (그래도 추출은 함, UI 가 경고 표시)",
    "7. sourceNewsIndex 는 [교회소식] 의 0-based 인덱스. 모임 안내·북한선교부 메모에서 뽑은 경우 null.",
    "8. sourceQuote 에는 본문에서 그대로 따온 단편 (50자 이내 권장).",
    "",
    "[출력 형식]",
    "오직 다음 형태의 JSON 객체 하나만 출력. 마크다운 코드펜스 (```) 절대 금지. 설명 문장 절대 금지.",
    "",
    "{",
    "  \"candidates\": [",
    "    {",
    "      \"title\": \"string\",",
    "      \"date\": \"YYYY-MM-DD or null\",",
    "      \"startTime\": \"HH:mm or null\",",
    "      \"endTime\": \"HH:mm or null\",",
    "      \"location\": \"string or null\",",
    "      \"description\": \"string or null\",",
    "      \"sourceNewsIndex\": 0,",
    "      \"sourceQuote\": \"원문 단편\",",
    "      \"confidence\": 0.9,",
    "      \"rruleHint\": null",
    "    }",
    "  ],",
    "  \"skipped\": [",
    "    { \"sourceNewsIndex\": 4, \"reason\": \"구체적 일자 없음\" }",
    "  ]",
    "}",
  ];

  async function captureNewsPrompt(
    input: Parameters<typeof extractEventsFromNews>[0],
  ): Promise<{ prompt: string; url: string }> {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const calls = stubFetch(() => geminiTextResponse('{"candidates":[],"skipped":[]}'));
    await extractEventsFromNews(input);
    expect(calls).toHaveLength(1);
    const [part] = geminiRequestBody(calls[0]).contents[0].parts;
    if (!("text" in part)) throw new Error("첫 파트가 텍스트가 아닙니다.");
    return { prompt: part.text, url: calls[0].url };
  }

  it("교회소식·모임 안내·북한선교부 메모가 있을 때 변경 전과 한 글자도 같다", async () => {
    const { prompt, url } = await captureNewsPrompt({
      anchorDate: "2026-09-06",
      news: [
        {
          title: "청년부 가을 수련회 9/19(토) 오후 2시, 본당",
          items: ["준비물: 성경, 필기구", "회비는 청년부 임원에게 전달"],
        },
        { title: "교회 홈페이지 개편 진행 중", items: [] },
      ],
      meetings: [{ group: "청년부", when: "주일 오후 2시", place: "비전홀" }],
      northKoreaNote: "매월 첫째 주 수요일 기도모임",
    });

    const expected = [
      ...headerBefore("2026-09-06", "일"),
      "[교회소식 원문]",
      "1. 청년부 가을 수련회 9/19(토) 오후 2시, 본당",
      "   - 준비물: 성경, 필기구",
      "   - 회비는 청년부 임원에게 전달",
      "",
      "2. 교회 홈페이지 개편 진행 중",
      "",
      "[모임 안내 원문]",
      "- 청년부: 주일 오후 2시 @ 비전홀",
      "",
      "[북한선교부 메모]",
      "매월 첫째 주 수요일 기도모임",
      "",
      ...RULES_AND_OUTPUT_BEFORE,
    ].join("\n");
    expect(prompt).toBe(expected);
    // 기존 폴백 체인의 첫 모델 그대로
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
  });

  it("교회소식·모임 안내·메모가 모두 비어 있을 때 변경 전과 한 글자도 같다", async () => {
    const { prompt } = await captureNewsPrompt({
      anchorDate: "2026-09-13",
      news: [],
      meetings: [],
      northKoreaNote: "",
    });

    const expected = [
      ...headerBefore("2026-09-13", "일"),
      "[교회소식 원문]",
      "(없음)",
      "",
      "[모임 안내 원문]",
      "(없음)",
      "",
      ...RULES_AND_OUTPUT_BEFORE,
    ].join("\n");
    expect(prompt).toBe(expected);
  });
});

// ──────────────────────────────────────────────
//  라우트
// ──────────────────────────────────────────────

describe("POST /api/admin/cron/weekly-event-sync", () => {
  const ROUTE_URL = "https://app.test/api/admin/cron/weekly-event-sync";

  function cronRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest(ROUTE_URL, { method: "POST", headers });
  }

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  });

  it.each<{ label: string; headers: Record<string, string> }>([
    { label: "시크릿 헤더 없음", headers: {} },
    { label: "틀린 Authorization Bearer", headers: { authorization: "Bearer wrong-secret" } },
    { label: "틀린 x-cron-secret", headers: { "x-cron-secret": "wrong-secret" } },
  ])("$label → 401 (DB·Gemini 요청 없음)", async ({ headers }) => {
    const calls = stubFetch(() => jsonResponse("[]"));

    const res = await POST(cronRequest(headers));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(calls).toHaveLength(0);
  });

  it("서버에 CRON_SECRET 이 없으면 401", async () => {
    vi.stubEnv("CRON_SECRET", "");
    stubFetch(() => jsonResponse("[]"));

    const res = await POST(cronRequest({ authorization: "Bearer " }));

    expect(res.status).toBe(401);
  });

  it.each<{ label: string; headers: Record<string, string> }>([
    { label: "Authorization: Bearer", headers: { authorization: "Bearer test-cron-secret" } },
    { label: "x-cron-secret", headers: { "x-cron-secret": "test-cron-secret" } },
  ])("$label 로 호출하면 200 + WeeklyEventSyncTickResult", async ({ headers }) => {
    // Supabase REST 가 모든 조회·쓰기에 빈 배열로 응답 → 새 주간 실행 없음, 처리할 작업 없음
    const calls = stubFetch(() => jsonResponse("[]"));

    const res = await POST(cronRequest(headers));

    expect(res.status).toBe(200);
    const body = (await res.json()) as WeeklyEventSyncTickResult;
    expect(Object.keys(body).sort()).toEqual(["createdJobs", "createdRunWeek", "now", "processed"]);
    expect(body.now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(body).toEqual({ now: body.now, createdRunWeek: null, createdJobs: 0, processed: [] });
    expect(
      calls.some((c) => c.url.startsWith("https://supabase.test/rest/v1/weekly_event_sync_jobs")),
    ).toBe(true);
    expect(geminiCalls(calls)).toHaveLength(0);
  });
});
