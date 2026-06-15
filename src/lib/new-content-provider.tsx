"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";
import type { NewContentDates, ContentKey } from "@/app/api/new-content/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "msvch_seen_";
const ALL_KEYS: ContentKey[] = ["notices", "sermons", "gallery", "weeklies"];

/** 이 경로 방문 시 해당 콘텐츠 키를 "읽음" 처리 */
const PATH_TO_KEYS: [string, ContentKey][] = [
  ["/notice", "notices"],
  ["/sermons", "sermons"],
  ["/gallery", "gallery"],
  ["/weekly", "weeklies"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLastSeen(key: ContentKey): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function persistLastSeen(key: ContentKey, date: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, date);
  } catch {
    // private browsing 등에서 실패 가능
  }
}

function isNewer(latest: string | null, lastSeen: string | null): boolean {
  if (!latest) return false;
  if (!lastSeen) return true;
  return new Date(latest).getTime() > new Date(lastSeen).getTime();
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface NewContentContextValue {
  dots: Record<ContentKey, boolean>;
  markSeen: (key: ContentKey) => void;
}

const EMPTY_DOTS: Record<ContentKey, boolean> = {
  notices: false,
  sermons: false,
  gallery: false,
  weeklies: false,
};

const NewContentContext = createContext<NewContentContextValue>({
  dots: EMPTY_DOTS,
  markSeen: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NewContentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [dates, setDates] = useState<NewContentDates | null>(null);
  const [seen, setSeen] = useState<Record<ContentKey, string | null>>({
    notices: null,
    sermons: null,
    gallery: null,
    weeklies: null,
  });

  // 1) 하이드레이션 완료 후 localStorage 로드
  useEffect(() => {
    const initial = {} as Record<ContentKey, string | null>;
    for (const k of ALL_KEYS) {
      initial[k] = getLastSeen(k);
    }
    requestAnimationFrame(() => {
      setSeen(initial);
      setHydrated(true);
    });
  }, []);

  // 2) API fetch — 한 번만, AbortController로 정리
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/new-content", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: NewContentDates) => {
        requestAnimationFrame(() => setDates(data));
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // 3) 현재 경로에 해당하는 콘텐츠를 "읽음" 처리
  useEffect(() => {
    if (!dates) return;
    for (const [pathPrefix, key] of PATH_TO_KEYS) {
      if (pathname === pathPrefix || pathname.startsWith(pathPrefix + "/")) {
        const latestDate = dates[key];
        if (latestDate) {
          persistLastSeen(key, latestDate);
          requestAnimationFrame(() => {
            setSeen((prev) => ({ ...prev, [key]: latestDate }));
          });
        }
      }
    }
  }, [pathname, dates]);

  const markSeen = useCallback(
    (key: ContentKey) => {
      const latestDate = dates?.[key];
      if (latestDate) {
        persistLastSeen(key, latestDate);
        setSeen((prev) => ({ ...prev, [key]: latestDate }));
      }
    },
    [dates],
  );

  // 하이드레이션 전에는 빈 dots 반환 (서버/클라이언트 불일치 방지)
  const dots = useMemo<Record<ContentKey, boolean>>(() => {
    if (!hydrated) return EMPTY_DOTS;
    return {
      notices: isNewer(dates?.notices ?? null, seen.notices),
      sermons: isNewer(dates?.sermons ?? null, seen.sermons),
      gallery: isNewer(dates?.gallery ?? null, seen.gallery),
      weeklies: isNewer(dates?.weeklies ?? null, seen.weeklies),
    };
  }, [hydrated, dates, seen]);

  const value = useMemo(() => ({ dots, markSeen }), [dots, markSeen]);

  return (
    <NewContentContext value={value}>
      {children}
    </NewContentContext>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNewContent(): NewContentContextValue {
  return useContext(NewContentContext);
}
