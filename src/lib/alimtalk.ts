/**
 * 알림톡 추상화 — 카카오 비즈 승인 후 환경변수 채우면 동작.
 *
 * 미설정 환경에서는 noop (status='noop' 으로 발송 추적). 에러 throw 없음.
 * 모바일 앱은 이 모듈을 직접 호출하지 않음 — 서버 cron 만 사용.
 *
 * 카카오 비즈 채널 승인 + 알림톡 템플릿 등록 후 다음 환경변수만 채우면 동작:
 *   KAKAO_BIZ_API_KEY
 *   KAKAO_BIZ_SENDER_KEY  (발신 프로필 키)
 *   KAKAO_BIZ_API_URL     (중계사 엔드포인트, 예: NHN Cloud / Aligo / Solapi)
 */

const API_KEY = process.env.KAKAO_BIZ_API_KEY ?? "";
const SENDER_KEY = process.env.KAKAO_BIZ_SENDER_KEY ?? "";
const API_URL = process.env.KAKAO_BIZ_API_URL ?? "";

const ENABLED = Boolean(API_KEY && SENDER_KEY && API_URL);

export type AlimtalkStatus = "sent" | "failed" | "noop";

export interface AlimtalkResult {
  status: AlimtalkStatus;
  error?: string;
}

export interface AlimtalkPayload {
  /** 카카오 비즈 등록 템플릿 코드 */
  template: string;
  /** 010-XXXX-XXXX 형태로 정규화된 수신자 번호 */
  to: string;
  /** 템플릿 변수 — 등록된 템플릿의 #{변수명} 자리표시자 채움 */
  vars: Record<string, string>;
  /** 템플릿 본문 — 미리 변수 치환된 문자열 (검증/대체발송용) */
  body?: string;
}

/**
 * 알림톡 1건 발송. 환경변수 미설정 시 noop 반환.
 *
 * 실 호출은 카카오 비즈 승인 + 중계사 선정 후 구현. v1 은 인터페이스만.
 */
export async function sendAlimtalk(
  payload: AlimtalkPayload,
): Promise<AlimtalkResult> {
  if (!ENABLED) {
    console.warn(
      `[alimtalk] noop — env not set. template=${payload.template} to=${payload.to}`,
    );
    return { status: "noop" };
  }

  // 카카오 비즈 승인 후 중계사별로 본문 구성/엔드포인트 호출 구현.
  // 예시 시그니처 (실 구현 시 중계사 문서 따라 변경):
  //
  // const res = await fetch(API_URL, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${API_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     senderKey: SENDER_KEY,
  //     templateCode: payload.template,
  //     to: payload.to,
  //     content: payload.body,
  //     variables: payload.vars,
  //   }),
  // });
  // if (!res.ok) return { status: "failed", error: `${res.status}` };
  // return { status: "sent" };

  return { status: "failed", error: "not implemented" };
}

/** 일정용 알림톡 본문 빌더 — 카카오 템플릿 등록 전이라도 본문 미리보기 가능 */
export function buildEventNotificationBody(input: {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
}): string {
  const lines = [
    `[명성비전교회] 일정 안내`,
    ``,
    `${input.title}`,
    `${input.dateLabel} ${input.timeLabel}`.trim(),
  ];
  if (input.location) lines.push(`장소: ${input.location}`);
  lines.push("", "교회 캘린더에서 자세히 보기");
  return lines.join("\n");
}
