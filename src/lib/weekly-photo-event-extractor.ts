/**
 * 주보 사진 → "교회소식" 일정 후보 추출 (주간 자동 동기화 전용).
 *
 * 설계: _workspace/01_planner_plan.md (2026-09-14)
 *   - 사진 가져오기: 허용 URL 앞에서부터 최대 4장, 장당 30초, image/*, 10MB 이하
 *   - Gemini: GEMINI_EVENT_SYNC_MODEL (기본 gemini-3.8-flash) 한 모델만, 폴백 없음, 90초
 *   - 파싱: stripCodeFence → JSON.parse → PhotoExtractEventsResponseSchema
 *
 * 기준 날짜 결정·신뢰도 보정·등록 여부 판단은 weekly-event-sync.ts 가 한다.
 * 이 파일이 직접 던지는 오류는 WeeklyEventSyncError(kind) 이고,
 * Gemini 호출 오류(GeminiHttpError/GeminiTimeoutError/네트워크)는 그대로 전파해
 * weekly-event-sync.ts 의 classifyError 가 분류한다.
 */

import { callGeminiSingleModel, type GeminiPart } from "@/lib/gemini";
import {
  buildEventExtractionRules,
  dayOfWeekKo,
  stripCodeFence,
} from "@/lib/news-event-extractor";
import {
  isAllowedWeeklyPhotoUrl,
  MAX_IMAGE_SIZE,
  PhotoExtractEventsResponseSchema,
} from "@/lib/validation";
import type { ExtractedEvent, SkippedItem } from "@/types/event-extraction";
import type { WeeklyEventSyncErrorKind } from "@/types/weekly-event-sync";

export const DEFAULT_EVENT_SYNC_MODEL = "gemini-3.8-flash";
export const MAX_SYNC_PHOTOS = 4;
export const PHOTO_FETCH_TIMEOUT_MS = 30 * 1000;
export const GEMINI_EVENT_SYNC_TIMEOUT_MS = 90 * 1000;

/** 주간 동기화 작업이 분류할 수 있는 오류. kind 가 재시도 방식을 정한다. */
export class WeeklyEventSyncError extends Error {
  readonly kind: WeeklyEventSyncErrorKind;

  constructor(kind: WeeklyEventSyncErrorKind, message: string) {
    super(message);
    this.name = "WeeklyEventSyncError";
    this.kind = kind;
  }
}

export interface WeeklyPhotoInline {
  mimeType: string;
  /** base64 */
  data: string;
}

export interface WeeklyPhotoExtractInput {
  /** weeklies.photo_images */
  photoUrls: string[];
  /** 참고 발행일 (YYYY-MM-DD). 인쇄 발행일을 못 읽었을 때 상대 표현의 기준 */
  referenceDate: string;
}

export interface WeeklyPhotoExtractResult {
  model: string;
  /** 사진에 인쇄된 발행일 (스키마 형식 통과 값). 못 읽었으면 null */
  bulletinDate: string | null;
  candidates: ExtractedEvent[];
  skipped: SkippedItem[];
}

/** 주간 동기화에 쓰는 Gemini 모델 이름 */
export function getEventSyncModel(): string {
  return process.env.GEMINI_EVENT_SYNC_MODEL ?? DEFAULT_EVENT_SYNC_MODEL;
}

type PhotoFetchOutcome =
  | { ok: true; photo: WeeklyPhotoInline }
  | { ok: false; reason: string };

/**
 * 사진 1장 다운로드.
 * - 5xx·타임아웃·네트워크 오류 → WeeklyEventSyncError("transient") (작업 전체를 다시 시도)
 * - 4xx·이미지 아님·용량 초과 → 이 사진만 제외 ({ ok: false })
 */
