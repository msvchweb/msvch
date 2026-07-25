import { MobileServicesSchema } from "@/lib/validation";
import type { MobileService, MobileServiceItem, MobileServiceType } from "@/types/mobile-bulletin";
import type { Weekly, WorshipItemRow } from "@/types/notice";

export const APOSTLES_CREED_RESOURCE_ID = "00000000-0000-4000-8000-000000000001";
export const LIVE_LEAD_MS = 15 * 60 * 1000;
export const LIVE_TAIL_MS = 30 * 60 * 1000;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,50}$/;
const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month, day];
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = dateParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function kstCalendarDate(date: Date): string {
  const parts = KST_DATE_FORMATTER.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function makeItem(id: string, label: string, summary: string, assignees: string[] = [], emphasized = false): MobileServiceItem {
  return { id, label, summary, assignees, emphasized, standing: false, visible: true, resourceId: null, externalUrl: null };
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function serviceDate(service: MobileService): string {
  return kstCalendarDate(new Date(service.startsAt));
}

function distanceToStart(service: MobileService, now: Date): number {
  return Math.abs(new Date(service.startsAt).getTime() - now.getTime());
}

function uniqueIds(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function extractYouTubeVideoId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(host)) return null;

    let videoId: string | null = null;
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/live/") || url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
    return videoId && VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function createMobileService(type: MobileServiceType, date: string): MobileService {
  const defaults: Record<MobileServiceType, { dayOffset: number; label: string; startsAt: string; endsAt: string }> = {
    sunday: { dayOffset: 0, label: "주일예배", startsAt: "08:00:00", endsAt: "13:30:00" },
    wednesday: { dayOffset: 3, label: "수요예배", startsAt: "19:30:00", endsAt: "21:00:00" },
    friday: { dayOffset: 5, label: "금요예배", startsAt: "20:30:00", endsAt: "22:00:00" },
    other: { dayOffset: 0, label: "예배", startsAt: "11:00:00", endsAt: "12:00:00" },
  };
  const defaultService = defaults[type];
  const serviceDate = addCalendarDays(date, defaultService.dayOffset);
  return {
    id: `${type}-${serviceDate}`,
    type,
    label: defaultService.label,
    startsAt: `${serviceDate}T${defaultService.startsAt}+09:00`,
    endsAt: `${serviceDate}T${defaultService.endsAt}+09:00`,
    primary: type === "sunday",
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: null,
    items: [],
  };
}

export function createDefaultMobileServices(date: string): MobileService[] {
  return [createMobileService("sunday", date), createMobileService("wednesday", date)];
}

function legacyItem(item: WorshipItemRow, index: number): MobileServiceItem | null {
  const label = item.label.trim();
  const summary = item.content.trim();
  if (!label && !summary) return null;
  const mapped = makeItem(`sunday-item-${index + 1}`, label || "예배 순서", summary, item.assignees, item.emphasize);
  if (`${label} ${summary}`.includes("신앙고백") || `${label} ${summary}`.includes("사도신경")) {
    mapped.resourceId = APOSTLES_CREED_RESOURCE_ID;
  }
  return mapped;
}

export function legacyWeeklyToMobileServices(weekly: Weekly): MobileService[] {
  const date = weekly.date ?? "1970-01-01";
  const sunday = createMobileService("sunday", date);
  sunday.leader = weekly.worship_leader ?? "";
  sunday.items = weekly.worship_items
    .map(legacyItem)
    .filter((item): item is MobileServiceItem => item !== null);

  const mappedSundayText = sunday.items.map((item) => `${item.label} ${item.summary}`).join(" ");
  if (!mappedSundayText.includes("말씀") && !mappedSundayText.includes("설교") && (hasText(weekly.sermon_title) || hasText(weekly.sermon_pastor))) {
    sunday.items.push(makeItem("sunday-sermon", "말씀", weekly.sermon_title ?? "", weekly.sermon_pastor ? [weekly.sermon_pastor] : []));
  }
  const closingHymn = weekly.closing_hymn?.trim() ?? "";
  const hasClosingHymn = closingHymn !== "" && sunday.items.some((item) =>
    item.summary.includes(closingHymn) || /결단|마침|폐회/.test(`${item.label} ${item.summary}`),
  );
  if (!hasClosingHymn && closingHymn !== "") {
    sunday.items.push(makeItem("sunday-closing-hymn", "찬송", closingHymn));
  }

  const services = [sunday];
  const wednesdayData = weekly.wednesday_service;
  if (Object.values(wednesdayData).some(hasText)) {
    const wednesday = createMobileService("wednesday", date);
    wednesday.leader = wednesdayData.leader;
    if (hasText(wednesdayData.hymn)) wednesday.items.push(makeItem("wednesday-hymn", "찬송", wednesdayData.hymn));
    if (hasText(wednesdayData.scripture)) wednesday.items.push(makeItem("wednesday-scripture", "성경봉독", wednesdayData.scripture));
    if (hasText(wednesdayData.title) || hasText(wednesdayData.pastor)) {
      wednesday.items.push(makeItem("wednesday-sermon", "말씀", wednesdayData.title, wednesdayData.pastor ? [wednesdayData.pastor] : []));
    }
    if (hasText(wednesdayData.benediction)) wednesday.items.push(makeItem("wednesday-benediction", "축도", wednesdayData.benediction));
    services.push(wednesday);
  }
  return services;
}

export function resolveMobileServices(weekly: Weekly): MobileService[] {
  const parsed = MobileServicesSchema.safeParse(weekly.mobile_services);
  return parsed.success && parsed.data.length > 0 ? parsed.data : legacyWeeklyToMobileServices(weekly);
}

export function rebaseMobileServices(services: MobileService[], fromDate: string, toDate: string): MobileService[] {
  const [fromYear, fromMonth, fromDay] = dateParts(fromDate);
  const [toYear, toMonth, toDay] = dateParts(toDate);
  const days = (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000;
  const rebase = (value: string) => `${addCalendarDays(value.slice(0, 10), days)}${value.slice(10)}`;
  return services.map((service) => ({
    ...service,
    startsAt: rebase(service.startsAt),
    endsAt: rebase(service.endsAt),
    items: service.items.map((item) => ({ ...item, assignees: [...item.assignees] })),
  }));
}

export function isServiceLive(service: MobileService, now: Date): boolean {
  return now.getTime() >= new Date(service.startsAt).getTime() - LIVE_LEAD_MS && now.getTime() <= new Date(service.endsAt).getTime() + LIVE_TAIL_MS;
}

export function selectMobileServiceId(services: MobileService[], now: Date): string | null {
  const visible = services.map((service, index) => ({ service, index })).filter(({ service }) => service.visible);
  const sortByPreference = (left: { service: MobileService; index: number }, right: { service: MobileService; index: number }) =>
    distanceToStart(left.service, now) - distanceToStart(right.service, now) ||
    Number(right.service.primary) - Number(left.service.primary) ||
    left.index - right.index;

  const active = visible.filter(({ service }) => isServiceLive(service, now)).sort(sortByPreference);
  if (active[0]) return active[0].service.id;

  const today = kstCalendarDate(now);
  const next = visible
    .filter(({ service }) => serviceDate(service) === today && new Date(service.startsAt).getTime() > now.getTime())
    .sort((left, right) => new Date(left.service.startsAt).getTime() - new Date(right.service.startsAt).getTime() || Number(right.service.primary) - Number(left.service.primary) || left.index - right.index);
  if (next[0]) return next[0].service.id;

  return visible.find(({ service }) => service.primary)?.service.id ?? visible[0]?.service.id ?? null;
}

export function collectStoredResourceIds(services: MobileService[]): string[] {
  return uniqueIds(services.flatMap((service) => service.items.map((item) => item.resourceId)));
}

export function collectStoredVideoIds(services: MobileService[]): string[] {
  return uniqueIds(services.map((service) => service.videoId));
}

export function collectRelationIds(services: MobileService[]): { resourceIds: string[]; videoIds: string[] } {
  const visibleServices = services.filter((service) => service.visible);
  return {
    resourceIds: uniqueIds(visibleServices.flatMap((service) => service.items.filter((item) => item.visible).map((item) => item.resourceId))),
    videoIds: uniqueIds(visibleServices.map((service) => service.videoId)),
  };
}
