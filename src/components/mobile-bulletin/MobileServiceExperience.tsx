"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  extractYouTubeVideoId,
  isServiceLive,
  selectMobileServiceId,
} from "@/lib/mobile-bulletin";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";
import { WorshipResourceSheet } from "./WorshipResourceSheet";

type MobileServiceExperienceProps = {
  title: string;
  date: string;
  liturgyLabel: string;
  services: MobileService[];
  resourcesById: Record<string, WorshipResource>;
  validVideoIds: string[];
  initialNowIso: string;
};

function safeExternalUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function MobileServiceExperience({
  title,
  date,
  liturgyLabel,
  services,
  resourcesById,
  validVideoIds,
  initialNowIso,
}: MobileServiceExperienceProps) {
  const visibleServices = useMemo(
    () => services.filter((service) => service.visible),
    [services],
  );
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const [selectedId, setSelectedId] = useState(() =>
    selectMobileServiceId(visibleServices, new Date(initialNowIso)),
  );
  const manualSelectionRef = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const idPrefix = useId().replaceAll(":", "");

  useEffect(() => {
    function refresh() {
      const current = new Date();
      setNow(current);
      if (!manualSelectionRef.current) {
        setSelectedId(selectMobileServiceId(visibleServices, current));
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [visibleServices]);

  const selectedService =
    visibleServices.find((service) => service.id === selectedId) ??
    visibleServices[0] ??
    null;

  function selectService(serviceId: string) {
    manualSelectionRef.current = true;
    setSelectedId(serviceId);
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % visibleServices.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + visibleServices.length) % visibleServices.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = visibleServices.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectService(visibleServices[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  const selectedIndex = selectedService
    ? visibleServices.findIndex((service) => service.id === selectedService.id)
    : -1;
  const panelId =
    selectedIndex >= 0 ? `${idPrefix}-service-panel-${selectedIndex}` : undefined;
  const liveVideoId = selectedService
    ? extractYouTubeVideoId(selectedService.liveUrl)
    : null;
  const serviceIsLive = Boolean(
    selectedService && liveVideoId && isServiceLive(selectedService, now),
  );
  const playableVideoId = selectedService
    ? serviceIsLive
      ? liveVideoId
      : selectedService.videoId && validVideoIds.includes(selectedService.videoId)
        ? selectedService.videoId
        : null
    : null;

  return (
    <article className="mx-auto w-full max-w-3xl overflow-x-hidden bg-church-cream text-stone-800">
      <header className="border-b border-stone-200 bg-white px-5 py-8 sm:px-8">
        <p className="text-sm font-semibold text-liturgy-brand">{liturgyLabel}</p>
        <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-stone-950">
          {title}
        </h1>
        <time dateTime={date} className="mt-3 block text-sm text-stone-600">
          {date}
        </time>
      </header>

      {visibleServices.length === 0 || !selectedService ? (
        <section className="px-5 py-16 text-center sm:px-8">
          <h2 className="text-xl font-bold text-stone-900">모바일 주보 준비 중</h2>
          <p className="mt-3 text-base text-stone-600">
            예배 순서를 준비하고 있습니다.
          </p>
        </section>
      ) : (
        <>
          <div className="border-b border-stone-200 bg-white px-4 sm:px-8">
            <div
              role="tablist"
              aria-label="예배 선택"
              className="flex max-w-full gap-1 overflow-x-auto py-2"
            >
              {visibleServices.map((service, index) => {
                const selected = service.id === selectedService.id;
                return (
                  <button
                    key={service.id}
                    ref={(element) => {
                      tabRefs.current[index] = element;
                    }}
                    id={`${idPrefix}-service-tab-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${idPrefix}-service-panel-${index}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectService(service.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`min-h-11 min-w-11 shrink-0 rounded-full px-4 py-2 text-base font-semibold transition-colors motion-reduce:transition-none ${
                      selected
                        ? "bg-liturgy-brand-soft text-liturgy-brand"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {service.label}
                  </button>
                );
              })}
            </div>
          </div>

          <section
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${idPrefix}-service-tab-${selectedIndex}`}
            tabIndex={0}
          >
            <div className="border-b border-stone-200 bg-white px-5 py-6 sm:px-8">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-2xl font-bold text-stone-950">
                  {selectedService.label}
                </h2>
                {serviceIsLive && (
                  <span className="rounded-full bg-red-700 px-3 py-1 text-sm font-bold text-white">
                    LIVE
                  </span>
                )}
              </div>
              {selectedService.leader.trim() && (
                <p className="mt-2 break-words text-sm text-stone-600">
                  인도 {selectedService.leader}
                </p>
              )}

              {playableVideoId ? (
                <div className="mt-6 aspect-video w-full overflow-hidden rounded-xl border border-stone-200 bg-black">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube-nocookie.com/embed/${playableVideoId}`}
                    title={`${selectedService.label} 영상`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-stone-200 bg-church-cream px-5 py-6">
                  <p className="text-base leading-7 text-stone-700">
                    재생할 수 있는 예배 영상이 아직 준비되지 않았습니다.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/sermons"
                      className="inline-flex min-h-11 items-center rounded-full border border-liturgy-brand px-4 py-2 text-sm font-semibold text-liturgy-brand hover:bg-liturgy-brand-soft"
                    >
                      설교 영상 보기
                    </Link>
                    <a
                      href="https://www.youtube.com/@msvchphoto"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white"
                    >
                      교회 YouTube 채널
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-10 sm:px-8">
              <h3 className="text-xl font-bold text-stone-950">예배 순서</h3>
              <ol className="mt-6 space-y-0">
                {selectedService.items
                  .filter((item) => item.visible)
                  .map((item, index, visibleItems) => {
                    const resource = item.resourceId
                      ? resourcesById[item.resourceId]
                      : undefined;
                    const externalUrl = safeExternalUrl(item.externalUrl);
                    return (
                      <li key={item.id} className="relative flex min-w-0 gap-4 pb-8 last:pb-0">
                        {index < visibleItems.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[21px] top-11 w-px bg-stone-300"
                          />
                        )}
                        <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-liturgy-brand bg-white text-sm font-bold text-liturgy-brand">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <p
                            className={`break-words text-base leading-7 ${
                              item.emphasized
                                ? "font-bold text-liturgy-brand"
                                : "font-semibold text-stone-900"
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.summary.trim() && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-base leading-7 text-stone-700">
                              {item.summary}
                            </p>
                          )}
                          {item.assignees.length > 0 && (
                            <p className="mt-2 break-words text-sm text-stone-500">
                              {item.assignees.join(" · ")}
                            </p>
                          )}
                          {(resource || externalUrl) && (
                            <div className="mt-4 flex flex-wrap gap-3">
                              {resource && <WorshipResourceSheet resource={resource} />}
                              {externalUrl && (
                                <a
                                  href={externalUrl}
                                  aria-label={`${item.label} 외부 링크 열기`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white"
                                >
                                  관련 링크 열기
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ol>
            </div>
          </section>
        </>
      )}
    </article>
  );
}
