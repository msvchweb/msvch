/**
 * 일정 알림 수신자 (event_subscribers) — admin 관리 전용 DTO.
 * 모바일 앱은 별도 화면 없음 (v1).
 */
export interface EventSubscriber {
  id: string;
  name: string;
  /** 010-XXXX-XXXX (정규화된 표시 형태) */
  phone: string;
  isActive: boolean;
  notifyD1: boolean;
  notifyDDay: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventSubscriberInput {
  name: string;
  /** 정규화 전 입력. 서버에서 010-XXXX-XXXX 형태로 정규화 */
  phone: string;
  isActive?: boolean;
  notifyD1?: boolean;
  notifyDDay?: boolean;
  note?: string;
}

/** 알림톡 발송 추적 row */
export interface AlimtalkSentRow {
  id: string;
  template: string;
  eventId: string | null;
  recipient: string;
  sentAt: string;
  status: "sent" | "failed" | "noop";
  error: string | null;
}
