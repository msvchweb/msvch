import { Eye, EyeOff } from "lucide-react";

/**
 * 공개/비공개 토글 칩 버튼.
 *
 * notices/gallery/calendar/boards 등에서 반복되던 둥근 칩 토글 패턴 통일.
 * 점진 도입 (기존 페이지 일괄 교체는 다음 라운드).
 */
export function VisibilityToggle({
  isVisible,
  onClick,
  disabled,
  visibleLabel = "공개",
  hiddenLabel = "비공개",
  size = 12,
  tourId,
}: {
  isVisible: boolean;
  onClick: () => void;
  disabled?: boolean;
  visibleLabel?: string;
  hiddenLabel?: string;
  size?: number;
  /** data-tour 속성 — 어드민 투어에서 위치 지정용. */
  tourId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={tourId}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
        isVisible
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {isVisible ? <Eye size={size} /> : <EyeOff size={size} />}
      {isVisible ? visibleLabel : hiddenLabel}
    </button>
  );
}
