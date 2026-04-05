import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "예배 안내",
};

interface WorshipInfo {
  name: string;
  time: string;
  day: string;
  location: string;
  description: string;
}

const worshipList: WorshipInfo[] = [
  {
    name: "주일예배 1부",
    time: "오전 8:00",
    day: "매주 일요일",
    location: "본당",
    description: "첫째 시간 주일 예배입니다.",
  },
  {
    name: "주일예배 2부",
    time: "오전 10:00",
    day: "매주 일요일",
    location: "본당",
    description: "둘째 시간 주일 예배입니다.",
  },
  {
    name: "주일예배 3부",
    time: "낮 12:00",
    day: "매주 일요일",
    location: "본당",
    description: "셋째 시간 주일 예배입니다.",
  },
  {
    name: "수요예배",
    time: "오후 7:30",
    day: "매주 수요일",
    location: "본당",
    description: "말씀과 기도로 한 주의 중심을 세우는 예배입니다.",
  },
  {
    name: "금요예배",
    time: "오후 7:30",
    day: "매주 금요일",
    location: "본당",
    description: "기도와 찬양으로 드리는 금요 예배입니다.",
  },
  {
    name: "새벽예배",
    time: "오전 6:00 (토 6:30)",
    day: "매일 (월~토)",
    location: "본당",
    description: "하루를 말씀과 기도로 시작하는 새벽 예배입니다.",
  },
];

export default function WorshipPage() {
  return (
    <>
      <PageHeader title="예배 안내" description="하나님께 드리는 예배에 함께해 주세요" />
      <Container>
        <div className="mx-auto max-w-3xl space-y-6">
          {worshipList.map((worship) => (
            <div
              key={worship.name}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {worship.name}
                  </h3>
                  <p className="mt-2 text-gray-600">{worship.description}</p>
                </div>
                <div className="shrink-0 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={16} className="text-primary-500" />
                    <span>
                      {worship.day} {worship.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={16} className="text-primary-500" />
                    <span>{worship.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
