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
  /**
   * 절기 가상 이벤트일 때만 채워짐(예: 부활주일·성탄절·종교개혁주일).
   * `liturgical: undefined` 이면 일반 사용자 이벤트.
   *
   * 추가형 필드 — 기존 모바일/웹 클라이언트가 안 봐도 동작 무변화.
   * 모바일 호환 보증: 필드 삭제·이름·타입 변경 금지.
   */
  liturgical?: {
    season:
      | "advent"
      | "christmas"
      | "epiphany"
      | "ordinary_after_epiphany"
      | "lent"
      | "holy_week"
      | "good_friday"
      | "easter"
      | "pentecost"
      | "trinity"
      | "ordinary_after_pentecost"
      | "reformation";
    /** HEX #RRGGBB — 배경용 (soft tone) */
    colorSoft: string;
    /** HEX #RRGGBB — 텍스트용 (strong tone) */
    colorStrong: string;
  };
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
