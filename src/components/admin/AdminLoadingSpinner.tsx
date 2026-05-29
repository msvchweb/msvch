import { Loader2 } from "lucide-react";

/**
 * 어드민 페이지 공통 로딩 상태 표시.
 *
 * 9개 admin CRUD 페이지에서 동일한 로딩 JSX 가 반복되던 패턴을 통일하기 위한 헬퍼.
 * 점진 도입 (기존 페이지 일괄 교체는 다음 라운드).
 */
export function AdminLoadingSpinner({
  label = "로딩 중...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "flex h-64 items-center justify-center text-gray-400"
      }
    >
      <Loader2 size={20} className="mr-2 animate-spin" />
      {label}
    </div>
  );
}
