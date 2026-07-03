/**
 * 관리자 경로별 최소 권한 매트릭스.
 *
 * 단일 진실의 원천 — 미들웨어, 레이아웃(사이드바/하단탭), 메뉴 페이지,
 * 대시보드 카드가 모두 이 모듈만 참조한다. UI에 누락이 있어도 미들웨어가
 * 서버측에서 차단하므로 권한 우회는 불가능.
 */

export type MinRole = "staff" | "admin" | "master";

const ROLE_RANK: Record<MinRole, number> = {
  staff: 1,
  admin: 2,
  master: 3,
};

/** role 이 최소 등급 이상인지. role=null/member 면 false. */
export function meetsMinRole(
  role: string | null | undefined,
  min: MinRole,
): boolean {
  if (role === "staff" || role === "admin" || role === "master") {
    return ROLE_RANK[role] >= ROLE_RANK[min];
  }
  return false;
}

interface RoutePermission {
  prefix: string;
  minRole: MinRole;
}

/**
 * 경로 prefix → 필요한 최소 권한.
 * 매칭 시 가장 긴 prefix 가 우선한다.
 * 명시되지 않은 /admin 하위 경로(대시보드, 메뉴, 가이드, 업데이트)는 staff 통과.
 */
export const ADMIN_ROUTE_PERMISSIONS: ReadonlyArray<RoutePermission> = [
  // admin 이상
  { prefix: "/admin/notices", minRole: "admin" },
  { prefix: "/admin/weeklies", minRole: "admin" },
  { prefix: "/admin/masters", minRole: "admin" },
  { prefix: "/admin/calendar", minRole: "admin" },
  { prefix: "/admin/event-subscribers", minRole: "admin" },
  { prefix: "/admin/inquiries", minRole: "admin" },
  { prefix: "/admin/new-families", minRole: "admin" },
  { prefix: "/admin/myeongbi-prayers", minRole: "admin" },
  { prefix: "/admin/sermons", minRole: "admin" },
  { prefix: "/admin/shorts", minRole: "admin" },
  // staff 이상
  { prefix: "/admin/gallery", minRole: "staff" },
  { prefix: "/admin/boards", minRole: "staff" },
  { prefix: "/admin/posters", minRole: "staff" },
  { prefix: "/admin/posters/logs", minRole: "master" },
  // master 단독
  { prefix: "/admin/members", minRole: "master" },
];

/** 경로에 매칭되는 최소 권한. 매칭 없으면 null(공통 영역 — staff 통과). */
export function getMinRoleForPath(path: string): MinRole | null {
  let best: RoutePermission | null = null;
  for (const rule of ADMIN_ROUTE_PERMISSIONS) {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      if (!best || rule.prefix.length > best.prefix.length) {
        best = rule;
      }
    }
  }
  return best?.minRole ?? null;
}

/** role 이 해당 admin 경로에 접근 가능한지. 명시 규칙 없으면 staff 이상이면 통과. */
export function canAccessAdminPath(
  role: string | null | undefined,
  path: string,
): boolean {
  const min = getMinRoleForPath(path);
  if (!min) {
    return (
      role === "staff" || role === "admin" || role === "master"
    );
  }
  return meetsMinRole(role, min);
}
