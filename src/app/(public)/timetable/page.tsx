import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "시간표",
};

interface ScheduleRow {
  day: string;
  items: { time: string; name: string }[];
}

const schedule: ScheduleRow[] = [
  {
    day: "일요일",
    items: [
      { time: "오전 11:00", name: "주일예배" },
      { time: "오후 1:30", name: "청소년부 예배" },
      { time: "오후 2:00", name: "청년부 모임" },
    ],
  },
  {
    day: "월~토",
    items: [{ time: "오전 5:30", name: "새벽기도회" }],
  },
  {
    day: "수요일",
    items: [{ time: "오후 7:30", name: "수요예배" }],
  },
  {
    day: "금요일",
    items: [{ time: "오후 9:00", name: "금요기도회" }],
  },
  {
    day: "토요일",
    items: [{ time: "오후 2:00", name: "탁구 모임" }],
  },
];

export default function TimetablePage() {
  return (
    <>
      <PageHeader title="시간표" description="교회 주간 일정입니다" />
      <Container>
        <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  요일
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  시간
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  모임
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedule.map((row) =>
                row.items.map((item, idx) => (
                  <tr key={`${row.day}-${item.name}`} className="hover:bg-gray-50">
                    {idx === 0 && (
                      <td
                        className="px-6 py-3 font-medium text-primary-600"
                        rowSpan={row.items.length}
                      >
                        {row.day}
                      </td>
                    )}
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {item.time}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {item.name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}