async function fetchOnePhoto(url: string): Promise<PhotoFetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status >= 500) {
      throw new WeeklyEventSyncError(
        "transient",
        `주보 사진 서버 오류: HTTP ${res.status}`,
      );
    }
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }

    const mimeType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return {
        ok: false,
        reason: `이미지가 아님 (${mimeType || "content-type 없음"})`,
      };
    }

    const declaredSize = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_SIZE) {
      return { ok: false, reason: "용량 초과" };
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return { ok: false, reason: "용량 초과" };
    }

    return {
      ok: true,
      photo: { mimeType, data: Buffer.from(buffer).toString("base64") },
    };
  } catch (err) {
    if (err instanceof WeeklyEventSyncError) throw err;
    if (controller.signal.aborted) {
      throw new WeeklyEventSyncError(
        "transient",
        `주보 사진 다운로드 시간 초과 (${PHOTO_FETCH_TIMEOUT_MS / 1000}초)`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new WeeklyEventSyncError(
      "transient",
      `주보 사진 다운로드 실패: ${message}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * photo_images 앞에서부터 허용 목록을 통과한 URL 최대 4장을 내려받는다.
 * 통과한 사진이 0장이면 WeeklyEventSyncError("photo_fetch").
 */
export async function fetchWeeklyPhotos(
  photoUrls: string[],
): Promise<WeeklyPhotoInline[]> {
  const allowed = photoUrls
    .filter((url) => isAllowedWeeklyPhotoUrl(url))
    .slice(0, MAX_SYNC_PHOTOS);
  if (allowed.length === 0) {
    throw new WeeklyEventSyncError(
      "photo_fetch",
      "허용된 주보 사진 URL 이 없습니다.",
    );
  }

  const outcomes = await Promise.all(allowed.map((url) => fetchOnePhoto(url)));
  const photos: WeeklyPhotoInline[] = [];
  const rejected: string[] = [];
  outcomes.forEach((outcome, i) => {
    if (outcome.ok) photos.push(outcome.photo);
    else rejected.push(`${i + 1}번째 사진 ${outcome.reason}`);
  });

  if (photos.length === 0) {
    throw new WeeklyEventSyncError(
      "photo_fetch",
      `사용할 수 있는 주보 사진이 없습니다. (${rejected.join(", ")})`,
    );
  }
  return photos;
}

/** 주보 사진용 프롬프트. 추출 규칙 1~8 은 텍스트 추출과 같은 블록을 쓴다. */
export function buildWeeklyPhotoPrompt(referenceDate: string): string {
  const dow = dayOfWeekKo(referenceDate);
  return `당신은 한국 개신교 교회 주보의 "교회소식" 섹션을 분석해 캘린더 일정으로 옮길 수 있는 항목을 뽑아내는 전문가입니다.

[기준 정보]
- 참고 발행일: ${referenceDate} (${dow}요일)
- 사진에 인쇄된 주보 발행일(예: "2026년 9월 6일")을 먼저 읽어 bulletinDate 로 출력하세요. "오늘", "이번 주", "주일", "다음 주" 등 상대 표현은 모두 그 인쇄 발행일 기준으로 해석하세요.
- 인쇄 발행일을 읽을 수 없으면 bulletinDate 는 null 로 두고, 상대 표현은 참고 발행일 기준으로 해석하세요.
- 아래 [추출 규칙] 의 "발행일"은 위에서 정한 기준 날짜(인쇄 발행일, 읽을 수 없으면 참고 발행일)입니다.
- 시간대는 한국 표준시 (KST). 모든 출력 날짜는 절대 날짜 (YYYY-MM-DD).

[입력]
첨부한 주보 사진에서 제목이 "교회소식"인 섹션만 읽으세요. 예배 순서, 예배모임 안내, 기도제목, 헌금 명단 등 다른 섹션은 무시하세요.
교회소식의 번호 항목(1. 2. 3. …)과 ※ 항목이 [교회소식] 목록이며, 첫 번호 항목의 인덱스가 0입니다.
봉사 당번·담당 배정(예: "이번 주 식당 봉사 ○목장")과 출석 스티커 부착 같은 운영 안내는 일정으로 뽑지 말고 skipped 에 기록하세요.

${buildEventExtractionRules()}

[출력 형식]
오직 다음 형태의 JSON 객체 하나만 출력. 마크다운 코드펜스 (\`\`\`) 절대 금지. 설명 문장 절대 금지.

{
  "bulletinDate": "YYYY-MM-DD or null",
  "candidates": [
    {
      "title": "string",
      "date": "YYYY-MM-DD or null",
      "startTime": "HH:mm or null",
      "endTime": "HH:mm or null",
      "location": "string or null",
      "description": "string or null",
      "sourceNewsIndex": 0,
      "sourceQuote": "원문 단편",
      "confidence": 0.9,
      "rruleHint": null
    }
  ],
  "skipped": [
    { "sourceNewsIndex": 4, "reason": "구체적 일자 없음" }
  ]
}`;
}

/**
 * Gemini 응답 텍스트 → 검증된 결과.
 * 빈 응답·JSON 아님·스키마 불일치 → WeeklyEventSyncError("invalid_response").
 */
export function parseWeeklyPhotoResponse(
  raw: string,
): Omit<WeeklyPhotoExtractResult, "model"> {
  const cleaned = stripCodeFence(raw);
  if (!cleaned) {
    throw new WeeklyEventSyncError(
      "invalid_response",
      "Gemini 응답에 텍스트가 없습니다.",
    );
  }

  // JSON.parse → Zod 까지 inline 으로 처리해 unknown/any 변수 선언 회피
  const validated = (() => {
    try {
      return PhotoExtractEventsResponseSchema.safeParse(JSON.parse(cleaned));
    } catch {
      throw new WeeklyEventSyncError(
        "invalid_response",
        "Gemini 응답이 JSON 형식이 아닙니다.",
      );
    }
  })();

  if (!validated.success) {
    const issue = validated.error.issues[0];
    const detail = issue
      ? `${issue.path.map(String).join(".")} ${issue.message}`
      : "스키마 불일치";
    throw new WeeklyEventSyncError(
      "invalid_response",
      `Gemini 응답 형식이 올바르지 않습니다: ${detail}`,
    );
  }

  return {
    bulletinDate: validated.data.bulletinDate,
    candidates: validated.data.candidates,
    skipped: validated.data.skipped,
  };
}

/**
 * 주보 사진을 Gemini 한 모델에 보내 일정 후보를 뽑는다.
 *
 * @throws WeeklyEventSyncError  config(키 없음) / photo_fetch / transient(사진 서버) / invalid_response
 * @throws GeminiHttpError       Gemini HTTP 오류 (classifyError 가 상태 코드로 분류)
 * @throws GeminiTimeoutError    Gemini 90초 초과
 * @throws TypeError             네트워크 오류
 */
export async function extractEventsFromWeeklyPhotos(
  input: WeeklyPhotoExtractInput,
): Promise<WeeklyPhotoExtractResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new WeeklyEventSyncError(
      "config",
      "GEMINI_API_KEY가 설정되지 않았습니다.",
    );
  }

  const model = getEventSyncModel();
  const photos = await fetchWeeklyPhotos(input.photoUrls);
  const parts: GeminiPart[] = [
    { text: buildWeeklyPhotoPrompt(input.referenceDate) },
    ...photos.map((photo) => ({
      inlineData: { mimeType: photo.mimeType, data: photo.data },
    })),
  ];

  const raw = await callGeminiSingleModel({
    model,
    parts,
    timeoutMs: GEMINI_EVENT_SYNC_TIMEOUT_MS,
    responseMimeType: "application/json",
  });

  return { model, ...parseWeeklyPhotoResponse(raw) };
}
