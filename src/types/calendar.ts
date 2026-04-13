/** Google Calendar 이벤트를 앱 내부 타입으로 변환한 결과 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  /** ISO 8601 (시간 지정) 또는 YYYY-MM-DD (종일) */
  start: string;
  /** ISO 8601 (시간 지정) 또는 YYYY-MM-DD (종일) */
  end: string;
  isAllDay: boolean;
  /** Google Calendar에서 보기 링크 */
  htmlLink: string;
}

/** 이벤트 생성 요청 */
export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (없으면 종일)
  endTime?: string; // HH:mm (없으면 종일)
}
