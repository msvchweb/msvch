"use client";

import { useCallback, useState } from "react";

/**
 * 어드민 페이지에서 반복되는 "confirm → DELETE → reload" 패턴 훅.
 *
 * 9개 admin 페이지의 삭제 핸들러가 거의 같은 코드를 갖고 있어 통일.
 * 점진 도입 (기존 페이지 일괄 교체는 다음 라운드).
 *
 * 사용 예:
 *   const { remove, deleting } = useDeleteWithConfirm({
 *     buildUrl: (id) => `/api/admin/notices/${id}`,
 *     confirmMessage: "이 공지를 삭제할까요?",
 *     onSuccess: reload,
 *   });
 *   <button onClick={() => remove(notice.id)} disabled={deleting === notice.id}>삭제</button>
 */
export interface UseDeleteWithConfirmOptions {
  /** 삭제 대상 URL 빌더. */
  buildUrl: (id: string) => string;
  /** confirm 다이얼로그에 표시할 메시지. */
  confirmMessage: string;
  /** 삭제 성공 후 호출 (보통 목록 reload). */
  onSuccess?: (id: string) => void | Promise<void>;
  /** 삭제 실패 메시지 — 기본 "삭제에 실패했습니다." */
  errorMessage?: string;
}

export interface UseDeleteWithConfirmResult {
  /** 삭제 트리거. confirm 거절 시 즉시 false 반환, 성공 시 true. */
  remove: (id: string) => Promise<boolean>;
  /** 현재 삭제 중인 id (없으면 null). UI 의 disabled / 스피너 분기에 사용. */
  deleting: string | null;
}

export function useDeleteWithConfirm(
  options: UseDeleteWithConfirmOptions,
): UseDeleteWithConfirmResult {
  const {
    buildUrl,
    confirmMessage,
    onSuccess,
    errorMessage = "삭제에 실패했습니다.",
  } = options;

  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!confirm(confirmMessage)) return false;
      setDeleting(id);
      try {
        const res = await fetch(buildUrl(id), { method: "DELETE" });
        if (!res.ok) {
          alert(errorMessage);
          return false;
        }
        if (onSuccess) await onSuccess(id);
        return true;
      } catch {
        alert(errorMessage);
        return false;
      } finally {
        setDeleting(null);
      }
    },
    [buildUrl, confirmMessage, onSuccess, errorMessage],
  );

  return { remove, deleting };
}
