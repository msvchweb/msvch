"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
 * - 마운트 시 1회 fetch
 * - Supabase auth 이벤트(SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED) 시 자동 재조회
 *   → 같은 페이지에서 로그인/로그아웃해도 헤더가 즉시 갱신됨
 */
export function useMe(): MeResponse {
  const [me, setMe] = useState<MeResponse>(EMPTY);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const r = await fetch("/api/me", { credentials: "same-origin" });
      if (!r.ok) return;
      const data = (await r.json()) as MeResponse;
      setMe(data);
    } catch {
      /* 네트워크 실패 — 기존 값 유지 */
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange 는 구독 시 즉시 INITIAL_SESSION 을 발화시키므로
    // 별도의 초기 fetch 가 필요 없음 — 단일 진입점으로 통일.
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        void refresh();
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  return me;
}

/**
 * 특정 컨텐츠를 현재 사용자가 삭제할 수 있는지.
 *   - admin/master 는 모든 글 삭제 가능
 *   - 그 외 staff 는 본인이 작성한 글만 삭제 가능
 */
export function canDelete(
  me: MeResponse,
  authorId: string | null | undefined,
): boolean {
  if (me.isAdminOrMaster) return true;
  if (!me.userId) return false;
  return authorId === me.userId;
}
