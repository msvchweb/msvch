"use client";

import { createMobileService, legacyWeeklyToMobileServices } from "@/lib/mobile-bulletin";
import type { WeeklyContentInput } from "@/lib/validation";
import type { MobileService, MobileServiceItem, MobileServiceType, WorshipResource } from "@/types/mobile-bulletin";

export type SermonVideoOption = {
  video_id: string;
  title: string;
  published_at: string | null;
  category: string | null;
};

type Props = {
  value: MobileService[];
  weekly: WeeklyContentInput;
  resources: WorshipResource[];
  videos: SermonVideoOption[];
  onChange: (next: MobileService[]) => void;
  warning?: string | null;
};

/** 관리자 화면에 노출되는 예배 종류 이름. 저장값은 영문 키 그대로다. */
const SERVICE_TYPE_LABELS: Record<MobileServiceType, string> = {
  sunday: "주일예배",
  wednesday: "수요예배",
  friday: "금요기도회",
  other: "기타 예배",
};
const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as MobileServiceType[];

function toWeekly(weekly: WeeklyContentInput) {
  return { ...weekly, id: "mobile-draft", created_at: new Date().toISOString(), date: weekly.date ?? null } as Parameters<typeof legacyWeeklyToMobileServices>[0];
}

function updateService(services: MobileService[], id: string, patch: Partial<MobileService>) {
  return services.map((service) => service.id === id ? { ...service, ...patch } : service);
}

function updateItem(services: MobileService[], serviceId: string, itemId: string, patch: Partial<MobileServiceItem>) {
  return services.map((service) => service.id !== serviceId ? service : {
    ...service,
    items: service.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
  });
}

function toDateTimeLocal(value: string): string {
  return value.replace("+09:00", "").slice(0, 16);
}

function fromDateTimeLocal(value: string): string {
  return value ? `${value}:00+09:00` : "";
}

