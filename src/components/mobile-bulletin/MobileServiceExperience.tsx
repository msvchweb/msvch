"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  extractYouTubeVideoId,
  isServiceLive,
  selectMobileServiceId,
} from "@/lib/mobile-bulletin";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";
import { useBulletinTheme } from "./BulletinThemeShell";
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

/** 하단 선택바는 폭이 좁다. "주일예배" → "주일" 처럼 뒤의 "예배"만 덜어낸다. */
function shortServiceLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.replace(/예배$/, "").trim() || trimmed;
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
  const rootRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const idPrefix = useId().replaceAll(":", "");
  const { theme, toggle } = useBulletinTheme();

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
    // 핸드오프는 예배를 바꿀 때 스크롤러를 맨 위로 되돌린다. 그렇게 하지 않으면
    // 교회소식·헌금처럼 아래쪽을 읽던 사용자가 하단 선택바로 예배를 바꿨을 때
    // 새 예배의 히어로와 순서가 화면 밖에 있는 채로 내용만 갈린다.
    // behavior 기본값(즉시 이동)이라 prefers-reduced-motion 과 충돌하지 않는다.
    rootRef.current?.scrollIntoView({ block: "start" });
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
  const panelId = selectedService ? `${idPrefix}-service-panel` : undefined;
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

  // overflow-x-clip: hidden 은 스크롤 컨테이너를 만들어 하위 스냅 영역을 뷰포트에서 떼어낸다.
  return (
    <article
      ref={rootRef}
      className="scroll-mt-20 overflow-x-clip bg-[var(--bt-bg)] text-[var(--bt-ink)] transition-colors duration-300 motion-reduce:transition-none"
    >
      <header className="px-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-[var(--bt-acc)] text-[13px] font-extrabold text-white"
            >
              명
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold tracking-[-0.03em] text-[var(--bt-ink)]">
                {title}
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-[var(--bt-faint)]">
                {liturgyLabel}
                {date && (
                  <>
                    {" · "}
                    <time dateTime={date}>{date}</time>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-pressed={theme === "dark"}
              aria-label={theme === "light" ? "어두운 화면으로 전환" : "밝은 화면으로 전환"}
              className="grid size-11 place-items-center rounded-full border border-[var(--bt-line)] bg-[var(--bt-card)] text-[15px] transition-colors motion-reduce:transition-none"
            >
              <span aria-hidden="true">{theme === "light" ? "🌙" : "☀️"}</span>
            </button>
            <Link
              href="/weekly"
              className="grid min-h-11 place-items-center rounded-full bg-[var(--bt-acc-soft)] px-3.5 text-xs font-bold text-[var(--bt-acc)]"
            >
              종이 주보 ↗
            </Link>
          </div>
        </div>
      </header>

      {visibleServices.length === 0 || !selectedService ? (
        <section className="px-5 py-16 text-center sm:px-8">
          <h2 className="text-xl font-bold text-[var(--bt-ink)]">모바일 주보 준비 중</h2>
          <p className="mt-3 text-base text-[var(--bt-sub)]">
            예배 순서를 준비하고 있습니다.
          </p>
        </section>
      ) : (
        <>
          <div className="px-4 sm:px-6">
            <div
              role="tablist"
              aria-label="예배 선택"
              className="flex max-w-full gap-4.5 overflow-x-auto"
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
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectService(service.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`relative min-h-11 shrink-0 pt-2 pb-3 text-[13.5px] tracking-[-0.02em] transition-colors motion-reduce:transition-none ${
                      selected
                        ? "font-extrabold text-[var(--bt-ink)]"
                        : "font-medium text-[var(--bt-faint)]"
                    }`}
                  >
                    {service.label}
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-sm bg-[var(--bt-acc)]"
                      />
                    )}
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
            className="px-4 pt-4 pb-10 sm:px-6"
          >
            <div
              key={selectedService.id}
              className="animate-[bulletin-slide-in_.34s_cubic-bezier(.2,.7,.3,1)] motion-reduce:animate-none"
            >
              {/* 히어로에는 snap-start 를 걸지 않는다. 첫 스냅 지점이 되면 문서가
                  scrollY 0 에 머무르지 못하고 끌려 내려가, 바로 위의 주보 헤더(테마 토글·
                  종이 주보 링크)가 영영 화면 밖에 남는다. */}
              <div className="scroll-mt-20">
                <div className="relative flex min-h-[190px] flex-col justify-end overflow-hidden rounded-[20px] bg-[linear-gradient(150deg,var(--bt-acc),var(--bt-card)_130%)] p-[18px] text-white">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[radial-gradient(120%_90%_at_80%_0%,rgba(255,255,255,0.18),transparent_60%)]"
                  />
                  {serviceIsLive && (
                    <span className="absolute left-3.5 top-3.5 z-[2] inline-flex items-center gap-1.5 rounded-full bg-[#e0393b] px-2.5 py-[5px] text-[10.5px] font-extrabold tracking-[0.04em] text-white">
                      <span
                        aria-hidden="true"
                        className="size-1.5 animate-[bulletin-pulse_1.4s_infinite] rounded-full bg-white motion-reduce:animate-none"
                      />
                      LIVE
                    </span>
                  )}
                  <div className="relative z-[2]">
                    <p className="mb-1.5 text-[11px] tracking-[0.08em] text-white/72">
                      {liturgyLabel}
                    </p>
                    <h2 className="break-words text-[23px] font-extrabold leading-[1.15] tracking-[-0.035em]">
                      {selectedService.label}
                    </h2>
                    {selectedService.leader.trim() && (
                      <p className="mt-1.5 break-words text-[12.5px] text-white/82">
                        인도 {selectedService.leader}
                      </p>
                    )}
                    {!playableVideoId && (
                      <p className="mt-2 text-[11.5px] text-white/75">
                        예배 후 영상이 업로드됩니다
                      </p>
                    )}
                  </div>
                </div>

                {playableVideoId ? (
                  <div className="mt-2.5 aspect-video w-full overflow-hidden rounded-[20px] bg-black">
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
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    <Link
                      href="/sermons"
                      className="inline-flex min-h-11 items-center rounded-full bg-[var(--bt-acc-soft)] px-4 text-[13px] font-bold text-[var(--bt-acc)]"
                    >
                      설교 영상 보기
                    </Link>
                    <a
                      href="https://www.youtube.com/@msvchphoto"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-[var(--bt-line)] bg-[var(--bt-card)] px-4 text-[13px] font-bold text-[var(--bt-sub)]"
                    >
                      교회 YouTube 채널
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-6 scroll-mt-20 snap-start">
                <div className="mb-3 flex items-baseline gap-2 px-0.5">
                  <h3 className="text-[17px] font-extrabold tracking-[-0.035em] text-[var(--bt-ink)]">
                    예배 순서
                  </h3>
                  <span className="text-xs text-[var(--bt-faint)]">
                    자료가 있는 항목을 눌러보세요
                  </span>
                </div>

                <ol className="flex flex-col gap-2">
                  {selectedService.items
                    .filter((item) => item.visible)
                    .map((item, index) => {
                      const resolvedResource = item.resourceId
                        ? resourcesById[item.resourceId]
                        : undefined;
                      const resource = resolvedResource?.is_active
                        ? resolvedResource
                        : undefined;
                      const externalUrl = safeExternalUrl(item.externalUrl);
                      return (
                        <li
                          key={item.id}
                          className={`flex min-w-0 items-center gap-3.5 rounded-[15px] px-[15px] py-3.5 ${
                            item.emphasized
                              ? "border border-transparent bg-[var(--bt-acc-soft)]"
                              : "border border-[var(--bt-line)] bg-[var(--bt-card)]"
                          }`}
                        >
                          <span className="w-4 shrink-0 text-[11px] font-extrabold tabular-nums text-[var(--bt-acc)]">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`break-words text-[15px] tracking-[-0.025em] text-[var(--bt-ink)] ${
                                item.emphasized ? "font-extrabold" : "font-bold"
                              }`}
                            >
                              {item.standing && (
                                <span
                                  aria-hidden="true"
                                  className="mr-1.5 align-[0.15em] text-[9px] text-[var(--bt-faint)]"
                                >
                                  ▲
                                </span>
                              )}
                              {item.standing && <span className="sr-only">기립 </span>}
                              {item.label}
                            </p>
                            {item.summary.trim() && (
                              <p
                                className={`mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed ${
                                  item.emphasized
                                    ? "font-bold text-[var(--bt-acc)]"
                                    : "text-[var(--bt-sub)]"
                                }`}
                              >
                                {item.summary}
                              </p>
                            )}
                            {item.assignees.length > 0 && (
                              <p className="mt-0.5 break-words text-[11px] text-[var(--bt-faint)]">
                                {item.assignees.join(" · ")}
                              </p>
                            )}
                          </div>
                          {(resource || externalUrl) && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {resource && <WorshipResourceSheet resource={resource} />}
                              {externalUrl && (
                                <a
                                  href={externalUrl}
                                  aria-label={`${item.label} 외부 링크 열기`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-grid min-h-11 min-w-11 place-items-center rounded-full bg-[var(--bt-acc-soft)] px-2.5 text-[10.5px] font-extrabold text-[var(--bt-acc)]"
                                >
                                  링크
                                </a>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ol>
                {selectedService.items.some((item) => item.visible && item.standing) && (
                  <p className="px-1.5 pt-2 text-[11.5px] text-[var(--bt-faint)]">
                    ▲ 표는 일어서 주시기 바랍니다
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 고정 하단 예배 선택바. 상단 탭과 같은 상태를 쓰되 역할은 보조 내비게이션이라
              role="tab" 을 중복시키지 않는다. transform 을 쓰는 애니메이션 래퍼 바깥에
              둬야 position: fixed 가 뷰포트 기준으로 잡힌다.
              lg 미만에서는 전역 하단 탭바(BottomTabBar, 57px, lg:hidden)가 화면 맨 아래를
              차지하므로 그 위에 얹고, lg 이상에서만 바닥에 붙는다. */}
          <nav
            aria-label="예배 빠른 선택"
            className="fixed inset-x-0 bottom-[57px] z-30 mx-auto flex w-full max-w-[430px] border-t border-[var(--bt-line)] bg-[var(--bt-bar)] pb-3.5 backdrop-blur-[18px] lg:bottom-0 lg:pb-[max(14px,env(safe-area-inset-bottom))]"
          >
            {visibleServices.map((service) => {
              const current = service.id === selectedService.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => selectService(service.id)}
                  aria-current={current ? "true" : undefined}
                  className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-[5px] text-[11px] font-bold transition-colors motion-reduce:transition-none ${
                    current ? "text-[var(--bt-acc)]" : "text-[var(--bt-faint)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full transition-colors motion-reduce:transition-none ${
                      current ? "bg-[var(--bt-acc)]" : "bg-transparent"
                    }`}
                  />
                  {shortServiceLabel(service.label)}
                </button>
              );
            })}
          </nav>
        </>
      )}
    </article>
  );
}
