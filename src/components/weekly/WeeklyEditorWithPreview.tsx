"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import Bulletin from "@/components/bulletin/Bulletin";
import { WeeklyForm, applyPlaceholderDefaults } from "@/components/weekly/WeeklyForm";
import type { WeeklyContentInput } from "@/lib/validation";
import type { BulletinMasterData } from "@/types/bulletin-master";
import type { Weekly } from "@/types/notice";

interface Props {
  initial: WeeklyContentInput;
  onSubmit: (data: WeeklyContentInput, publish: boolean) => Promise<void>;
  onGeneratePdf?: () => Promise<void>;
  generatingPdf?: boolean;
  submitting?: boolean;
  weeklyId?: string;
}

/** WeeklyContentInput → Weekly 변환 (미리보기 전용, DB 미저장 상태 반영) */
function inputToWeekly(input: WeeklyContentInput, weeklyId?: string): Weekly {
  return {
    id: weeklyId ?? "preview",
    title: input.title,
    date: input.date ?? null,
    pdf_url: null,
    created_at: new Date().toISOString(),
    volume: input.volume,
    issue: input.issue,
    hymn_number: input.hymn_number,
    scripture: input.scripture,
    special_praise: input.special_praise,
    sermon_title: input.sermon_title,
    sermon_pastor: input.sermon_pastor,
    closing_hymn: input.closing_hymn,
    weekly_verse: input.weekly_verse,
    afternoon_service: input.afternoon_service,
    wednesday_service: input.wednesday_service,
    dawn_readings: input.dawn_readings,
    offering_members: input.offering_members,
    prayer_items: input.prayer_items,
    announcements: input.announcements,
    servants_text: input.servants_text,
    offering_list_text: input.offering_list_text,
    is_published: input.is_published,
    publish_channels: input.publish_channels,
    news: input.news,
    meetings: input.meetings,
    north_korea_note: input.north_korea_note,
    bible_reading: input.bible_reading,
    new_members: input.new_members,
    meal_duty_note: input.meal_duty_note,
    volunteer_note: input.volunteer_note,
    worship_leader: input.worship_leader,
    worship_items: input.worship_items,
    memorize_verse: input.memorize_verse,
    next_week_prayer: input.next_week_prayer,
    guide_committee: input.guide_committee,
    offerings: input.offerings,
    week_total: input.week_total,
    cumulative_total: input.cumulative_total,
  };
}

export function WeeklyEditorWithPreview({
  initial,
  onSubmit,
  onGeneratePdf,
  generatingPdf,
  submitting,
  weeklyId,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<WeeklyContentInput>(initial);
  const [master, setMaster] = useState<BulletinMasterData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBulletinMaster(supabase).then((m) => {
      if (!cancelled) setMaster(m);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const previewWeekly = useMemo(
    () => inputToWeekly(applyPlaceholderDefaults(form), weeklyId),
    [form, weeklyId],
  );

  return (
    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <WeeklyForm
          initial={initial}
          onSubmit={onSubmit}
          onGeneratePdf={onGeneratePdf}
          generatingPdf={generatingPdf}
          submitting={submitting}
          weeklyId={weeklyId}
          onFormChange={setForm}
        />
      </div>
      <div className="min-w-0">
        <div className="sticky top-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">실시간 미리보기</h2>
            <span className="text-xs text-gray-400">입력하는 내용이 즉시 반영됩니다</span>
          </div>
          {master ? (
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
              <div className="origin-top-left scale-[0.72] xl:scale-[0.85]" style={{ transformOrigin: "top left" }}>
                <Bulletin weekly={previewWeekly} master={master} mode="web" />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-400">
              마스터 데이터 로드 중...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
