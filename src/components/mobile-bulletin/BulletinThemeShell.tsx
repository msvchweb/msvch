"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

const STORAGE_KEY = "msvch_theme";

export type BulletinTheme = "light" | "dark";

interface BulletinThemeValue {
  theme: BulletinTheme;
  toggle: () => void;
}

const BulletinThemeContext = createContext<BulletinThemeValue | null>(null);

export function useBulletinTheme(): BulletinThemeValue {
  const value = useContext(BulletinThemeContext);
  if (!value) {
    throw new Error("useBulletinTheme must be used inside BulletinThemeShell");
  }
  return value;
}

// ── localStorage 를 외부 스토어로 구독한다 (같은 탭의 토글 + 다른 탭의 storage 이벤트) ──
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): BulletinTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** 서버 마크업은 항상 light. 하이드레이션 후 저장값으로 다시 그려진다. */
function getServerSnapshot(): BulletinTheme {
  return "light";
}

function writeTheme(next: BulletinTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 저장 실패는 화면 동작에 영향을 주지 않는다.
  }
  for (const listener of listeners) listener();
}

/**
 * 모바일 주보 전용 표면색 경계. 서버 컴포넌트 섹션을 children 으로 받아
 * data-bulletin-theme 아래에 두고, CSS 변수(--bt-*)로 라이트·다크를 전환한다.
 * 전역 Header/Footer 는 이 경계 밖이라 영향을 받지 않는다.
 */
export function BulletinThemeShell({
  children,
  snap = false,
}: {
  children: React.ReactNode;
  /** 문서 스크롤러에 세로 섹션 스냅을 켠다. 공개 주보 페이지에서만 사용. */
  snap?: boolean;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    writeTheme(getSnapshot() === "light" ? "dark" : "light");
  }, []);

  return (
    <BulletinThemeContext.Provider value={{ theme, toggle }}>
      <div
        data-bulletin-theme={theme}
        data-bulletin-snap={snap ? "" : undefined}
        className="bg-[var(--bt-shell)] transition-colors duration-300 motion-reduce:transition-none"
      >
        {children}
      </div>
    </BulletinThemeContext.Provider>
  );
}