export function MobileBulletinEditor({ value, weekly, resources, videos, onChange, warning }: Props) {
  const date = weekly.date ?? new Date().toISOString().slice(0, 10);
  const addService = (type: MobileServiceType) => {
    const next = createMobileService(type, date);
    onChange([...value, { ...next, id: crypto.randomUUID(), primary: next.primary && !value.some((service) => service.primary) }]);
  };
  const setPrimary = (id: string) => onChange(value.map((service) => ({ ...service, primary: service.id === id })));

  return (
    <section className="space-y-5 rounded-xl border border-liturgy-brand/30 bg-church-cream/30 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">모바일 주보</h2>
          <p className="mt-1 text-sm text-gray-600">예배별 순서, 라이브와 연결 자료를 관리합니다.</p>
        </div>
        <button type="button" onClick={() => onChange(legacyWeeklyToMobileServices(toWeekly(weekly)))} className="rounded-lg border border-liturgy-brand px-3 py-2 text-sm font-medium text-liturgy-brand hover:bg-white">기존 주보 내용으로 생성</button>
      </div>
      {warning && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>}
      <div className="flex flex-wrap gap-2">
        {SERVICE_TYPES.map((type) => <button key={type} type="button" onClick={() => addService(type)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-white">{SERVICE_TYPE_LABELS[type]} 추가</button>)}
      </div>
      {value.length === 0 && <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">등록된 모바일 예배가 없습니다.</p>}
      {value.map((service) => (
        <article key={service.id} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-gray-900">{service.label || "이름 없는 예배"}</strong>
            <button type="button" onClick={() => onChange(value.filter((entry) => entry.id !== service.id))} className="text-sm text-red-600 hover:underline" aria-label={`${service.label} 삭제`}>{service.label} 삭제</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">예배 이름<input className="mt-1 w-full rounded border px-3 py-2" value={service.label} onChange={(event) => onChange(updateService(value, service.id, { label: event.target.value }))} /></label>
            <label className="text-sm">종류<select className="mt-1 w-full rounded border px-3 py-2" value={service.type} onChange={(event) => onChange(updateService(value, service.id, { type: event.target.value as MobileServiceType }))}>{SERVICE_TYPES.map((type) => <option key={type} value={type}>{SERVICE_TYPE_LABELS[type]}</option>)}</select></label>
            <label className="text-sm">인도자<input className="mt-1 w-full rounded border px-3 py-2" value={service.leader} onChange={(event) => onChange(updateService(value, service.id, { leader: event.target.value }))} /></label>
            <label className="text-sm">시작 시각<input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={toDateTimeLocal(service.startsAt)} onChange={(event) => onChange(updateService(value, service.id, { startsAt: fromDateTimeLocal(event.target.value) }))} /></label>
            <label className="text-sm">종료 시각<input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={toDateTimeLocal(service.endsAt)} onChange={(event) => onChange(updateService(value, service.id, { endsAt: fromDateTimeLocal(event.target.value) }))} /></label>
            <label className="text-sm">라이브 URL<input type="url" className="mt-1 w-full rounded border px-3 py-2" value={service.liveUrl ?? ""} onChange={(event) => onChange(updateService(value, service.id, { liveUrl: event.target.value || null }))} /></label>
            <label className="text-sm">설교 영상<select className="mt-1 w-full rounded border px-3 py-2" value={service.videoId ?? ""} onChange={(event) => onChange(updateService(value, service.id, { videoId: event.target.value || null }))}><option value="">선택 안 함</option>{videos.map((video) => <option key={video.video_id} value={video.video_id}>{video.title}</option>)}</select></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={service.visible} onChange={(event) => onChange(updateService(value, service.id, { visible: event.target.checked }))} />공개 표시</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="mobile-primary" checked={service.primary} onChange={() => setPrimary(service.id)} />기본 예배</label>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between"><h3 className="font-medium text-gray-800">예배 순서</h3><button type="button" onClick={() => onChange(updateService(value, service.id, { items: [...service.items, { id: crypto.randomUUID(), label: "새 순서", summary: "", assignees: [], emphasized: false, standing: false, visible: true, resourceId: null, externalUrl: null }] }))} className="text-sm text-primary-700">순서 추가</button></div>
            {service.items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs">순서명<input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={item.label} onChange={(event) => onChange(updateItem(value, service.id, item.id, { label: event.target.value }))} /></label>
              <label className="text-xs">내용<input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={item.summary} onChange={(event) => onChange(updateItem(value, service.id, item.id, { summary: event.target.value }))} /></label>
              <div className="flex items-end gap-2"><button type="button" disabled={index === 0} aria-label={`${item.label} 위로`} onClick={() => { const items=[...service.items]; [items[index-1],items[index]]=[items[index],items[index-1]]; onChange(updateService(value,service.id,{items})); }} className="rounded border px-2 py-1 text-sm disabled:opacity-40">위로</button><button type="button" disabled={index === service.items.length-1} aria-label={`${item.label} 아래로`} onClick={() => { const items=[...service.items]; [items[index],items[index+1]]=[items[index+1],items[index]]; onChange(updateService(value,service.id,{items})); }} className="rounded border px-2 py-1 text-sm disabled:opacity-40">아래로</button></div>
              <label className="text-xs">자료<select aria-label={`${item.label} 자료 선택`} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={item.resourceId ?? ""} onChange={(event) => onChange(updateItem(value, service.id, item.id, { resourceId: event.target.value || null }))}><option value="">선택 안 함</option>{resources.filter((resource) => resource.is_active || resource.id === item.resourceId).map((resource) => <option key={resource.id} value={resource.id}>{resource.title}{resource.is_active ? "" : " (비활성)"}</option>)}</select></label>
              <label className="text-xs">외부 URL<input type="url" className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={item.externalUrl ?? ""} onChange={(event) => onChange(updateItem(value, service.id, item.id, { externalUrl: event.target.value || null }))} /></label>
              <label className="text-xs">담당자<input className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={item.assignees.join(", ")} onChange={(event) => onChange(updateItem(value, service.id, item.id, { assignees: event.target.value.split(",").map((name) => name.trim()).filter(Boolean) }))} /></label>
              <label className="flex items-end gap-1 text-xs"><input type="checkbox" checked={item.emphasized} onChange={(event) => onChange(updateItem(value, service.id, item.id, { emphasized: event.target.checked }))} />강조</label>
              <label className="flex items-end gap-1 text-xs"><input type="checkbox" checked={item.standing} onChange={(event) => onChange(updateItem(value, service.id, item.id, { standing: event.target.checked }))} />기립</label>
              <label className="flex items-end gap-1 text-xs"><input type="checkbox" checked={item.visible} onChange={(event) => onChange(updateItem(value, service.id, item.id, { visible: event.target.checked }))} />표시</label>
            </div>)}
          </div>
        </article>
      ))}
    </section>
  );
}
