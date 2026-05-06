"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PrayerItem,
  Announcement,
  NewsItem,
  MeetingRow,
  NewMemberRow,
  WorshipItemRow,
  WorshipSubRow,
} from "@/types/notice";
import type { WeeklyContentInput } from "@/lib/validation";
import { FormTabs, type FormTab } from "./form/FormTabs";
import { DynamicArrayField } from "./form/DynamicArrayField";
import { Field, SectionTitle } from "./form/Field";
import { inputCls, inputErrCls, textareaCls, weekOfMonth, stripLeadingNumber } from "./form/shared";
import {
  WORSHIP_ITEMS_TEMPLATE,
  WORSHIP_SLOT_HINTS,
  OFFERING_CATEGORIES,
  NEXT_WEEK_PRAYER_PARTS,
  GUIDE_COMMITTEE_PARTS,
  DAWN_WEEKDAY_LABELS,
  emptyOfferings,
  emptyWorshipItems,
  emptyGuideCommittee,
  emptyNextWeekPrayer,
  buildDawnReadings,
} from "./form/constants";

interface Props {
  initial: WeeklyContentInput;
  onSubmit: (data: WeeklyContentInput, publish: boolean) => Promise<void>;
  onGeneratePdf?: () => Promise<void>;
  generatingPdf?: boolean;
  submitting?: boolean;
  weeklyId?: string;
  /** 현재 폼 값을 부모(미리보기 등)에 노출. 상태 저장 용도가 아니라 파생 값 전달 용도 */
  onFormChange?: (form: WeeklyContentInput) => void;
  /** 탭 변경 콜백 — 미리보기 자동 스크롤 등에 사용 */
  onTabChange?: (key: string) => void;
}

/**
 * 헌금 금액 입력 — 숫자만 추출 → "1,234,567원" 으로 자동 포맷.
 * 사용자가 백스페이스로 끝의 "원"을 지운 경우(끝 "원"이 사라진 동일 prefix 패턴)
 * 한 자리 숫자도 같이 지워지도록 한다(자연스러운 backspace UX).
 */
