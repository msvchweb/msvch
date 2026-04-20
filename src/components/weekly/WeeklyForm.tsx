"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  DawnReading,
  PrayerItem,
  Announcement,
} from "@/types/notice";
import type { WeeklyContentInput } from "@/lib/validation";

interface Props {
  initial: WeeklyContentInput;
  onSubmit: (data: WeeklyContentInput, publish: boolean) => Promise<void>;
  onGeneratePdf?: () => Promise<void>;
  generatingPdf?: boolean;
  submitting?: boolean;
  weeklyId?: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-800">
      {children}
    </h3>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400";
const inputErrCls =
  "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400";
const textareaCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-y";

function weekOfMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const week = Math.ceil(d.getDate() / 7);
  return ["첫째", "둘째", "셋째", "넷째", "다섯째"][week - 1] ?? `${week}째`;
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
    sermon_pastor: f.sermon_pastor || "이장재",
    closing_hymn: f.closing_hymn || "342",
    weekly_verse: f.weekly_verse || "요한복음 16:33\n이것을 너희에게 이르는 것은 너희로 내 안에서 평안을 누리게 하려 함이라",
    afternoon_service: {
      scripture: f.afternoon_service.scripture || "요한복음 9:20-23",
      title: f.afternoon_service.title || "올바른 진단법",
      pastor: f.afternoon_service.pastor || "이장재",
    },
    wednesday_service: {
      scripture: f.wednesday_service.scripture || "삼상 22:30-37",
      title: f.wednesday_service.title || "세마 가라오수록",
    },
    offering_members: {
      p1: f.offering_members.p1 || "김인경",
      p2: f.offering_members.p2 || "김은순",
      p3: f.offering_members.p3 || "박경진",
    },
    servants_text: f.servants_text || "담 당: 이연재\n사 회: 박기범\n온라인: 홍길동\n반 주: 김성숙\n찬양대: 호산나",
    offering_list_text: f.offering_list_text || "감사헌금: 홍길동 외 다수\n십일조: ...\n잔액: 375,000원 / 누계: 147,234,483원",
  };
}

