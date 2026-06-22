import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Clock, MapPin, Users } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "예배안내" };

interface WorshipInfo {
  name: string;
  time: string;
  day: string;
  location: string;
  accent: string;
}

const mainWorship: WorshipInfo[] = [
  { name: "주일예배 1부", time: "오전 8:00", day: "매주 일요일", location: "본당", accent: "from-primary-500 to-primary-700" },
  { name: "주일예배 2부", time: "오전 10:00", day: "매주 일요일", location: "본당", accent: "from-primary-500 to-primary-700" },
  { name: "주일예배 3부", time: "낮 12:00", day: "매주 일요일", location: "본당", accent: "from-primary-500 to-primary-700" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일", location: "본당", accent: "from-emerald-500 to-emerald-700" },
  { name: "금요기도회", time: "오후 8:30", day: "매주 금요일", location: "본당", accent: "from-violet-500 to-violet-700" },
  { name: "새벽예배", time: "오전 6:00 (토,주일 없음)", day: "월~금", location: "본당", accent: "from-amber-500 to-amber-700" },
];

const schoolWorship: WorshipInfo[] = [
  { name: "영유치부", time: "낮 12:00", day: "매주 일요일", location: "본관 1층", accent: "from-pink-500 to-rose-600" },
  { name: "아동부", time: "오전 10:00", day: "매주 일요일", location: "교육관 2층", accent: "from-emerald-500 to-green-600" },
  { name: "청소년부", time: "낮 12:00", day: "매주 일요일", location: "교육관 3층 갈릴리실", accent: "from-blue-500 to-indigo-600" },
  { name: "청년부", time: "오후 2:30", day: "매월 첫째주일", location: "본관 2층", accent: "from-violet-500 to-purple-600" },
];

interface MeetingInfo {
  name: string;
  details: { label: string; value: string }[];
  accent: string;
}

const specialMeetings: MeetingInfo[] = [
  {
    name: "목장예배",
    details: [
      { label: "시간", value: "목장별 정한 시간" },
      { label: "장소", value: "목장별 정한 장소" },
    ],
    accent: "from-rose-500 to-rose-700",
  },
  {
    name: "토요노방전도",
    details: [
      { label: "전도팀", value: "오전 11:00" },
      { label: "2여선교회", value: "오후 2:00" },
      { label: "4여선교회", value: "오후 2:00 (2·4주 토요일)" },
      { label: "장소", value: "1층 전도부실" },
    ],
    accent: "from-orange-500 to-orange-700",
  },
  {
    name: "비전문화학교",
    details: [
      { label: "시간", value: "과목별 상이" },
      { label: "장소", value: "정한 장소" },
    ],
    accent: "from-teal-500 to-teal-700",
  },
];

function WorshipCard({ worship }: { worship: WorshipInfo }) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b ${worship.accent}`} />
      <div className="pl-3">
        <h3 className="text-lg font-bold text-gray-900">{worship.name}</h3>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock size={15} className="shrink-0 text-primary-500" />
            <span>{worship.day} <strong className="text-gray-800">{worship.time}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={15} className="shrink-0 text-primary-500" />
            <span>{worship.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: MeetingInfo }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b ${meeting.accent}`} />
      <div className="pl-3">
        <h3 className="text-lg font-bold text-gray-900">{meeting.name}</h3>
        <div className="mt-3 space-y-1.5 text-sm">
          {meeting.details.map((d) => (
            <div key={d.label} className="flex items-start gap-2 text-gray-600">
              {d.label === "장소" ? (
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary-500" />
              ) : (
                <Clock size={15} className="mt-0.5 shrink-0 text-primary-500" />
              )}
              <span><strong className="text-gray-700">{d.label}</strong> {d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

export default function WorshipPage() {
  return (
    <>
      <PageHeader title="예배안내" description="하나님께 드리는 예배에 함께해 주세요" />

      {/* 안내 이미지 */}
      <section className="bg-white py-8">
        <Container className="py-0">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl shadow-sm">
            <Image
              src="/images/infomap.png"
              alt="명성비전교회 예배 안내"
              width={1200}
              height={800}
              className="h-auto w-full"
              priority
            />
          </div>
        </Container>
      </section>

      {/* 주요 예배 */}
      <section className="bg-gradient-to-b from-white to-primary-50/30 py-12">
        <Container className="py-0">
          <div className="mx-auto max-w-4xl">
            <SectionHeader title="예배 시간" icon={<Clock size={20} />} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </div>
        </Container>
      </section>

      {/* 교회학교 */}
      <section className="bg-church-cream py-12">
        <Container className="py-0">
          <div className="mx-auto max-w-4xl">
            <SectionHeader title="교회학교" icon={<Users size={20} />} />
            <div className="grid gap-4 sm:grid-cols-2">
              {schoolWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </div>
        </Container>
      </section>

      {/* 특별 모임 */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-12">
        <Container className="py-0">
          <div className="mx-auto max-w-4xl">
            <SectionHeader title="특별 모임" icon={<MapPin size={20} />} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {specialMeetings.map((m) => <MeetingCard key={m.name} meeting={m} />)}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
