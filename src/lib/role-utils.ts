/**
 * 역할 분기 단일 유틸 — 서버/클라이언트 양쪽에서 import 가능 (순수 함수만).
 *
 * `src/lib/admin-auth.ts` 는 Next.js 서버 컨텍스트에 의존하므로 라우트 외부에서 못 쓴다.
 * 본 모듈은 role 문자열만으로 판정한다.
 */

export type Role = "member" | "staff" | "admin" | "master";

/** role 이 admin 또는 master 인가 (UPDATE/INSERT 대상 권한) */
export function hasAdminAccess(
  role: string | null | undefined,
): role is "admin" | "master" {
  return role === "admin" || role === "master";
}

/** role 이 staff/admin/master 중 하나인가 (관리자 UI 접근 권한) */
export function hasStaffAccess(
  role: string | null | undefined,
): role is "staff" | "admin" | "master" {
  return role === "staff" || role === "admin" || role === "master";
}

/** role 이 master 인가 (회원 권한 변경 등 단독 권한) */
export function hasMasterAccess(
  role: string | null | undefined,
): role is "master" {
  return role === "master";
}
