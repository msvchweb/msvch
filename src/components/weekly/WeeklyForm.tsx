"use client";

import { useRef, useState } from "react";
import type {
  DawnReading,
  PrayerItem,
  Announcement,
  NewsItem,
  MeetingRow,
  NewMemberRow,
  WorshipItemRow,
  WorshipSubRow,
  GuideCommitteeRow,
  OfferingCategoryRow,
} from "@/types/notice";
import type { WeeklyContentInput } from "@/lib/validation";
import { FormTabs, type FormTab } from "./form/FormTabs";
import { DynamicArrayField } from "./form/DynamicArrayField";
import { Field, SectionTitle } from "./form/Field";
import { inputCls, inputErrCls, textareaCls, weekOfMonth } from "./form/shared";

interface Props {
  initial: WeeklyContentInput;
  onSubmit: (data: WeeklyContentInput, publish: boolean) => Promise<void>;
  onGeneratePdf?: () => Promise<void>;
  generatingPdf?: boolean;
  submitting?: boolean;
  weeklyId?: string;
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
      label: "① 기본",
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
      label: "② 주일예배",
      description: "순서지(1페이지 우측) · 암송말씀을 관리합니다.",
      content: <WorshipTab form={form} set={set} />,
    },
    {
      key: "front",
      label: "③ 앞면(교회소식)",
      description: "4페이지(교회소식/모임/새가족/섬기는분들 참고)와 1페이지 일부를 관리합니다.",
      content: <FrontTab form={form} set={set} />,
    },
    {
      key: "back-left",
      label: "④ 뒷면-좌측(오후·수요·새벽)",
      description: "2페이지(뒷면 좌측)의 예배·기도 영역을 관리합니다.",
      content: <BackLeftTab form={form} set={set} />,
    },
    {
      key: "back-right",
      label: "⑤ 뒷면-우측(헌금)",
      description: "3페이지(뒷면 우측)의 향기로운 예물 / 누계를 관리합니다.",
      content: <BackRightTab form={form} set={set} />,
    },
    {
      key: "misc",
      label: "⑥ 기타",
      description: "일반 공지·섬기는분들 텍스트 등 레거시 필드.",
      content: <MiscTab form={form} set={set} />,
    },
  ];

  return (
    <div className="space-y-6">
      <FormTabs tabs={tabs} />

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
//  Tab 2: 주일예배
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
        <SectionTitle>예배 순서 (최대 24개)</SectionTitle>
        <DynamicArrayField<WorshipItemRow>
          label="순서"
          items={form.worship_items}
          max={24}
          addLabel="순서 추가"
          createEmpty={() => ({
            marker: "",
            label: "",
            content: "",
            assignees: [],
            subRows: [],
            emphasize: false,
          })}
          onChange={(next) => set("worship_items", next)}
          renderRow={(it, i, update) => (
            <WorshipItemRowEditor item={it} index={i} update={update} />
          )}
        />
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
          <Field label="설교 제목">
            <input
              className={inputCls}
              value={form.sermon_title}
              onChange={(e) => set("sermon_title", e.target.value)}
            />
          </Field>
          <Field label="설교자">
            <input
              className={inputCls}
              value={form.sermon_pastor}
              onChange={(e) => set("sermon_pastor", e.target.value)}
            />
          </Field>
          <Field label="결단 찬송">
            <input
              className={inputCls}
              value={form.closing_hymn}
              onChange={(e) => set("closing_hymn", e.target.value)}
            />
          </Field>
          <Field label="입술말씀">
            <textarea
              className={textareaCls}
              rows={2}
              value={form.weekly_verse}
              onChange={(e) => set("weekly_verse", e.target.value)}
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
            />
          </Field>
          <Field label="특별찬양 1부 찬양대">
            <input
              className={inputCls}
              value={form.special_praise.part1.choir}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part1: { ...form.special_praise.part1, choir: e.target.value },
                })
              }
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
            />
          </Field>
          <Field label="특별찬양 2부 찬양대">
            <input
              className={inputCls}
              value={form.special_praise.part2.choir}
              onChange={(e) =>
                set("special_praise", {
                  ...form.special_praise,
                  part2: { ...form.special_praise.part2, choir: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function WorshipItemRowEditor({
  item,
  update,
}: {
  item: WorshipItemRow;
  index: number;
  update: (patch: Partial<WorshipItemRow>) => void;
}) {
  const assigneesText = item.assignees.join("\n");
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[5rem_10rem_1fr]">
        <Field label="※ 마커">
          <input
            className={inputCls}
            value={item.marker}
            onChange={(e) => update({ marker: e.target.value })}
            placeholder="※ 또는 공백"
          />
        </Field>
        <Field label="제목">
          <input
            className={inputCls}
            value={item.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="예배의 부름"
          />
        </Field>
        <Field label="내용">
          <input
            className={inputCls}
            value={item.content}
            onChange={(e) => update({ content: e.target.value })}
            placeholder="&quot;하나님은 영이시니...&quot;"
          />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Field label="담당자 (여러 줄 = 여러 명)" hint="예: 1부 문영애 권사\n2부 이기석 집사">
          <textarea
            className={textareaCls}
            rows={2}
            value={assigneesText}
            onChange={(e) =>
              update({
                assignees: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
                  .slice(0, 5),
              })
            }
            placeholder="다함께"
          />
        </Field>
        <Field label="강조">
          <label className="inline-flex h-9 items-center gap-2 px-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={item.emphasize}
              onChange={(e) => update({ emphasize: e.target.checked })}
            />
            <span className="text-xs text-gray-600">굵게</span>
          </label>
        </Field>
      </div>
      {/* subRows (찬양 1부/2부 처럼 nested) */}
      <details className="mt-2 rounded border border-gray-200 p-2">
        <summary className="cursor-pointer text-xs font-semibold text-gray-600">
          세부 행 ({item.subRows.length}/4) — 찬양 항목처럼 병합 표시
        </summary>
        <div className="mt-2 space-y-2">
          {item.subRows.map((sr, j) => (
            <div key={j} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
              <input
                className={inputCls}
                value={sr.content}
                onChange={(e) => {
                  const next = item.subRows.map((s, idx) =>
                    idx === j ? { ...s, content: e.target.value } : s,
                  );
                  update({ subRows: next });
                }}
                placeholder="1부 : 주 예수 나의 산 소망"
              />
              <input
                className={inputCls}
                value={sr.assignee}
                onChange={(e) => {
                  const next = item.subRows.map((s, idx) =>
                    idx === j ? { ...s, assignee: e.target.value } : s,
                  );
                  update({ subRows: next });
                }}
                placeholder="호산나 찬양대"
              />
              <button
                type="button"
                onClick={() =>
                  update({ subRows: item.subRows.filter((_, idx) => idx !== j) })
                }
                className="rounded border border-red-200 px-2 text-xs text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={item.subRows.length >= 4}
            onClick={() => {
              const empty: WorshipSubRow = { content: "", assignee: "" };
              update({ subRows: [...item.subRows, empty] });
            }}
            className="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            + 세부 행 추가
          </button>
        </div>
      </details>
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
        <DynamicArrayField<NewsItem>
          label="교회소식"
          items={form.news}
          max={9}
          addLabel="소식 추가"
          createEmpty={() => ({ title: "", items: [] })}
          onChange={(next) => set("news", next)}
          renderRow={(n, _i, update) => (
            <div className="space-y-2">
              <Field label="제목">
                <input
                  className={inputCls}
                  value={n.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="1. 2026 새생명 마을축제"
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
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>단문 메모</SectionTitle>
        <div className="grid gap-4">
          <Field label="북한선교부 메모" hint="예: * 북한선교부 : 오늘(매 월 셋 째 주) 2부예배후 1층 사무실 안쪽">
            <input
              className={inputCls}
              value={form.north_korea_note}
              onChange={(e) => set("north_korea_note", e.target.value)}
            />
          </Field>
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
        <SectionTitle>다음 주 기도 (1·2·3부, 최대 3개)</SectionTitle>
        <DynamicArrayField<string>
          label="다음주 기도"
          items={form.next_week_prayer}
          max={3}
          addLabel="기도자 추가"
          createEmpty={() => ""}
          onChange={(next) => set("next_week_prayer", next)}
          renderRow={(p, i, update) => (
            <input
              className={inputCls}
              value={p}
              onChange={(e) => {
                const next = [...form.next_week_prayer];
                next[i] = e.target.value;
                set("next_week_prayer", next);
                void update;
              }}
              placeholder={`${i + 1}부 기도자`}
            />
          )}
        />
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
        <SectionTitle>안내위원 (1·2·3부)</SectionTitle>
        <DynamicArrayField<GuideCommitteeRow>
          label="안내위원"
          items={form.guide_committee}
          max={3}
          addLabel="안내 추가"
          createEmpty={() => ({ part: "", indoor: "", outdoor: "" })}
          onChange={(next) => set("guide_committee", next)}
          renderRow={(g, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className={inputCls}
                value={g.part}
                onChange={(e) => update({ part: e.target.value })}
                placeholder="1부"
              />
              <input
                className={inputCls}
                value={g.indoor}
                onChange={(e) => update({ indoor: e.target.value })}
                placeholder="실내 안내자"
              />
              <input
                className={inputCls}
                value={g.outdoor}
                onChange={(e) => update({ outdoor: e.target.value })}
                placeholder="실외 안내자"
              />
            </div>
          )}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>새벽예배 신앙일기 (최대 8줄)</SectionTitle>
        <DynamicArrayField<DawnReading>
          label="새벽 통독"
          items={form.dawn_readings}
          max={8}
          addLabel="날짜 추가"
          createEmpty={() => ({ date: "", passage: "" })}
          onChange={(next) => set("dawn_readings", next)}
          renderRow={(d, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <input
                className={inputCls}
                value={d.date}
                onChange={(e) => update({ date: e.target.value })}
                placeholder="4월 21일(화)"
              />
              <input
                className={inputCls}
                value={d.passage}
                onChange={(e) => update({ passage: e.target.value })}
                placeholder="왕상 9-11장"
              />
            </div>
          )}
        />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Tab 5: 뒷면 우측 (헌금)
// ─────────────────────────────────────────────

function BackRightTab({ form, set }: TabProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>향기로운 예물 (카테고리별, 최대 11개)</SectionTitle>
        <DynamicArrayField<OfferingCategoryRow>
          label="헌금 카테고리"
          items={form.offerings}
          max={11}
          addLabel="카테고리 추가"
          createEmpty={() => ({ label: "", names: "" })}
          onChange={(next) => set("offerings", next)}
          renderRow={(o, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <input
                className={inputCls}
                value={o.label}
                onChange={(e) => update({ label: e.target.value })}
                placeholder="십 일 조"
              />
              <textarea
                className={textareaCls}
                rows={2}
                value={o.names}
                onChange={(e) => update({ names: e.target.value })}
                placeholder={"김철수 이영희\n박민준 최수진"}
              />
            </div>
          )}
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <SectionTitle>누계</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="지난주 헌금 총액">
            <input
              className={inputCls}
              value={form.week_total}
              onChange={(e) => set("week_total", e.target.value)}
              placeholder="0원"
            />
          </Field>
          <Field label="누계">
            <input
              className={inputCls}
              value={form.cumulative_total}
              onChange={(e) => set("cumulative_total", e.target.value)}
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
