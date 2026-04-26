/**
 * 캘린더 이벤트 — 플랫폼 공용 DTO.
 * 웹/모바일 동일 스펙. 이 형태가 안정이면 데이터 소스(자체 DB / 외부)와 무관하게 클라이언트 무수정.
 *
 * 마이그레이션 022 이후 자체 DB(`events` 테이블) 가 단일 소스.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  /** ISO 8601 datetime (시간 지정) 또는 YYYY-MM-DD (종일) */
  start: string;
  /**
   * ISO 8601 datetime 또는 YYYY-MM-DD 또는 null.
   * - null = 종료 시간 미정/오픈엔드 ("저녁 6시부터" 같은 케이스)
   * - 종일 일정의 경우 단일 날짜이므로 null
   */
  end: string | null;
  isAllDay: boolean;
  /** RFC 5545 RRULE — v2 예정, v1 은 항상 null */
  recurrence: string | null;
  /** 알림톡 발송 대상 일정 여부 (관리 UI 표시용) */
  notify: boolean;
}

/** 이벤트 생성/수정 요청 — 단일 날짜 v1 */
export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD (필수) */
  date: string;
  /** HH:mm — 미지정 = 종일 */
  startTime?: string;
  /** HH:mm — 미지정 = 미정/오픈엔드 */
  endTime?: string;
  /** 알림톡 발송 대상으로 표시할지 */
  notify?: boolean;
}
