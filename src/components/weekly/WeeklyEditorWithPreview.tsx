"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import {
  BulletinFrontLeft,
  BulletinFrontRight,
  weeklyToFrontData,
} from "@/components/bulletin/BulletinFront";
import {
  BulletinBackLeft,
  BulletinBackRight,
  weeklyToBackData,
} from "@/components/bulletin/BulletinBack";
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

/** WeeklyContentInput → Weekly 변환 (미리보기 전용) */
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

/**
 * 한 페이지 카드: 컨테이너 폭에 맞춰 자동 축소 렌더링.
 * 내부 자연 폭은 designWidth 이며 ResizeObserver 로 스케일을 계산한다.
 * transform-origin: top left 이므로 래퍼 높이도 스케일에 비례해 설정.
 */
function PreviewPage({
  page,
  designWidth = 520,
  children,
}: {
  page: number;
  designWidth?: number;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const w = outer.clientWidth;
      const s = Math.min(1, w / designWidth);
      // offsetHeight 는 CSS transform 의 영향을 받지 않으므로 자연 높이를 돌려준다
      const naturalH = inner.offsetHeight;
      setScale(s);
      setInnerH(naturalH * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      <div className="bg-gray-700 px-3 py-1 text-xs font-semibold text-white">
        페이지 {page}
      </div>
      <div ref={outerRef} className="relative w-full overflow-hidden" style={{ height: innerH ?? undefined }}>
        <div
          ref={innerRef}
          style={{
            width: designWidth,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="bg-white p-3 text-[10px] leading-tight text-gray-800"
        >
          {children}
        </div>
      </div>
    </div>
  );
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
  const frontData = useMemo(
    () => (master ? weeklyToFrontData(previewWeekly, master) : null),
    [previewWeekly, master],
  );
  const backData = useMemo(
    () => (master ? weeklyToBackData(previewWeekly, master) : null),
    [previewWeekly, master],
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
            <span className="text-xs text-gray-400">페이지 1 → 4 순서 (세로 스크롤)</span>
          </div>
          {frontData && backData ? (
            <div className="max-h-[calc(100vh-6rem)] space-y-3 overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-gray-100 p-3">
              <PreviewPage page={1}>
                <BulletinFrontRight data={frontData} />
              </PreviewPage>
              <PreviewPage page={2}>
                <BulletinBackLeft data={backData} />
              </PreviewPage>
              <PreviewPage page={3}>
                <BulletinBackRight data={backData} />
              </PreviewPage>
              <PreviewPage page={4}>
                <BulletinFrontLeft data={frontData} />
              </PreviewPage>
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
