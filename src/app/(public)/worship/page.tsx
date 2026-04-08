import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "예배안내" };

interface WorshipInfo {
  name: string;
  time: string;
  day: string;
  location: string;
}

const mainWorship: WorshipInfo[] = [
  { name: "주일예배 1부", time: "오전 8:00", day: "매주 일요일", location: "본당" },
  { name: "주일예배 2부", time: "오전 10:00", day: "매주 일요일", location: "본당" },
  { name: "주일예배 3부", time: "낮 12:00", day: "매주 일요일", location: "본당" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일", location: "본당" },
  { name: "금요기도회", time: "오후 7:30", day: "매주 금요일", location: "본당" },
  { name: "새벽예배", time: "오전 6:00 (토 6:30)", day: "매일 (월~토)", location: "본당" },
];

const schoolWorship: WorshipInfo[] = [
  { name: "영유치부", time: "낮 12:00", day: "매주 일요일", location: "본관 1층" },
  { name: "아동부", time: "오전 10:00", day: "매주 일요일", location: "교육관 2층" },
  { name: "청소년부", time: "낮 12:00", day: "매주 일요일", location: "교육관 3층 갈릴리실" },
  { name: "청년부", time: "오후 2:30", day: "매월 첫째주일", location: "본관 2층" },
];

const specialMeetings: WorshipInfo[] = [
  { name: "토요 노방전도", time: "오후 2:00", day: "매주 토요일", location: "2주년교회" },
];

function WorshipCard({ worship }: { worship: WorshipInfo }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">{worship.name}</h3>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock size={15} className="shrink-0 text-primary-500" />
          <span>{worship.day} {worship.time}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={15} className="shrink-0 text-primary-500" />
          <span>{worship.location}</span>
        </div>
      </div>
    </div>
  );
}

export default function WorshipPage() {
  return (
    <>
      <PageHeader title="예배안내" description="하나님께 드리는 예배에 함께해 주세요" />
      <Container>
        <div className="mx-auto max-w-4xl space-y-10">
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">예배 시간</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">교회학교</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {schoolWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">특별 모임</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {specialMeetings.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
