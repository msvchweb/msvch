"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, FileUp, ImagePlus, X, Loader2 } from "lucide-react";
import type {
  NewsItem,
  MeetingRow,
  NewMemberRow,
  WorshipItemRow,
  WorshipSubRow,
} from "@/types/notice";
import {
  type WeeklyContentInput,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
  MAX_WEEKLY_PHOTOS,
  validateFile,
} from "@/lib/validation";
import { uploadToR2 } from "@/lib/r2/upload-client";
import {
  compressImage,
  toWebImage,
  WEEKLY_PHOTO_PRESET,
} from "@/lib/image-compress";
import { EventExtractionModal } from "@/components/admin/event-extraction/EventExtractionModal";
import { WeeklyImportModal } from "@/components/admin/weekly-import/WeeklyImportModal";
import { FormTabs, type FormTab } from "./form/FormTabs";
import { DynamicArrayField } from "./form/DynamicArrayField";
import { TopicEditor } from "./masters/TopicEditor";
import { MokjangEditor } from "./masters/MokjangEditor";
import { ServantsEditor } from "./masters/ServantsEditor";
import { SupportsEditor } from "./masters/SupportsEditor";
import { CommunityPrayersEditor } from "./masters/CommunityPrayersEditor";
import { MobileBulletinEditorLoader } from "./mobile/MobileBulletinEditorLoader";
import { rebaseMobileServices } from "@/lib/mobile-bulletin";
import { Field, SectionTitle } from "./form/Field";
import { inputCls, inputErrCls, textareaCls, weekOfMonth, stripLeadingNumber } from "./form/shared";
import {
  WORSHIP_ITEMS_TEMPLATE,
  WORSHIP_SLOT_HINTS,
  OFFERING_CATEGORIES,
  SPECIAL_OFFERING_INDEX,
  NEXT_WEEK_PRAYER_PARTS,
  GUIDE_COMMITTEE_PARTS,
  DAWN_WEEKDAY_LABELS,
  emptyOfferings,
  emptyWorshipItems,
  emptyGuideCommittee,
  emptyNextWeekPrayer,
  buildDawnReadings,
} from "./form/constants";

/** 이미지형 주보 사진 업로드 — 절대 상한(브라우저 OOM 방지) */
const PHOTO_HARD_MAX = 50 * 1024 * 1024; // 50MB 절대 상한

