"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyPlaceholderDefaults } from "@/components/weekly/WeeklyForm";
import { WeeklyEditorWithPreview } from "@/components/weekly/WeeklyEditorWithPreview";
import {
  WeeklyContentSchema,
  createEmptyWeeklyInput,
  type WeeklyContentInput,
} from "@/lib/validation";
import type { Weekly, WorshipItemRow } from "@/types/notice";

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getUpcomingSunday(): string {
  const today = new Date();
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + daysUntilSunday);
  return formatLocalDate(sunday);
}

const NTH_WEEK_KO = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];

/** 해당 달의 몇 번째 일요일인지 → "YYYY년 M월 N째주 주보" */
function formatWeeklyTitle(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const target = new Date(y, m - 1, d);
  const firstSundayDate =
    1 + ((7 - new Date(y, m - 1, 1).getDay()) % 7);
  const nth = Math.floor((target.getDate() - firstSundayDate) / 7) + 1;
  const label = NTH_WEEK_KO[nth - 1] ?? `${nth}`;
  return `${y}년 ${m}월 ${label}주 주보`;
}

/**
 * 매주 바뀌는 worship_items 슬롯의 내용 리셋.
 * 인덱스 기준: 5 성시교독 / 6 찬송 / 7 고백과 감사의 기도(assignees) /
 *             9 성경봉독 / 10 찬양(subRows content) / 11 말씀 / 12 결단의 찬송
 */
function resetWeeklyWorshipFields(items: WorshipItemRow[]): WorshipItemRow[] {
  return items.map((item, i) => {
    if (i === 5 || i === 6 || i === 9 || i === 11 || i === 12) {
      return { ...item, content: "" };
    }
    if (i === 7) {
      return { ...item, assignees: item.assignees.map(() => "") };
    }
    if (i === 10) {
      return {
        ...item,
        subRows: item.subRows.map((sr, j) => ({
          ...sr,
          content: `${j + 1}부 :`,
        })),
      };
    }
    return item;
  });
}

/** 최근 주보 → 새 주보용 초기값.
 *  매주 바뀌는 항목(예배순서 일부 / 암송 / 오후예배 / 수요예배 본문 /
 *  다음주기도 / 신앙일기 본문)은 비우고, 그 외는 직전 주의 값을 그대로 가져옴. */
function weeklyToPrefill(w: Weekly): WeeklyContentInput {
  const date = getUpcomingSunday();
  return {
    title: formatWeeklyTitle(date),
    date,
    volume: w.volume,
    issue: typeof w.issue === "number" ? w.issue + 1 : w.issue,
    special_praise: w.special_praise ?? {
      part1: { song: "", choir: "" },
      part2: { song: "", choir: "" },
    },
    sermon_title: w.sermon_title ?? "",
    sermon_pastor: w.sermon_pastor ?? "",
    closing_hymn: w.closing_hymn ?? "",
    // 금주 암송말씀 — 매주 새로 입력
    weekly_verse: "",
    // 주일오후 찬양예배 — 매주 새로 입력
    afternoon_service: { scripture: "", title: "", pastor: "" },
    afternoon_mokjang_mode: w.afternoon_mokjang_mode ?? false,
    wednesday_service: {
      // leader/pastor/hymn/benediction 은 거의 매주 동일 → 유지
      leader: w.wednesday_service?.leader ?? "",
      pastor: w.wednesday_service?.pastor ?? "",
      hymn: w.wednesday_service?.hymn ?? "",
      benediction: w.wednesday_service?.benediction ?? "",
      // 성경봉독·말씀 제목은 매주 새로 입력
      scripture: "",
      title: "",
    },
    // 새벽예배 신앙일기 — 본문(passage) 만 리셋, 날짜 라벨은 어차피 폼에서 새 일주일로 자동 재생성
    dawn_readings: (w.dawn_readings ?? []).map((d) => ({ ...d, passage: "" })),
    offering_members: w.offering_members ?? { p1: "", p2: "", p3: "" },
    is_published: false,
    publish_channels: { website: false, alimtalk: false, instagram: false },
    news: w.news ?? [],
    meetings: w.meetings ?? [],
    north_korea_note: w.north_korea_note ?? "",
    bible_reading: w.bible_reading ?? "",
    new_members: w.new_members ?? [],
    meal_duty_note: w.meal_duty_note ?? "",
    volunteer_note: w.volunteer_note ?? "",
    worship_leader: w.worship_leader ?? "",
    worship_items: resetWeeklyWorshipFields(w.worship_items ?? []),
    // 금주 암송말씀 — 매주 새로 입력
    memorize_verse: { ref: "", text: "" },
    // 다음주기도 3인 — 매주 새로 입력
    next_week_prayer: (w.next_week_prayer ?? []).map(() => ""),
    guide_committee: w.guide_committee ?? [],
    offerings: w.offerings ?? [],
    special_offering: w.special_offering ?? { enabled: false, label: "부활감사" },
    front_toggles: {
      meetings: w.front_toggles?.meetings ?? true,
      bibleReading: w.front_toggles?.bibleReading ?? true,
      newMembers: w.front_toggles?.newMembers ?? true,
      mealDuty: w.front_toggles?.mealDuty ?? true,
      volunteerNote: w.front_toggles?.volunteerNote ?? true,
    },
    week_total: w.week_total ?? "",
    cumulative_total: w.cumulative_total ?? "",
  };
}

function buildEmptyDefault(): WeeklyContentInput {
  const date = getUpcomingSunday();
  return {
    ...createEmptyWeeklyInput(),
    date,
    title: formatWeeklyTitle(date),
  };
}

export default function AdminWeeklyNewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [initial, setInitial] = useState<WeeklyContentInput | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLatest() {
      const { data } = await supabase
        .from("weeklies")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setInitial(data ? weeklyToPrefill(data as Weekly) : buildEmptyDefault());
    }
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(data: WeeklyContentInput, publish: boolean) {
    const parsed = WeeklyContentSchema.safeParse(applyPlaceholderDefaults(data));
    if (!parsed.success) {
      alert("입력 오류: " + parsed.error.issues.map((e) => e.message).join(", "));
      return;
    }

    setSubmitting(true);
    const payload = {
      ...parsed.data,
      is_published: publish || parsed.data.publish_channels.website,
    };

    const { error } = await supabase.from("weeklies").insert(payload);
    if (error) {
      alert("저장 실패: " + error.message);
      setSubmitting(false);
      return;
    }

    router.push("/admin/weeklies");
  }

  if (!initial) {
    return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">새 주보 작성</h1>
        <p className="mt-1 text-sm text-gray-500">
          최근 주보의 내용이 미리 채워져 있습니다. 변경할 부분만 수정하세요.
        </p>
      </div>
      <WeeklyEditorWithPreview
        initial={initial}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
