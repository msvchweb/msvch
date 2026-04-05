import { Clock } from "lucide-react";

interface WorshipTime {
  name: string;
  time: string;
  day: string;
}

const worshipTimes: WorshipTime[] = [
  { name: "주일예배", time: "오전 11:00", day: "매주 일요일" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일" },
  { name: "금요기도회", time: "오후 9:00", day: "매주 금요일" },
  { name: "새벽기도회", time: "오전 5:30", day: "매일" },
];

export function WorshipTimeCard() {
  return (
    <section className="bg-church-cream py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
          예배 시간
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {worshipTimes.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <Clock className="mx-auto mb-3 text-primary-500" size={32} />
              <h3 className="text-lg font-semibold text-gray-900">
                {item.name}
              </h3>
              <p className="mt-1 text-2xl font-bold text-primary-600">
                {item.time}
              </p>
              <p className="mt-1 text-sm text-gray-500">{item.day}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