interface Props {
  initial: WeeklyContentInput;
  onSubmit: (data: WeeklyContentInput, publish: boolean) => Promise<void>;
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

/** 입력란 + 표시 토글 묶음. 토글 OFF 시 input 비활성화 + 안내 문구. */
function ToggleableInput({
  label,
  hint,
  enabled,
  onToggle,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-gray-600">{label}</label>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>주보에 표시</span>
        </label>
      </div>
      <input
        className={`${inputCls} ${!enabled ? "bg-gray-50 text-gray-400" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled}
      />
      {hint && enabled && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {!enabled && (
        <p className="mt-1 text-xs text-amber-600">
          이번 주는 주보에 표시되지 않습니다 (입력은 보존됩니다).
        </p>
      )}
    </div>
  );
}

/**
 * "1부 홍성란 권사" 처럼 접두가 붙어 저장된 값에서 표시용으로 접두를 떼낸다.
 * 폼 입력은 이름만 받고 저장 시 접두를 다시 붙이기 위한 짝꿍 함수.
 * 접두가 없으면 원본을 그대로 돌려준다(legacy 데이터 호환).
 */
function stripPartPrefix(value: string, part: string): string {
  if (!value) return "";
  const withSpace = `${part} `;
  if (value.startsWith(withSpace)) return value.slice(withSpace.length);
  if (value === part) return "";
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
      leader: f.wednesday_service.leader,
      scripture: f.wednesday_service.scripture,
      title: f.wednesday_service.title,
      pastor: f.wednesday_service.pastor,
      hymn: f.wednesday_service.hymn,
      benediction: f.wednesday_service.benediction,
    },
    offering_members: {
      p1: f.offering_members.p1,
      p2: f.offering_members.p2,
      p3: f.offering_members.p3,
    },
  };
}

export function WeeklyForm({
  initial,
  onSubmit,
  submitting,
  weeklyId,
  onFormChange,
  onTabChange,
}: Props) {
  const [form, setForm] = useState<WeeklyContentInput>(() => normalizeFixedSlots(initial));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [showImport, setShowImport] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // ── 이미지형 주보 사진 업로드 (마이그 040) ─────────────────
  const [photoUploading, setPhotoUploading] = useState(false);
  // 신규 작성 시 weeklyId 가 아직 없으므로, 마운트 시 1회 생성한 UUID 를 업로드 디렉토리로 사용
  const [draftId] = useState(() => crypto.randomUUID());
  const photoFileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = form.photo_images;
    if (current.length + files.length > MAX_WEEKLY_PHOTOS) {
      alert(`사진은 최대 ${MAX_WEEKLY_PHOTOS}장까지 첨부할 수 있습니다.`);
      return;
    }
    setPhotoUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const baseCheck = validateFile(file, ALLOWED_IMAGE_EXTENSIONS, PHOTO_HARD_MAX);
        if (!baseCheck.ok) {
          alert(`${file.name}: ${baseCheck.reason}`);
          continue;
        }

        // 저장 시점이 유일한 최적화 지점이다 (Vercel 이미지 최적화를 쓰지 않음).
        // 주보는 확대 판독이 되어야 하므로 2400px 를 유지한다.
        let toUpload: Blob = file;
        let uploadName = file.name;
        const web = await toWebImage(file, WEEKLY_PHOTO_PRESET);
        if (web) {
          toUpload = web;
          uploadName = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
        } else if (file.size > MAX_BLOG_IMAGE_SIZE) {
          // webp 변환이 안 되는 브라우저·이미지 → 기존 JPEG 압축 경로로 폴백
          try {
            const result = await compressImage(file, MAX_BLOG_IMAGE_SIZE);
            toUpload = result.file;
            uploadName = result.file.name;
          } catch (e) {
            const reason = e instanceof Error ? e.message : "압축 실패";
            alert(`${file.name}: ${reason}`);
            continue;
          }
        }

        try {
          const uploaded = await uploadToR2({
            file: toUpload,
            filename: uploadName,
            prefix: "weeklies",
            scope: ["photos", draftId],
          });
          newUrls.push(uploaded.publicUrl);
        } catch (e) {
          alert(`${file.name}: ${e instanceof Error ? e.message : "업로드 실패"}`);
          continue;
        }
      }
      if (newUrls.length > 0) {
        setForm((prev) => ({
          ...prev,
          photo_images: [...prev.photo_images, ...newUrls],
        }));
      }
    } finally {
      setPhotoUploading(false);
      if (photoFileRef.current) photoFileRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    // 폼 상태에서만 제거. Storage 객체 즉시 삭제는 하지 않음(미저장 취소·되돌리기 대비, 고아 객체 허용).
    setForm((prev) => ({
      ...prev,
      photo_images: prev.photo_images.filter((_, i) => i !== idx),
    }));
  }

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
    setForm((prev) => {
      if (key === "date" && prev.date && value && value !== prev.date) {
        return {
          ...prev,
          [key]: value,
          mobile_services: rebaseMobileServices(prev.mobile_services, prev.date, value as string),
        };
      }
      return { ...prev, [key]: value };
    });
  }

  /**
   * HWP/HWPX 검수 모달이 채워 보낸 patch 를 form 에 병합한다.
   * normalizeFixedSlots 가 고정 슬롯(예배순서·헌금·새벽·안내·다음주기도) 길이를 다시 맞춰 줘
   * 부분 patch 가 들어와도 폼이 깨지지 않는다.
   */
  function applyImportPatch(patch: Partial<WeeklyContentInput>) {
    setForm((prev) => normalizeFixedSlots({ ...prev, ...patch }));
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
      key: "mobile",
      label: "모바일 주보",
      description: "예배별 모바일 순서·라이브·지난 설교·상세자료를 관리합니다.",
      content: <MobileBulletinEditorLoader value={form.mobile_services} weekly={form} onChange={(mobile_services) => set("mobile_services", mobile_services)} />,
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
      content: <FrontTab form={form} set={set} weeklyId={weeklyId} />,
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
      {/* ─── 한컴 주보 파일에서 자동 채우기 ──────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            📄 주보 파일에서 자동 채우기 (베타)
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            한컴 .hwp / .hwpx 파일을 올리면 표·교회소식·정기모임을 자동 추출해 폼에 채웁니다.
            검수 후 적용되며, 저장은 직접 눌러야 발행됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
        >
          <FileUp size={14} />
          파일에서 채우기
        </button>
      </div>

      <WeeklyImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onApply={(patch) => applyImportPatch(patch)}
      />

      {/* ─── 사진으로 주보 올리기 (이미지형 주보) ──────────────── */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-900">
              🖼️ 사진으로 주보 올리기
            </p>
            <p className="mt-0.5 text-xs text-sky-800/80">
              주보 사진(여러 장)을 올리면 공개 웹 상세 페이지에 사진이 그대로 표시됩니다.
              <strong> 사진이 있으면 공개 페이지에서 사진이 우선 표시됩니다.</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            disabled={photoUploading || form.photo_images.length >= MAX_WEEKLY_PHOTOS}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {photoUploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ImagePlus size={14} />
            )}
            사진 추가 ({form.photo_images.length}/{MAX_WEEKLY_PHOTOS})
          </button>
        </div>
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handlePhotoFiles(e.target.files)}
        />
        {form.photo_images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {form.photo_images.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`주보 사진 ${i + 1}`}
                  className="aspect-square w-full rounded-lg border border-sky-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white"
                  aria-label="사진 제거"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <FormTabs tabs={tabs} onActiveChange={onTabChange} />

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6 pb-8">
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
  const quoteContent = !!hint.quoteContent;

  const hasSubRows = !!(subRowLabels && subRowLabels.length > 0);
  const hasAssigneeInputs =
    (assigneeLabels && assigneeLabels.length > 0) || item.assignees.length > 0;

  const contentDisplay = quoteContent
    ? item.content.replace(/^"+/, "").replace(/"+$/, "")
    : item.content;

  const assigneeNode =
    assigneeLabels && assigneeLabels.length > 0 ? (
      <div
        className={`grid gap-2 ${
          assigneeLabels.length >= 3
            ? "sm:grid-cols-3"
            : assigneeLabels.length === 2
            ? "sm:grid-cols-2"
            : ""
        }`}
      >
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
    );

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-block w-6 text-center text-sm font-semibold text-gray-500">
          {item.marker || "·"}
        </span>
        <span className="text-sm font-semibold text-gray-800">{item.label}</span>
      </div>

      {/* 내용 + 담당 한 줄 배치 (subRows 가 있는 행 — 찬양 — 은 내용 입력 생략) */}
      {hasSubRows ? (
        assigneeNode
      ) : (
        <div
          className={
            hasAssigneeInputs
              ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              : ""
          }
        >
          <Field label="내용">
            <input
              className={inputCls}
              value={contentDisplay}
              onChange={(e) => {
                const raw = e.target.value;
                onUpdate({
                  content: quoteContent && raw ? `"${raw}"` : raw,
                });
              }}
              placeholder={
                quoteContent
                  ? "예: 구원의 길 (저장 시 자동으로 큰따옴표가 붙습니다)"
                  : "빈 칸으로 두면 주보에 공백으로 표시됩니다"
              }
            />
          </Field>
          {assigneeNode}
        </div>
      )}

      {/* subRows: 찬양(1부/2부) 등. "1부 :" / "2부 :" 접두사 자동 부여 */}
      {hasSubRows && (
        <div className="mt-2 grid gap-2">
          {subRowLabels!.map((lb, j) => {
            const sr: WorshipSubRow = item.subRows[j] ?? { content: "", assignee: "" };
            const partLabel = `${j + 1}부`;
            const stripRe = new RegExp(`^\\s*${partLabel}\\s*:\\s*`);
            const songValue = sr.content.replace(stripRe, "");
            return (
              <div key={j} className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr] items-center">
                <span className="text-xs font-medium text-gray-600">{lb}</span>
                <input
                  className={inputCls}
                  value={songValue}
                  onChange={(e) => {
                    const next = [...item.subRows];
                    while (next.length <= j) next.push({ content: "", assignee: "" });
                    const song = e.target.value;
                    next[j] = {
                      ...next[j],
                      content: song ? `${partLabel} : ${song}` : `${partLabel} :`,
                    };
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

function FrontTab({
  form,
  set,
  weeklyId,
}: TabProps & { weeklyId?: string }) {
  const [showExtractor, setShowExtractor] = useState(false);

  return (
    <div className="space-y-6">
      {/* ─── AI 일정 추출 트리거 ──────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary-900">
            📅 교회소식에서 일정 자동 추출 (AI)
          </p>
          <p className="mt-0.5 text-xs text-primary-700/80">
            저장된 교회소식·모임 안내를 분석해 캘린더 일정 후보를 제안합니다.
            검수 후 선택한 항목만 등록됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowExtractor(true)}
          disabled={!weeklyId}
          title={
            weeklyId
              ? "AI 가 교회소식을 분석합니다"
              : "먼저 임시저장하면 사용할 수 있습니다"
          }
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:bg-gray-300"
        >
          <Sparkles size={14} />
          AI 일정 추출
        </button>
      </div>

      {showExtractor && weeklyId && (
        <EventExtractionModal
          weeklyId={weeklyId}
          onClose={() => setShowExtractor(false)}
        />
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>교회소식 (최대 20개)</SectionTitle>
        <p className="mb-3 text-xs text-gray-500">
          번호(1./2./...)는 자동으로 매겨집니다. 제목만 입력하세요.
          항목이 많으면 인쇄용 주보 4페이지 영역을 넘어갈 수 있습니다.
        </p>
        <DynamicArrayField<NewsItem>
          label="교회소식"
          items={form.news}
          max={20}
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>모임 안내 (최대 6개)</SectionTitle>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.front_toggles.meetings}
              onChange={(e) =>
                set("front_toggles", {
                  ...form.front_toggles,
                  meetings: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>주보에 표시</span>
          </label>
        </div>
        {!form.front_toggles.meetings && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이번 주는 주보에 모임 안내가 표시되지 않습니다 (입력은 보존됩니다).
          </p>
        )}
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
          <ToggleableInput
            label="성경 통독 현황"
            hint="예: * 6독 - 조성희,  10독 - 장정자"
            enabled={form.front_toggles.bibleReading}
            onToggle={(v) =>
              set("front_toggles", { ...form.front_toggles, bibleReading: v })
            }
            value={form.bible_reading}
            onChange={(v) => set("bible_reading", v)}
          />
          <ToggleableInput
            label="식당 봉사 메모"
            enabled={form.front_toggles.mealDuty}
            onToggle={(v) =>
              set("front_toggles", { ...form.front_toggles, mealDuty: v })
            }
            value={form.meal_duty_note}
            onChange={(v) => set("meal_duty_note", v)}
          />
          <ToggleableInput
            label="봉사센터 소식"
            enabled={form.front_toggles.volunteerNote}
            onToggle={(v) =>
              set("front_toggles", { ...form.front_toggles, volunteerNote: v })
            }
            value={form.volunteer_note}
            onChange={(v) => set("volunteer_note", v)}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>지난 주일 등록 새가족 (최대 4명)</SectionTitle>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.front_toggles.newMembers}
              onChange={(e) =>
                set("front_toggles", {
                  ...form.front_toggles,
                  newMembers: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>주보에 표시</span>
          </label>
        </div>
        {!form.front_toggles.newMembers && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이번 주는 주보에 표시되지 않습니다 (입력은 보존됩니다).
          </p>
        )}
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>주일오후 찬양예배</SectionTitle>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.afternoon_mokjang_mode}
              onChange={(e) => set("afternoon_mokjang_mode", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>목장모임으로 대체</span>
          </label>
        </div>
        {form.afternoon_mokjang_mode ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            이번 주는 주일오후 찬양예배 자리에 <strong>목장모임</strong> 이미지가 표시됩니다.
            성경봉독·말씀·설교자 입력은 무시됩니다.
          </p>
        ) : (
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
            <Field label="말씀 제목" hint='저장 시 자동으로 큰따옴표("")가 붙습니다.'>
              <input
                className={inputCls}
                value={form.afternoon_service.title.replace(/^"+/, "").replace(/"+$/, "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  set("afternoon_service", {
                    ...form.afternoon_service,
                    title: raw ? `"${raw}"` : "",
                  });
                }}
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
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>수요예배</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="인도자">
            <input
              className={inputCls}
              value={form.wednesday_service.leader}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  leader: e.target.value,
                })
              }
              placeholder="이양재 목사"
            />
          </Field>
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
              placeholder="삼하 22:30-37"
            />
          </Field>
          <Field label="말씀 제목" hint='저장 시 자동으로 큰따옴표("")가 붙습니다.'>
            <input
              className={inputCls}
              value={form.wednesday_service.title.replace(/^"+/, "").replace(/"+$/, "")}
              onChange={(e) => {
                const raw = e.target.value;
                set("wednesday_service", {
                  ...form.wednesday_service,
                  title: raw ? `"${raw}"` : "",
                });
              }}
              placeholder="세월 지나갈수록"
            />
          </Field>
          <Field label="설교자">
            <input
              className={inputCls}
              value={form.wednesday_service.pastor}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  pastor: e.target.value,
                })
              }
              placeholder="이양재 목사"
            />
          </Field>
          <Field label="찬송">
            <input
              className={inputCls}
              value={form.wednesday_service.hymn}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  hymn: e.target.value,
                })
              }
              placeholder="384장"
            />
          </Field>
          <Field label="축도">
            <input
              className={inputCls}
              value={form.wednesday_service.benediction}
              onChange={(e) =>
                set("wednesday_service", {
                  ...form.wednesday_service,
                  benediction: e.target.value,
                })
              }
              placeholder="인도자"
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
            const isSpecial = i === SPECIAL_OFFERING_INDEX;
            const so = form.special_offering;
            return (
              <div key={label} className="grid gap-2 sm:grid-cols-[8rem_1fr] items-start">
                {isSpecial ? (
                  <div className="space-y-1.5 pt-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={so.enabled}
                        onChange={(e) =>
                          set("special_offering", { ...so, enabled: e.target.checked })
                        }
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>특별헌금</span>
                    </label>
                    {so.enabled && (
                      <input
                        className="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={so.label}
                        onChange={(e) =>
                          set("special_offering", { ...so, label: e.target.value })
                        }
                        placeholder="부활감사"
                      />
                    )}
                  </div>
                ) : (
                  <span className="pt-2 text-sm font-semibold text-gray-700">{label}</span>
                )}
                {isSpecial && !so.enabled ? (
                  <p className="pt-2 text-xs text-gray-400">
                    토글을 켜면 입력란이 활성화되고 주보에 표시됩니다.
                  </p>
                ) : (
                  <textarea
                    className={textareaCls}
                    rows={2}
                    value={row.names}
                    onChange={(e) => {
                      const next = [...form.offerings];
                      while (next.length <= i)
                        next.push({ label: OFFERING_CATEGORIES[next.length], names: "" });
                      next[i] = { label, names: e.target.value };
                      set("offerings", next);
                    }}
                    placeholder={"김철수 이영희\n박민준 최수진"}
                  />
                )}
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
//  Tab 6: 주보 마스터 (인라인 편집)
// ─────────────────────────────────────────────

const MASTER_SECTIONS: {
  key: string;
  title: string;
  desc: string;
  Editor: React.ComponentType;
}[] = [
  {
    key: "topic",
    title: "교회 표어 (올해의 주제)",
    desc: "주보 1페이지 우측에 표시되는 연도 표어 — 예: '복음의 열매'",
    Editor: TopicEditor,
  },
  {
    key: "community-prayers",
    title: "교회공동체 기도제목",
    desc: "주보 2페이지 '교회공동체 기도제목' 목록 (최대 7줄)",
    Editor: CommunityPrayersEditor,
  },
  {
    key: "mokjang",
    title: "소그룹 목장",
    desc: "주보 3페이지 소그룹 목장 표 (목장 번호 / 목자 / 부목자)",
    Editor: MokjangEditor,
  },
  {
    key: "servants",
    title: "섬기는 분들",
    desc: "주보 4페이지 좌측 '섬기는 분들' 역할 ↔ 이름",
    Editor: ServantsEditor,
  },
  {
    key: "supports",
    title: "우리가 후원하는 분들",
    desc: "주보 4페이지 좌측 '우리가 후원하는 분들' 섹션 (해외·국내·방송 등)",
    Editor: SupportsEditor,
  },
];

function MastersTab() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        매주 바뀌지 않고 여러 페이지에서 공용으로 쓰는 값입니다. 항목을 펼쳐 바로 수정할 수 있습니다.
      </p>
      <div className="space-y-2">
        {MASTER_SECTIONS.map(({ key, title, desc, Editor }) => {
          const open = openKey === key;
          return (
            <div
              key={key}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{desc}</p>
                </div>
                <span
                  className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {open && (
                <div className="border-t border-gray-100 p-4">
                  <Editor />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