function formatMoney(prev: string, raw: string): string {
  if (prev.endsWith("원") && raw === prev.slice(0, -1)) {
    raw = raw.slice(0, -1);
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ko-KR") + "원";
}

/**
 * "1부 홍성란 권사" 처럼 접두가 붙어 저장된 값에서 표시용으로 접두를 떼낸다.
 * 폼 입력은 이름만 받고 저장 시 접두를 다시 붙이기 위한 짝꿍 함수.
 * 접두가 없으면 원본을 그대로 돌려준다(legacy 데이터 호환).
 */
function stripPartPrefix(value: string, part: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withSpace = `${part} `;
  if (trimmed.startsWith(withSpace)) return trimmed.slice(withSpace.length);
  if (trimmed === part) return "";
  return value;
}

/** 고정 슬롯(예배순서/헌금/다음주기도/안내위원/새벽예배) 길이 정합성 보정 */
function normalizeFixedSlots(f: WeeklyContentInput): WeeklyContentInput {
  const next: WeeklyContentInput = { ...f };
  let changed = false;
  if (next.worship_items.length !== WORSHIP_ITEMS_TEMPLATE.length) {
    // 기존 값이 있으면 길이 맞춰 prefill, 부족분은 템플릿 기본값
    const base = emptyWorshipItems();
    next.worship_items.slice(0, base.length).forEach((src, i) => {
      base[i] = {
        marker: base[i].marker, // marker/label 은 템플릿 고정
        label: base[i].label,
        content: src.content ?? base[i].content,
        assignees: (src.assignees ?? base[i].assignees).slice(0, Math.max(base[i].assignees.length, 1)),
        subRows: src.subRows.length > 0 ? src.subRows : base[i].subRows,
        emphasize: base[i].emphasize,
      };
    });
    next.worship_items = base;
    changed = true;
  }
  if (next.offerings.length !== OFFERING_CATEGORIES.length) {
    const base = emptyOfferings();
    next.offerings.forEach((src) => {
      const idx = OFFERING_CATEGORIES.findIndex((l) => l === src.label);
      if (idx >= 0) base[idx].names = src.names ?? "";
    });
    next.offerings = base;
    changed = true;
  }
  if (next.next_week_prayer.length !== NEXT_WEEK_PRAYER_PARTS.length) {
    const base = emptyNextWeekPrayer();
    next.next_week_prayer.slice(0, base.length).forEach((v, i) => (base[i] = v));
    next.next_week_prayer = base;
    changed = true;
  }
  if (next.guide_committee.length !== GUIDE_COMMITTEE_PARTS.length) {
    const base = emptyGuideCommittee();
    next.guide_committee.slice(0, base.length).forEach((src, i) => {
      base[i] = { part: GUIDE_COMMITTEE_PARTS[i], indoor: src.indoor ?? "", outdoor: src.outdoor ?? "" };
    });
    next.guide_committee = base;
    changed = true;
  }
  if (next.dawn_readings.length !== DAWN_WEEKDAY_LABELS.length) {
    next.dawn_readings = buildDawnReadings(next.date, next.dawn_readings);
    changed = true;
  }
  // 교회소식 제목의 머리글 번호("1. ") 제거 — 번호는 자동 생성으로 대체
  if (next.news.some((n) => /^\s*\d+\.\s*/.test(n.title))) {
    next.news = next.news.map((n) => ({ ...n, title: stripLeadingNumber(n.title) }));
    changed = true;
  }
  return changed ? next : f;
}

export function applyPlaceholderDefaults(f: WeeklyContentInput): WeeklyContentInput {
  const titleFallback = f.date
    ? (() => {
        const d = new Date(f.date + "T00:00:00");
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${weekOfMonth(f.date)}주 주보`;
      })()
    : "주일예배";
  return {
    ...f,
    title: f.title.trim() || titleFallback,
    hymn_number: f.hymn_number || "342",
    scripture: f.scripture || "요한복음 16:31-33",
    special_praise: {
      part1: {
        song: f.special_praise.part1.song || "주 예수 나의 산 소망",
        choir: f.special_praise.part1.choir || "호산나 찬양대",
      },
      part2: {
        song: f.special_praise.part2.song || "이 자리에 나옵니다",
        choir: f.special_praise.part2.choir,
      },
    },
    sermon_title: f.sermon_title || "세상에서 그리스도인으로 잘 사는 법",
    sermon_pastor: f.sermon_pastor || "이양재",
    closing_hymn: f.closing_hymn || "342",
    weekly_verse: f.weekly_verse || "요한복음 16:33\n이것을 너희에게 이르는 것은 너희로 내 안에서 평안을 누리게 하려 함이라",
    afternoon_service: {
      scripture: f.afternoon_service.scripture,
      title: f.afternoon_service.title,
      pastor: f.afternoon_service.pastor,
    },
    wednesday_service: {
      scripture: f.wednesday_service.scripture,
      title: f.wednesday_service.title,
    },
    offering_members: {
      p1: f.offering_members.p1,
      p2: f.offering_members.p2,
      p3: f.offering_members.p3,
    },
    servants_text: f.servants_text,
    offering_list_text: f.offering_list_text,
  };
}

export function WeeklyForm({
  initial,
  onSubmit,
  onGeneratePdf,
  generatingPdf,
  submitting,
  weeklyId,
  onFormChange,
  onTabChange,
}: Props) {
  const [form, setForm] = useState<WeeklyContentInput>(() => normalizeFixedSlots(initial));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // 날짜 변경 시 새벽예배 일자 자동 재생성 (본문은 유지)
  const currentDate = form.date;
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      dawn_readings: buildDawnReadings(currentDate, prev.dawn_readings),
    }));
  }, [currentDate]);

  // 파생 form 값을 부모(미리보기)로 전달
  useEffect(() => {
    onFormChange?.(form);
  }, [form, onFormChange]);

  function clearError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function set<K extends keyof WeeklyContentInput>(
    key: K,
    value: WeeklyContentInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(publish: boolean) {
    const defaulted = applyPlaceholderDefaults(form);
    if (publish) {
      const errors: Partial<Record<string, string>> = {};
      if (!defaulted.date) errors.date = "날짜를 선택해주세요";
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        dateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setFieldErrors({});
    await onSubmit(defaulted, publish);
  }

  const tabs: FormTab[] = [
    {
      key: "basic",
      label: "기본",
      description: "제목·권·호·발행 채널을 관리합니다.",
      content: (
        <BasicTab
          form={form}
          set={set}
          fieldErrors={fieldErrors}
          clearError={clearError}
          titleRef={titleRef}
          dateRef={dateRef}
        />
      ),
    },
    {
      key: "worship",
      label: "페이지1(주일예배)",
      description: "순서지(1페이지 우측) · 암송말씀을 관리합니다.",
      content: <WorshipTab form={form} set={set} />,
    },
    {
      key: "back-left",
      label: "페이지2(예배안내)",
      description: "2페이지(뒷면 좌측)의 예배·기도 영역을 관리합니다.",
      content: <BackLeftTab form={form} set={set} />,
    },
    {
      key: "back-right",
      label: "페이지3(헌금)",
      description: "3페이지(뒷면 우측)의 향기로운 예물 / 누계를 관리합니다.",
      content: <BackRightTab form={form} set={set} />,
    },
    {
      key: "front",
      label: "페이지4(교회소식)",
      description: "4페이지(교회소식/모임/새가족/섬기는분들 참고)와 1페이지 일부를 관리합니다.",
      content: <FrontTab form={form} set={set} />,
    },
    {
      key: "misc",
      label: "기타",
      description: "일반 공지·섬기는분들 텍스트 등 레거시 필드.",
      content: <MiscTab form={form} set={set} />,
    },
    {
      key: "masters",
      label: "주보 마스터",
      description: "여러 주보에서 공용으로 쓰는 마스터 데이터 — 새 탭에서 편집합니다.",
      content: <MastersTab />,
    },
  ];

  return (
    <div className="space-y-6">
      <FormTabs tabs={tabs} onActiveChange={onTabChange} />

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6 pb-8">
        {weeklyId && onGeneratePdf && (
          <button
            type="button"
            onClick={onGeneratePdf}
            disabled={generatingPdf}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {generatingPdf ? "PDF 생성 중..." : "PDF 자동 생성"}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={submitting}
          className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "발행하기"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 1: 기본
// ─────────────────────────────────────────────

interface TabProps {
  form: WeeklyContentInput;
  set: <K extends keyof WeeklyContentInput>(key: K, value: WeeklyContentInput[K]) => void;
}

function BasicTab({
  form,
  set,
  fieldErrors,
  clearError,
  titleRef,
  dateRef,
}: TabProps & {
  fieldErrors: Partial<Record<string, string>>;
  clearError: (key: string) => void;
  titleRef: React.RefObject<HTMLInputElement | null>;
  dateRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>기본 정보</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Field label="제목" required error={fieldErrors.title}>
            <input
              ref={titleRef}
              className={fieldErrors.title ? inputErrCls : inputCls}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                clearError("title");
              }}
              placeholder="2026년 4월 셋째주 주보"
            />
          </Field>
          <Field label="날짜" required error={fieldErrors.date}>
            <input
              ref={dateRef}
              type="date"
              className={fieldErrors.date ? inputErrCls : inputCls}
              value={form.date ?? ""}
              onChange={(e) => {
                set("date", e.target.value || undefined);
                clearError("date");
              }}
            />
          </Field>
          <Field label="권">
            <input
              type="number"
              className={inputCls}
              value={form.volume ?? ""}
              onChange={(e) =>
                set("volume", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="47"
            />
          </Field>
          <Field label="호">
            <input
              type="number"
              className={inputCls}
              value={form.issue ?? ""}
              onChange={(e) =>
                set("issue", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="16"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>발행 설정</SectionTitle>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
              checked={form.publish_channels.website}
              onChange={(e) =>
                set("publish_channels", {
                  ...form.publish_channels,
                  website: e.target.checked,
                })
              }
            />
            <span className="text-sm font-medium">홈페이지 게시</span>
          </label>
          <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
            <input type="checkbox" className="h-4 w-4" disabled />
            <span className="text-sm font-medium">카카오 알림톡 발송</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">준비 중</span>
          </label>
          <label className="flex items-center gap-3 cursor-not-allowed opacity-50">
            <input type="checkbox" className="h-4 w-4" disabled />
            <span className="text-sm font-medium">인스타그램 자동 발행</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">준비 중</span>
          </label>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 2: 주일예배 (순서 고정 17행)
// ─────────────────────────────────────────────

function WorshipTab({ form, set }: TabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>예배 인도자</SectionTitle>
        <Field label="인도자 (1·2·3부 각각)" hint="예: 1부 - 이준영 전도사    2·3부 : 이양재 목사">
          <input
            className={inputCls}
            value={form.worship_leader}
            onChange={(e) => set("worship_leader", e.target.value)}
            placeholder="1부 - 이준영 전도사    2·3부 : 이양재 목사"
          />
        </Field>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>예배 순서 (고정 {WORSHIP_ITEMS_TEMPLATE.length}행)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          순서·제목은 고정되어 있으며, <strong>내용과 담당자</strong>만 수정합니다.
        </p>
        <div className="space-y-2">
          {form.worship_items.map((it, i) => (
            <FixedWorshipRow
              key={i}
              index={i}
              item={it}
              onUpdate={(patch) => {
                const next = form.worship_items.map((x, idx) => (idx === i ? { ...x, ...patch } : x));
                set("worship_items", next);
              }}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>금주 암송말씀</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Field label="성구 출처">
            <input
              className={inputCls}
              value={form.memorize_verse.ref}
              onChange={(e) =>
                set("memorize_verse", { ...form.memorize_verse, ref: e.target.value })
              }
              placeholder="요16:33"
            />
          </Field>
          <Field label="본문">
            <textarea
              className={textareaCls}
              rows={3}
              value={form.memorize_verse.text}
              onChange={(e) =>
                set("memorize_verse", { ...form.memorize_verse, text: e.target.value })
              }
              placeholder="이것을 너희에게 이르는 것은..."
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>레거시 필드 (현재 1페이지 렌더링에 사용되지 않음)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          아래 필드는 이전 버전 주보 시각에서 사용하던 값입니다. 참고 / 백업 용도로 보관합니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="찬송 번호">
            <input
              className={inputCls}
              value={form.hymn_number}
              onChange={(e) => set("hymn_number", e.target.value)}
              placeholder="342"
            />
          </Field>
          <Field label="성경봉독 본문">
            <input
              className={inputCls}
              value={form.scripture}
              onChange={(e) => set("scripture", e.target.value)}
              placeholder="요한복음 16:31-33"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function FixedWorshipRow({
  index,
  item,
  onUpdate,
}: {
  index: number;
  item: WorshipItemRow;
  onUpdate: (patch: Partial<WorshipItemRow>) => void;
}) {
  const hint = WORSHIP_SLOT_HINTS[index] ?? {};
  const assigneeLabels = hint.assigneeLabels;
  const subRowLabels = hint.subRowLabels;

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block w-6 text-center text-sm font-semibold text-gray-500">
          {item.marker || "·"}
        </span>
        <span className="text-sm font-semibold text-gray-800">{item.label}</span>
      </div>

      {/* 내용 */}
      <Field label="내용">
        <input
          className={inputCls}
          value={item.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="빈 칸으로 두면 주보에 공백으로 표시됩니다"
        />
      </Field>

      {/* 담당자: 힌트가 있으면 슬롯별 개별 입력, 없으면 단일 입력 */}
      {assigneeLabels && assigneeLabels.length > 0 ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {assigneeLabels.map((lb, i) => (
            <Field key={i} label={lb}>
              <input
                className={inputCls}
                value={item.assignees[i] ?? ""}
                onChange={(e) => {
                  const next = [...item.assignees];
                  while (next.length <= i) next.push("");
                  next[i] = e.target.value;
                  onUpdate({ assignees: next });
                }}
                placeholder="이름"
              />
            </Field>
          ))}
        </div>
      ) : item.assignees.length === 0 ? null : (
        <Field label="담당">
          <input
            className={inputCls}
            value={item.assignees[0] ?? ""}
            onChange={(e) => onUpdate({ assignees: [e.target.value] })}
            placeholder={item.assignees[0] || "담당자"}
          />
        </Field>
      )}

      {/* subRows: 찬양(1부/2부) 등 */}
      {subRowLabels && subRowLabels.length > 0 && (
        <div className="mt-2 grid gap-2">
          {subRowLabels.map((lb, j) => {
            const sr: WorshipSubRow = item.subRows[j] ?? { content: "", assignee: "" };
            return (
              <div key={j} className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr] items-center">
                <span className="text-xs font-medium text-gray-600">{lb}</span>
                <input
                  className={inputCls}
                  value={sr.content}
                  onChange={(e) => {
                    const next = [...item.subRows];
                    while (next.length <= j) next.push({ content: "", assignee: "" });
                    next[j] = { ...next[j], content: e.target.value };
                    onUpdate({ subRows: next });
                  }}
                  placeholder={`${lb} 곡명`}
                />
                <input
                  className={inputCls}
                  value={sr.assignee}
                  onChange={(e) => {
                    const next = [...item.subRows];
                    while (next.length <= j) next.push({ content: "", assignee: "" });
                    next[j] = { ...next[j], assignee: e.target.value };
                    onUpdate({ assignees: item.assignees, subRows: next });
                  }}
                  placeholder={`${lb} 찬양대`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 3: 앞면(교회소식 / 모임 / 새가족)
// ─────────────────────────────────────────────

function FrontTab({ form, set }: TabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>교회소식 (최대 9개)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">번호(1./2./...)는 자동으로 매겨집니다. 제목만 입력하세요.</p>
        <DynamicArrayField<NewsItem>
          label="교회소식"
          items={form.news}
          max={9}
          addLabel="소식 추가"
          createEmpty={() => ({ title: "", items: [] })}
          onChange={(next) => set("news", next)}
          renderRow={(n, _i, update) => (
            <div className="space-y-2">
              <Field label={`${_i + 1}. 제목`}>
                <input
                  className={inputCls}
                  value={n.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="2026 새생명 마을축제"
                />
              </Field>
              <Field label="세부 항목 (한 줄 = 하나)">
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={n.items.join("\n")}
                  onChange={(e) =>
                    update({
                      items: e.target.value
                        .split("\n")
                        .map((s) => s)
                        .slice(0, 10),
                    })
                  }
                  placeholder={"* 부활절 새생명 초청은...\n* 첫방문시 핸드워시..."}
                />
              </Field>
            </div>
          )}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>모임 안내 (최대 6개)</SectionTitle>
        <DynamicArrayField<MeetingRow>
          label="모임"
          items={form.meetings}
          max={6}
          addLabel="모임 추가"
          createEmpty={() => ({ group: "", when: "", place: "" })}
          onChange={(next) => set("meetings", next)}
          renderRow={(m, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className={inputCls}
                value={m.group}
                onChange={(e) => update({ group: e.target.value })}
                placeholder="3여선"
              />
              <input
                className={inputCls}
                value={m.when}
                onChange={(e) => update({ when: e.target.value })}
                placeholder="4/26(주일) 오후1:40"
              />
              <input
                className={inputCls}
                value={m.place}
                onChange={(e) => update({ place: e.target.value })}
                placeholder="새가족실"
              />
            </div>
          )}
        />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <Field label="북한선교부 메모" hint="예: * 북한선교부 : 오늘(매 월 셋 째 주) 2부예배후 1층 사무실 안쪽">
            <input
              className={inputCls}
              value={form.north_korea_note}
              onChange={(e) => set("north_korea_note", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>단문 메모</SectionTitle>
        <div className="grid gap-4">
          <Field label="성경 통독 현황" hint="예: * 6독 - 조성희,  10독 - 장정자">
            <input
              className={inputCls}
              value={form.bible_reading}
              onChange={(e) => set("bible_reading", e.target.value)}
            />
          </Field>
          <Field label="식당 봉사 메모">
            <input
              className={inputCls}
              value={form.meal_duty_note}
              onChange={(e) => set("meal_duty_note", e.target.value)}
            />
          </Field>
          <Field label="봉사센터 소식">
            <input
              className={inputCls}
              value={form.volunteer_note}
              onChange={(e) => set("volunteer_note", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>지난 주일 등록 새가족 (최대 4명)</SectionTitle>
        <DynamicArrayField<NewMemberRow>
          label="새가족"
          items={form.new_members}
          max={4}
          addLabel="새가족 추가"
          createEmpty={() => ({ no: "", regNo: "", name: "", inviter: "", dept: "" })}
          onChange={(next) => set("new_members", next)}
          renderRow={(m, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-5">
              <input
                className={inputCls}
                value={m.no}
                onChange={(e) => update({ no: e.target.value })}
                placeholder="번호"
              />
              <input
                className={inputCls}
                value={m.regNo}
                onChange={(e) => update({ regNo: e.target.value })}
                placeholder="등록번호"
              />
              <input
                className={inputCls}
                value={m.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="이름"
              />
              <input
                className={inputCls}
                value={m.inviter}
                onChange={(e) => update({ inviter: e.target.value })}
                placeholder="인도자"
              />
              <input
                className={inputCls}
                value={m.dept}
                onChange={(e) => update({ dept: e.target.value })}
                placeholder="선교회"
              />
            </div>
          )}
        />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 4: 뒷면 좌측 (오후·수요·새벽)
// ─────────────────────────────────────────────

function BackLeftTab({ form, set }: TabProps) {
  const dawnDates = useMemo(
    () => buildDawnReadings(form.date, form.dawn_readings),
    [form.date, form.dawn_readings],
  );
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>주일오후 찬양예배</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="성경봉독">
            <input
              className={inputCls}
              value={form.afternoon_service.scripture}
              onChange={(e) =>
                set("afternoon_service", {
                  ...form.afternoon_service,
                  scripture: e.target.value,
                })
              }
            />
          </Field>
          <Field label="말씀 제목">
            <input
              className={inputCls}
              value={form.afternoon_service.title}
              onChange={(e) =>
                set("afternoon_service", {
                  ...form.afternoon_service,
                  title: e.target.value,
                })
              }
            />
          </Field>
          <Field label="설교자">
            <input
              className={inputCls}
              value={form.afternoon_service.pastor}
              onChange={(e) =>
                set("afternoon_service", {
                  ...form.afternoon_service,
                  pastor: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>수요예배</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="성경봉독">
            <input
              className={inputCls}
              value={form.wednesday_service.scripture}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  scripture: e.target.value,
                })
              }
            />
          </Field>
          <Field label="말씀 제목">
            <input
              className={inputCls}
              value={form.wednesday_service.title}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  title: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>다음 주 기도 (1·2·3부 고정)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">이름만 입력하세요. &quot;1부/2부/3부&quot; 접두는 자동으로 붙습니다.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {NEXT_WEEK_PRAYER_PARTS.map((part, i) => (
            <Field key={part} label={part}>
              <input
                className={inputCls}
                value={stripPartPrefix(form.next_week_prayer[i] ?? "", part)}
                onChange={(e) => {
                  const next = [...form.next_week_prayer];
                  while (next.length <= i) next.push("");
                  const name = e.target.value;
                  next[i] = name ? `${part} ${name}` : "";
                  set("next_week_prayer", next);
                }}
                placeholder="홍성란 권사"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>헌금위원 (1·2·3부)</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["p1", "p2", "p3"] as const).map((k, i) => (
            <Field key={k} label={`${i + 1}부`}>
              <input
                className={inputCls}
                value={form.offering_members[k]}
                onChange={(e) =>
                  set("offering_members", {
                    ...form.offering_members,
                    [k]: e.target.value,
                  })
                }
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>안내위원 (1·2·3부 × 실내/실외 고정)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">각 부별로 실내/실외 안내자 이름만 입력합니다.</p>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr] items-center text-xs font-semibold text-gray-500">
            <span></span>
            <span>실내</span>
            <span>실외</span>
          </div>
          {GUIDE_COMMITTEE_PARTS.map((part, i) => {
            const row = form.guide_committee[i] ?? { part, indoor: "", outdoor: "" };
            return (
              <div key={part} className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr] items-center">
                <span className="text-sm font-semibold text-gray-700">{part}</span>
                <input
                  className={inputCls}
                  value={row.indoor}
                  onChange={(e) => {
                    const next = [...form.guide_committee];
                    while (next.length <= i) next.push({ part: GUIDE_COMMITTEE_PARTS[next.length], indoor: "", outdoor: "" });
                    next[i] = { ...next[i], part, indoor: e.target.value };
                    set("guide_committee", next);
                  }}
                  placeholder={`${part} 실내`}
                />
                <input
                  className={inputCls}
                  value={row.outdoor}
                  onChange={(e) => {
                    const next = [...form.guide_committee];
                    while (next.length <= i) next.push({ part: GUIDE_COMMITTEE_PARTS[next.length], indoor: "", outdoor: "" });
                    next[i] = { ...next[i], part, outdoor: e.target.value };
                    set("guide_committee", next);
                  }}
                  placeholder={`${part} 실외`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>새벽예배 신앙일기 (월·화·수·목·금·토 자동)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          <strong>기본 정보의 주보 날짜</strong> 이후 요일로 자동 생성됩니다. 본문만 입력하세요.
        </p>
        <div className="space-y-2">
          {DAWN_WEEKDAY_LABELS.map((label, i) => {
            const d = dawnDates[i];
            const row = form.dawn_readings[i] ?? { date: d.date, passage: "" };
            return (
              <div key={label} className="grid gap-2 sm:grid-cols-[12rem_1fr] items-center">
                <span className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">{d.date}</span>
                <input
                  className={inputCls}
                  value={row.passage}
                  onChange={(e) => {
                    const next = [...form.dawn_readings];
                    while (next.length <= i) next.push({ date: "", passage: "" });
                    next[i] = { date: d.date, passage: e.target.value };
                    set("dawn_readings", next);
                  }}
                  placeholder="왕상 7-8장"
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 5: 뒷면 우측 (헌금 고정 10 카테고리)
// ─────────────────────────────────────────────

function BackRightTab({ form, set }: TabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>향기로운 예물 (고정 {OFFERING_CATEGORIES.length}개 카테고리)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          카테고리는 고정되어 있으며, 각 칸에 <strong>이름만</strong> 입력합니다 (여러 명은 줄바꿈).
        </p>
        <div className="space-y-2">
          {OFFERING_CATEGORIES.map((label, i) => {
            const row = form.offerings[i] ?? { label, names: "" };
            return (
              <div key={label} className="grid gap-2 sm:grid-cols-[8rem_1fr] items-start">
                <span className="pt-2 text-sm font-semibold text-gray-700">{label}</span>
                <textarea
                  className={textareaCls}
                  rows={2}
                  value={row.names}
                  onChange={(e) => {
                    const next = [...form.offerings];
                    while (next.length <= i) next.push({ label: OFFERING_CATEGORIES[next.length], names: "" });
                    next[i] = { label, names: e.target.value };
                    set("offerings", next);
                  }}
                  placeholder={"김철수 이영희\n박민준 최수진"}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>누계</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="지난주 헌금 총액" hint="숫자만 입력하면 콤마와 '원'이 자동으로 표시됩니다.">
            <input
              className={inputCls}
              inputMode="numeric"
              value={form.week_total}
              onChange={(e) => set("week_total", formatMoney(form.week_total, e.target.value))}
              placeholder="0원"
            />
          </Field>
          <Field label="누계" hint="숫자만 입력하면 콤마와 '원'이 자동으로 표시됩니다.">
            <input
              className={inputCls}
              inputMode="numeric"
              value={form.cumulative_total}
              onChange={(e) =>
                set("cumulative_total", formatMoney(form.cumulative_total, e.target.value))
              }
              placeholder="0원"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 6: 기타 (legacy)
// ─────────────────────────────────────────────

function MiscTab({ form, set }: TabProps) {
  function addPrayer() {
    set("prayer_items", [...form.prayer_items, { text: "" } satisfies PrayerItem]);
  }
  function updatePrayer(i: number, value: string) {
    const next = form.prayer_items.map((p, idx) => (idx === i ? { text: value } : p));
    set("prayer_items", next);
  }
  function removePrayer(i: number) {
    set("prayer_items", form.prayer_items.filter((_, idx) => idx !== i));
  }
  function addAnnouncement() {
    set("announcements", [...form.announcements, { text: "" } satisfies Announcement]);
  }
  function updateAnnouncement(i: number, value: string) {
    const next = form.announcements.map((a, idx) => (idx === i ? { text: value } : a));
    set("announcements", next);
  }
  function removeAnnouncement(i: number) {
    set("announcements", form.announcements.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>교회공동체 기도제목 (백업 용도)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          기본 소스는 <strong>마스터 ▷ 교회공동체 기도제목</strong> 입니다. 마스터를 비운 주만 이 값이 사용됩니다.
        </p>
        <div className="space-y-2">
          {form.prayer_items.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">{i + 1}.</span>
              <textarea
                className={`${textareaCls} flex-1`}
                rows={2}
                value={p.text}
                onChange={(e) => updatePrayer(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removePrayer(i)}
                className="mt-2 text-xs text-red-400 hover:text-red-600"
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPrayer}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            + 기도제목 추가
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>공지사항 (레거시)</SectionTitle>
        <div className="space-y-2">
          {form.announcements.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">{i + 1}.</span>
              <textarea
                className={`${textareaCls} flex-1`}
                rows={2}
                value={a.text}
                onChange={(e) => updateAnnouncement(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeAnnouncement(i)}
                className="mt-2 text-xs text-red-400 hover:text-red-600"
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAnnouncement}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            + 공지 추가
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>섬기는 분들 (자유 텍스트 · 레거시)</SectionTitle>
        <Field label="역할: 이름 형식으로 한 줄씩">
          <textarea
            className={textareaCls}
            rows={8}
            value={form.servants_text}
            onChange={(e) => set("servants_text", e.target.value)}
            placeholder={"담 당: 이연재\n사 회: 박기범..."}
          />
        </Field>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>헌금 명단 자유 텍스트 (레거시)</SectionTitle>
        <Field label="헌금 목록 (자유 형식)">
          <textarea
            className={textareaCls}
            rows={6}
            value={form.offering_list_text}
            onChange={(e) => set("offering_list_text", e.target.value)}
          />
        </Field>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 7: 주보 마스터 (외부 라우트 링크 카드)
// ─────────────────────────────────────────────

const MASTER_SECTIONS: { href: string; title: string; desc: string }[] = [
  {
    href: "/admin/masters/topic",
    title: "교회 표어 (올해의 주제)",
    desc: "주보 1페이지 우측에 표시되는 연도 표어 — 예: '복음의 열매'",
  },
  {
    href: "/admin/masters/mokjang",
    title: "소그룹 목장",
    desc: "주보 3페이지 소그룹 목장 표 (목장 번호 / 목자 / 부목자)",
  },
  {
    href: "/admin/masters/servants",
    title: "섬기는 분들",
    desc: "주보 4페이지 좌측 '섬기는 분들' 역할 ↔ 이름",
  },
  {
    href: "/admin/masters/supports",
    title: "우리가 후원하는 분들",
    desc: "주보 4페이지 좌측 '우리가 후원하는 분들' 섹션 (해외·국내·방송 등)",
  },
  {
    href: "/admin/masters/community-prayers",
    title: "교회공동체 기도제목",
    desc: "주보 2페이지 '교회공동체 기도제목' 목록 (최대 7줄)",
  },
];

function MastersTab() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        매주 바뀌지 않고 여러 페이지에서 공용으로 쓰는 값입니다. 카드를 누르면 새 탭에서 열려, 현재 작성 중인 주보를 잃지 않고 편집할 수 있습니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MASTER_SECTIONS.map((s) => (
          <a
            key={s.href}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
          >
            <h3 className="mb-1 text-sm font-semibold text-gray-900">{s.title}</h3>
            <p className="text-xs leading-relaxed text-gray-500">{s.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
