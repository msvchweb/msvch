"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 워터마크 표시 텍스트 */
  watermark?: string;
  /** 키보드 단축키 차단 (F12, Ctrl+Shift+I/J/C, Ctrl+U/S/P/C). 기본 true */
  blockShortcuts?: boolean;
}

/**
 * 공개 주보 웹뷰용 보호 래퍼.
 *
 * 차단(완전):
 *   - 우클릭 (contextmenu)
 *   - 드래그 (dragstart, draggable=false)
 *   - 텍스트 선택 (user-select: none + -webkit-touch-callout)
 *   - 복사 (onCopy / Ctrl+C·Cmd+C)
 *   - 키보드 단축키 (F12, Ctrl+Shift+I/J/C, Ctrl+U/S/P/C, Cmd+S/P/C/U, Cmd+Option+I/C)
 *
 * 마찰만 (우회 가능):
 *   - 캡쳐 — 웹에서 OS 스크린샷 차단 API 없음. 워터마크로 유출 억제만.
 *   - 개발자도구 메뉴 진입 — 단축키만 차단, 브라우저 메뉴는 못 막음.
 *
 * 모바일 앱(RN) 주의:
 *   이 컴포넌트는 웹 전용(`document`/`WebkitTouchCallout` 의존). RN 에서는
 *   FLAG_SECURE(Android) / isCaptured(iOS) 등 네이티브 모듈로 별도 처리.
 */
export function ProtectedView({
  children,
  watermark = "명성비전교회 주보 · 무단복제 금지",
  blockShortcuts = true,
}: Props) {
  useEffect(() => {
    if (!blockShortcuts) return;
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      // Windows/Linux: Ctrl 조합
      if (e.ctrlKey) {
        // Ctrl+Shift+I / J / C (DevTools)
        if (e.shiftKey && (k === "i" || k === "j" || k === "c")) {
          e.preventDefault();
          return;
        }
        // Ctrl+U (페이지 소스), Ctrl+S (저장), Ctrl+P (인쇄), Ctrl+C (복사)
        if (k === "u" || k === "s" || k === "p" || k === "c") {
          e.preventDefault();
          return;
        }
      }
      // macOS: Cmd 조합
      if (e.metaKey) {
        if (k === "s" || k === "p" || k === "c" || k === "u") {
          e.preventDefault();
          return;
        }
        // Cmd+Option+I / C (DevTools)
        if (e.altKey && (k === "i" || k === "c")) {
          e.preventDefault();
          return;
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [blockShortcuts]);

  // 인라인 스타일에 비표준 키(WebkitTouchCallout, WebkitUserDrag)를 안전하게 포함하기 위한 캐스트.
  // any 금지 룰에 따라 CSSProperties 의 인덱스 시그니처 확장으로 처리.
  const protectionStyle: CSSProperties & Record<string, string> = {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    WebkitUserDrag: "none",
  };

  return (
    <div
      className="relative"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      style={protectionStyle}
    >
      {children}

      {/* 워터마크 — 사선 줄무늬 (CSS only, pointer-events: none 로 인터랙션 영향 0) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-30deg, rgba(0,0,0,0) 0 60px, rgba(0,0,0,0.04) 60px 61px)",
        }}
      />

      {/* 워터마크 — 중앙 회전 텍스트 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          style={{
            transform: "rotate(-30deg)",
            color: "rgba(0,0,0,0.06)",
            fontSize: "clamp(18px, 3vw, 32px)",
            fontWeight: 700,
            whiteSpace: "nowrap",
            letterSpacing: "0.05em",
          }}
        >
          {watermark}
        </span>
      </div>
    </div>
  );
}
