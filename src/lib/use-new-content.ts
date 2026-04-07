"use client";

import { useState, useEffect, useCallback } from "react";
import type { NewContentDates } from "@/app/api/new-content/route";

const STORAGE_PREFIX = "msvch_seen_";

/** 콘텐츠 키 → 관련 경로 매핑 (이 경로 방문 시 해당 키를 "읽음" 처리) */
const PATH_TO_KEYS: [string, string][] = [
  ["/notice", "notices"],
  ["/sermons", "sermons"],
  ["/gallery", "gallery"],
  ["/weekly", "weeklies"],
];

function getLastSeen(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_PREFIX + key);
}

function setLastSeen(key: string, date: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + key, date);
}

function isNewer(latest: string | null, lastSeen: string | null): boolean {
  if (!latest) return false;
  if (!lastSeen) return true;
  return new Date(latest).getTime() > new Date(lastSeen).getTime();
}

export interface NewContentState {
  /** 각 콘텐츠 키별 새 콘텐츠 여부 */
  dots: Record<string, boolean>;
  /** 특정 키를 "읽음" 처리 */
  markSeen: (key: string) => void;
}

export function useNewContent(pathname: string): NewContentState {
  const [dates, setDates] = useState<NewContentDates | null>(null);
  const [seen, setSeen] = useState<Record<string, string | null>>({});

  // 최신 날짜 fetch
  useEffect(() => {
    fetch("/api/new-content")
      .then((res) => res.json())
      .then((data: NewContentDates) => setDates(data))
      .catch(() => {});
  }, []);

  // localStorage에서 마지막 방문 시각 로드
  useEffect(() => {
    const keys = ["notices", "sermons", "gallery", "weeklies"];
    const initial: Record<string, string | null> = {};
    for (const k of keys) {
      initial[k] = getLastSeen(k);
    }
    setSeen(initial);
  }, []);

  // 현재 경로에 해당하는 콘텐츠를 "읽음" 처리
  useEffect(() => {
    if (!dates) return;
    for (const [pathPrefix, key] of PATH_TO_KEYS) {
      if (pathname === pathPrefix || pathname.startsWith(pathPrefix + "/")) {
        const latestDate = dates[key as keyof NewContentDates];
        if (latestDate) {
          setLastSeen(key, latestDate);
          setSeen((prev) => ({ ...prev, [key]: latestDate }));
        }
      }
    }
  }, [pathname, dates]);

  const markSeen = useCallback(
    (key: string) => {
      const latestDate = dates?.[key as keyof NewContentDates];
      if (latestDate) {
        setLastSeen(key, latestDate);
        setSeen((prev) => ({ ...prev, [key]: latestDate }));
      }
    },
    [dates],
  );

  // 각 키별 새 콘텐츠 여부 계산
  const dots: Record<string, boolean> = {
    notices: isNewer(dates?.notices ?? null, seen.notices ?? null),
    sermons: isNewer(dates?.sermons ?? null, seen.sermons ?? null),
    gallery: isNewer(dates?.gallery ?? null, seen.gallery ?? null),
    weeklies: isNewer(dates?.weeklies ?? null, seen.weeklies ?? null),
  };

  return { dots, markSeen };
}
