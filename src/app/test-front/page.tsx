"use client";
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
import type { Weekly } from "@/types/notice";

const dummyWeekly: Weekly = {
  id: "preview",
  title: "2026년 4월 셋째주 주보",
  date: "2026-04-19",
  pdf_url: null,
  created_at: new Date().toISOString(),
  volume: 47,
  issue: 16,
  special_praise: { part1: { song: "", choir: "" }, part2: { song: "", choir: "" } },
  sermon_title: null,
  sermon_pastor: null,
  closing_hymn: null,
  weekly_verse: null,
  afternoon_service: { scripture: "", title: "", pastor: "" },
  afternoon_mokjang_mode: false,
  wednesday_service: {
    leader: "",
    scripture: "",
    title: "",
    pastor: "",
    hymn: "",
    benediction: "",
  },
  dawn_readings: [],
  offering_members: { p1: "", p2: "", p3: "" },
  is_published: false,
  publish_channels: { website: false, alimtalk: false, instagram: false },
  news: [],
  meetings: [],
  north_korea_note: null,
  bible_reading: null,
  new_members: [],
  meal_duty_note: null,
  volunteer_note: null,
  worship_leader: null,
  worship_items: [],
  memorize_verse: { ref: "", text: "" },
  next_week_prayer: [],
  guide_committee: [],
  offerings: [],
  special_offering: { enabled: false, label: "부활감사" },
  front_toggles: {
    bibleReading: true,
    newMembers: true,
    mealDuty: true,
    volunteerNote: true,
  },
  week_total: null,
  cumulative_total: null,
};

export default function TestFrontPage() {
  const frontData = weeklyToFrontData(dummyWeekly);
  const backData = weeklyToBackData(dummyWeekly);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 0; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { background: white !important; }
          body > *:not(main) { display: none !important; }
          main { padding-bottom: 0 !important; }
          .no-print { display: none !important; }
          .print-outer {
            background: white !important;
            display: block !important;
            padding: 0 !important;
            gap: 0 !important;
            min-height: unset !important;
          }
          .print-page {
            break-after: page;
            zoom: 1.11 !important;
            box-shadow: none !important;
          }
          .print-page:last-child {
            break-after: avoid !important;
          }
        }
      `}</style>

      <button
        className="no-print fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded shadow"
        onClick={() => window.print()}
      >
        PDF 출력
      </button>

      <div className="print-outer bg-gray-200 min-h-screen py-8 flex flex-col items-center gap-10">
        {/* 페이지 1: 앞면 우측 */}
        <PageFrame>
          <div className="bg-white text-gray-800 text-[10px] leading-tight p-4">
            <BulletinFrontRight data={frontData} />
          </div>
        </PageFrame>

        {/* 페이지 2: 뒷면 좌측 */}
        <PageFrame>
          <div className="bg-white text-gray-800 text-[11px] leading-tight p-4">
            <BulletinBackLeft data={backData} />
          </div>
        </PageFrame>

        {/* 페이지 3: 뒷면 우측 */}
        <PageFrame>
          <div className="bg-white text-gray-800 text-[11px] leading-tight p-4">
            <BulletinBackRight data={backData} />
          </div>
        </PageFrame>

        {/* 페이지 4: 앞면 좌측 */}
        <PageFrame>
          <div className="bg-white text-gray-800 text-[10px] leading-tight p-4">
            <BulletinFrontLeft data={frontData} />
          </div>
        </PageFrame>
      </div>
    </>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-page bg-white shadow-lg overflow-hidden" style={{ width: "133mm", minHeight: "189mm" }}>
      {children}
    </div>
  );
}
