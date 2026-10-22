import "server-only";
import { AI_COURSE_PRIVACY_POLICY_VERSION } from "@/lib/ai-course";

export type AiCoursePrivacyPolicy = { version: string; text: string };

// Retention confirmed by the course operator on 2026-10-22.
export function getAiCoursePrivacyPolicy(): AiCoursePrivacyPolicy {
  return {
    version: AI_COURSE_PRIVACY_POLICY_VERSION,
    text: [
      "수집·이용 주체: 명성비전교회",
      "목적: 강의 신청 접수, 강의 관련 연락, 기기 준비 및 수업 난이도 조정",
      "수집 항목: 이름, 휴대전화 번호, 활용 분야, 기기 준비 및 운영체제, AI 사용 경험·능력·수강 목표, 반복 업무, 선택 입력한 도움 요청과 기타 설명, 동의 시각",
      "보관 기간: 강의 종료 후 3개월까지. 보관 기간이 끝나면 신청 정보와 설문 응답을 삭제합니다.",
      "동의를 거부할 수 있으며, 거부하면 이 신청서로 강의를 신청할 수 없습니다.",
      "문의: 명성비전교회 02-534-0691 / msvch01@naver.com",
    ].join("\n"),
  };
}
