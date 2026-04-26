"use client";

import { useEffect, useState } from "react";
import type { MeResponse } from "@/app/api/me/route";

const EMPTY: MeResponse = {
  authenticated: false,
  userId: null,
  role: null,
  isStaff: false,
  isAdminOrMaster: false,
};

/**
 * 클라이언트 컴포넌트에서 현재 로그인 사용자 권한을 가져온다.
 * 페이지 첫 렌더 직후 한 번 fetch — 결과는 컴포넌트 마운트 동안 유지.
 */
export function useMe(): MeResponse {
  const [me, setMe] = useState<MeResponse>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then((data) => {
        if (!cancelled && data) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}

/**
 * 특정 컨텐츠를 현재 사용자가 삭제할 수 있는지.
 *   - admin/master 는 모든 글 삭제 가능
 *   - 그 외 staff 는 본인이 작성한 글만 삭제 가능
 */
export function canDelete(me: MeResponse, authorId: string | null | undefined): boolean {
  if (me.isAdminOrMaster) return true;
  if (!me.userId) return false;
  return authorId === me.userId;
}