export function WeeklyForm({
  initial,
  onSubmit,
  onGeneratePdf,
  generatingPdf,
  submitting,
  weeklyId,
}: Props) {
  const [form, setForm] = useState<WeeklyContentInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

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

  // Dawn readings helpers
  function addDawn() {
    set("dawn_readings", [
      ...form.dawn_readings,
      { date: "", passage: "" } satisfies DawnReading,
    ]);
  }
  function updateDawn(i: number, field: keyof DawnReading, value: string) {
    const next = form.dawn_readings.map((d, idx) =>
      idx === i ? { ...d, [field]: value } : d,
    );
    set("dawn_readings", next);
  }
  function removeDawn(i: number) {
    set(
      "dawn_readings",
      form.dawn_readings.filter((_, idx) => idx !== i),
    );
  }

  // Prayer items helpers
  function addPrayer() {
    set("prayer_items", [...form.prayer_items, { text: "" } satisfies PrayerItem]);
  }
  function updatePrayer(i: number, value: string) {
    const next = form.prayer_items.map((p, idx) =>
      idx === i ? { text: value } : p,
    );
    set("prayer_items", next);
  }
  function removePrayer(i: number) {
    set(
      "prayer_items",
      form.prayer_items.filter((_, idx) => idx !== i),
    );
  }

  // Announcements helpers
  function addAnnouncement() {
    set("announcements", [
      ...form.announcements,
      { text: "" } satisfies Announcement,
    ]);
  }
  function updateAnnouncement(i: number, value: string) {
    const next = form.announcements.map((a, idx) =>
      idx === i ? { text: value } : a,
    );
    set("announcements", next);
  }
  function removeAnnouncement(i: number) {
    set(
      "announcements",
      form.announcements.filter((_, idx) => idx !== i),
    );
  }

  async function handleSubmit(publish: boolean) {
    if (publish) {
      const errors: Partial<Record<string, string>> = {};
      if (!form.title.trim()) errors.title = "제목을 입력해주세요";
      if (!form.date) errors.date = "날짜를 선택해주세요";
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        if (errors.title) titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        else if (errors.date) dateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setFieldErrors({});
    await onSubmit(form, publish);
  }

  return (
    <div className="space-y-8">
      {/* ── 1. 기본 정보 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>1. 기본 정보</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Field label="제목" required error={fieldErrors.title}>
            <input
              ref={titleRef}
              className={fieldErrors.title ? inputErrCls : inputCls}
              value={form.title}
              onChange={(e) => { set("title", e.target.value); clearError("title"); }}
              placeholder="2026년 4월 셋째주 주보"
            />
          </Field>
          <Field label="날짜" required error={fieldErrors.date}>
            <input
              ref={dateRef}
              type="date"
              className={fieldErrors.date ? inputErrCls : inputCls}
              value={form.date ?? ""}
              onChange={(e) => { set("date", e.target.value || undefined); clearError("date"); }}
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

      {/* ── 2. 주일예배 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>2. 주일예배</SectionTitle>
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
          <Field label="특별찬양 1부 곡명">
            <input
              className={inputCls}
              value={form.special_praise.part1.song}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part1: { ...form.special_praise.part1, song: e.target.value },
                })
              }
              placeholder="주 예수 나의 산 소망"
            />
          </Field>
          <Field label="특별찬양 1부 찬양대">
            <input
              className={inputCls}
              value={form.special_praise.part1.choir}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part1: {
                    ...form.special_praise.part1,
                    choir: e.target.value,
                  },
                })
              }
              placeholder="호산나 찬양대"
            />
          </Field>
          <Field label="특별찬양 2부 곡명">
            <input
              className={inputCls}
              value={form.special_praise.part2.song}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part2: { ...form.special_praise.part2, song: e.target.value },
                })
              }
              placeholder="이 자리에 나옵니다"
            />
          </Field>
          <Field label="특별찬양 2부 찬양대">
            <input
              className={inputCls}
              value={form.special_praise.part2.choir}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part2: {
                    ...form.special_praise.part2,
                    choir: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label="말씀 제목">
            <input
              className={inputCls}
              value={form.sermon_title}
              onChange={(e) => set("sermon_title", e.target.value)}
              placeholder="세상에서 그리스도인으로 잘 사는 법"
            />
          </Field>
          <Field label="설교자">
            <input
              className={inputCls}
              value={form.sermon_pastor}
              onChange={(e) => set("sermon_pastor", e.target.value)}
              placeholder="이장재"
            />
          </Field>
          <Field label="결단 찬송 번호">
            <input
              className={inputCls}
              value={form.closing_hymn}
              onChange={(e) => set("closing_hymn", e.target.value)}
              placeholder="342"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="입술말씀 (구절 + 본문)">
            <textarea
              className={textareaCls}
              rows={3}
              value={form.weekly_verse}
              onChange={(e) => set("weekly_verse", e.target.value)}
              placeholder="요한복음 16:33&#10;이것을 너희에게 이르는 것은..."
            />
          </Field>
        </div>
      </section>

      {/* ── 3. 섬기는 분들 / 헌금위원 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>3. 섬기는 분들 / 헌금위원</SectionTitle>
        <div className="mb-4">
          <Field label="섬기는 분들 (역할: 이름 형식으로 한 줄씩 입력)">
            <textarea
              className={textareaCls}
              rows={8}
              value={form.servants_text ?? ""}
              onChange={(e) => set("servants_text", e.target.value)}
              placeholder={"담 당: 이연재\n사 회: 박기범\n온라인: 홍길동\n반 주: 김성숙\n찬양대: 호산나"}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="헌금위원 1부">
            <input
              className={inputCls}
              value={form.offering_members.p1}
              onChange={(e) =>
                set("offering_members", {
                  ...form.offering_members,
                  p1: e.target.value,
                })
              }
              placeholder="김인경"
            />
          </Field>
          <Field label="헌금위원 2부">
            <input
              className={inputCls}
              value={form.offering_members.p2}
              onChange={(e) =>
                set("offering_members", {
                  ...form.offering_members,
                  p2: e.target.value,
                })
              }
              placeholder="김은순"
            />
          </Field>
          <Field label="헌금위원 3부">
            <input
              className={inputCls}
              value={form.offering_members.p3}
              onChange={(e) =>
                set("offering_members", {
                  ...form.offering_members,
                  p3: e.target.value,
                })
              }
              placeholder="박경진"
            />
          </Field>
        </div>
      </section>

      {/* ── 4. 오후 찬양예배 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>4. 주일오후 찬양예배</SectionTitle>
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
              placeholder="요한복음 9:20-23"
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
              placeholder="올바른 진단법"
            />
          </Field>
          <Field label="인도자">
            <input
              className={inputCls}
              value={form.afternoon_service.pastor}
              onChange={(e) =>
                set("afternoon_service", {
                  ...form.afternoon_service,
                  pastor: e.target.value,
                })
              }
              placeholder="이장재"
            />
          </Field>
        </div>
      </section>

      {/* ── 5. 수요예배 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>5. 수요예배</SectionTitle>
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
              placeholder="삼상 22:30-37"
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
              placeholder="세마 가라오수록"
            />
          </Field>
        </div>
      </section>

      {/* ── 6. 새벽예배 신앙일기 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>6. 새벽예배 신앙일기 (월~토)</SectionTitle>
        <div className="space-y-2">
          {form.dawn_readings.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={`${inputCls} w-32`}
                value={d.date}
                onChange={(e) => updateDawn(i, "date", e.target.value)}
                placeholder="4월 21일(화)"
              />
              <input
                className={`${inputCls} flex-1`}
                value={d.passage}
                onChange={(e) => updateDawn(i, "passage", e.target.value)}
                placeholder="요한복음 7~8장"
              />
              <button
                type="button"
                onClick={() => removeDawn(i)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addDawn}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus size={14} /> 날짜 추가
          </button>
        </div>
      </section>

      {/* ── 7. 교회공동체 기도제목 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>7. 교회공동체 기도제목</SectionTitle>
        <div className="space-y-2">
          {form.prayer_items.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">{i + 1}.</span>
              <textarea
                className={`${textareaCls} flex-1`}
                rows={2}
                value={p.text}
                onChange={(e) => updatePrayer(i, e.target.value)}
                placeholder="기도 제목을 입력하세요"
              />
              <button
                type="button"
                onClick={() => removePrayer(i)}
                className="mt-2 text-red-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPrayer}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus size={14} /> 기도제목 추가
          </button>
        </div>
      </section>

      {/* ── 8. 공지사항 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>8. 공지사항</SectionTitle>
        <div className="space-y-2">
          {form.announcements.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 text-xs text-gray-400">{i + 1}.</span>
              <textarea
                className={`${textareaCls} flex-1`}
                rows={2}
                value={a.text}
                onChange={(e) => updateAnnouncement(i, e.target.value)}
                placeholder="공지 내용을 입력하세요"
              />
              <button
                type="button"
                onClick={() => removeAnnouncement(i)}
                className="mt-2 text-red-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAnnouncement}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus size={14} /> 공지 추가
          </button>
        </div>
      </section>

      {/* ── 9. 향기로운 예물 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>9. 향기로운 예물</SectionTitle>
        <Field label="헌금 명단 (자유 형식으로 붙여넣기)">
          <textarea
            className={textareaCls}
            rows={6}
            value={form.offering_list_text ?? ""}
            onChange={(e) => set("offering_list_text", e.target.value)}
            placeholder={"감사헌금: 홍길동 외 다수\n십일조: ...\n잔액: 375,000원 / 누계: 147,234,483원"}
          />
        </Field>
      </section>

      {/* ── 10. 발행 설정 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>10. 발행 설정</SectionTitle>
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

      {/* ── 액션 버튼 ── */}
      <div className="flex flex-wrap items-center gap-3 pb-8">
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
