import type { CalendarEvent } from "./calendar";

/**
 * 주보 "교회소식" AI 추출 — 플랫폼 공용 DTO.
 *
 * 설계: camelCase, 안정적 형태. 모바일 앱이 동일 응답을 그대로 사용 가능.
 */

export interface ExtractedEvent {
  /** 일정 제목 (1~200자) */
  title: string;
  /**
   * YYYY-MM-DD. AI 가 본문 표현을 절대 날짜로 변환한 결과.
   * null = 본문에 명시 없음 → staff 가 직접 채워야 INSERT 가능.
   */
  date: string | null;
  /** HH:mm. null = 종일 또는 시간 미정 */
  startTime: string | null;
  /** HH:mm. null = 미정/오픈엔드 */
  endTime: string | null;
  location: string | null;
  description: string | null;
  /** weeklies.news[] 의 어느 항목에서 뽑혔는지 (0-based). null = 모임 안내 등 외부 소스 */
  sourceNewsIndex: number | null;
  /** 원문 단편 — UI 가 staff 검수용으로 표시. AI 환각 견제 */
  sourceQuote: string | null;
  /**
   * 0~1. 모델의 자기평가 신뢰도 + 후처리(요일 검증) 보정.
   * 0.6 미만은 UI 가 amber 경고 + 체크박스 자동 OFF.
   */
  confidence: number;
  /** 반복 일정 표현이면 RRULE 후보 — v1 은 표시만, INSERT 시 무시 */
  rruleHint: string | null;
}

export interface SkippedItem {
  sourceNewsIndex: number;
  reason: string;
}

export interface ExtractEventsResponse {
  weeklyId: string;
  /** 앵커 날짜 (weekly.date). 모든 상대 표현의 기준 — UI 표시용 */
  anchorDate: string;
  candidates: ExtractedEvent[];
  /** 일자 정보가 없어 추출하지 않은 항목 — 참고용. UI 가 디버그 모드일 때만 표시 */
  skipped: SkippedItem[];
}

export interface BatchSkipped {
  /** 클라이언트가 보낸 인덱스 (0-based) */
  index: number;
  reason: string;
}

/** POST /api/admin/calendar/batch 응답 — 일괄 INSERT 결과 */
export interface BatchInsertResult {
  /** 성공한 일정 (응답 DTO — 캘린더 페이지가 즉시 반영 가능) */
  inserted: CalendarEvent[];
  /** RLS 거부 / 검증 실패 등으로 스킵된 항목 — 사유 동봉 */
  skipped: BatchSkipped[];
}
