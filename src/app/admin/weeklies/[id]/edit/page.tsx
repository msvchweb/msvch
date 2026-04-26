"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyPlaceholderDefaults } from "@/components/weekly/WeeklyForm";
import { WeeklyEditorWithPreview } from "@/components/weekly/WeeklyEditorWithPreview";
import { WeeklyContentSchema, type WeeklyContentInput } from "@/lib/validation";
import type { Weekly } from "@/types/notice";

function weeklyToFormData(w: Weekly): WeeklyContentInput {
  return {
    title: w.title,
    date: w.date ?? undefined,
    volume: w.volume,
    issue: w.issue,
    hymn_number: w.hymn_number ?? "",
    scripture: w.scripture ?? "",
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
    wednesday_service: w.wednesday_service ?? { scripture: "", title: "" },
    dawn_readings: w.dawn_readings ?? [],
    offering_members: w.offering_members ?? { p1: "", p2: "", p3: "" },
    prayer_items: w.prayer_items ?? [],
    announcements: w.announcements ?? [],
    servants_text: w.servants_text ?? "",
    offering_list_text: w.offering_list_text ?? "",
    is_published: w.is_published,
    publish_channels: w.publish_channels ?? {
      website: false,
      alimtalk: false,
      instagram: false,
    },
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
    week_total: w.week_total ?? "",
    cumulative_total: w.cumulative_total ?? "",
  };
}

export default function AdminWeeklyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("weeklies")
        .select("*")
        .eq("id", id)
        .single();
      setWeekly((data as Weekly) ?? null);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

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

    const { error } = await supabase
      .from("weeklies")
      .update(payload)
      .eq("id", id);

    if (error) {
      alert("저장 실패: " + error.message);
      setSubmitting(false);
      return;
    }

    router.push("/admin/weeklies");
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/weeklies/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyId: id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert("PDF 생성 실패: " + (err.error ?? "알 수 없는 오류"));
      } else {
        const result = await res.json() as { pdfUrl: string };
        alert("PDF가 생성되었습니다. 미리보기: " + result.pdfUrl);
      }
    } catch {
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">로딩 중...</div>
    );
  }

  if (!weekly) {
    return (
      <div className="py-12 text-center text-gray-400">
        주보를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">주보 수정</h1>
        <p className="mt-1 text-sm text-gray-500">{weekly.title}</p>
      </div>
      <WeeklyEditorWithPreview
        initial={weeklyToFormData(weekly)}
        onSubmit={handleSubmit}
        onGeneratePdf={handleGeneratePdf}
        generatingPdf={generatingPdf}
        submitting={submitting}
        weeklyId={id}
      />
    </div>
  );
}
