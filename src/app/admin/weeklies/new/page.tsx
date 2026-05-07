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
import type { Weekly } from "@/types/notice";

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

/** 최근 주보 → 새 주보용 초기값. date/title/publish 관련 필드만 리셋. */
function weeklyToPrefill(w: Weekly): WeeklyContentInput {
  const date = getUpcomingSunday();
  return {
    title: formatWeeklyTitle(date),
    date,
    volume: w.volume,
    issue: w.issue,
    special_praise: w.special_praise ?? {
      part1: { song: "", choir: "" },
      part2: { song: "", choir: "" },
    },
    sermon_title: w.sermon_title ?? "",
    sermon_pastor: w.sermon_pastor ?? "",
    closing_hymn: w.closing_hymn ?? "",
    weekly_verse: w.weekly_verse ?? "",
    afternoon_service: w.afternoon_service ?? {
      scripture: "",
      title: "",
      pastor: "",
    },
    afternoon_mokjang_mode: w.afternoon_mokjang_mode ?? false,
    wednesday_service: {
      leader: w.wednesday_service?.leader ?? "",
      scripture: w.wednesday_service?.scripture ?? "",
      title: w.wednesday_service?.title ?? "",
      pastor: w.wednesday_service?.pastor ?? "",
      hymn: w.wednesday_service?.hymn ?? "",
      benediction: w.wednesday_service?.benediction ?? "",
    },
    dawn_readings: w.dawn_readings ?? [],
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
    worship_items: w.worship_items ?? [],
    memorize_verse: w.memorize_verse ?? { ref: "", text: "" },
    next_week_prayer: w.next_week_prayer ?? [],
    guide_committee: w.guide_committee ?? [],
    offerings: w.offerings ?? [],
    special_offering: w.special_offering ?? { enabled: false, label: "부활감사" },
    front_toggles: w.front_toggles ?? {
      bibleReading: true,
      newMembers: true,
      mealDuty: true,
      volunteerNote: true,
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
