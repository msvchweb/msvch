import Link from "next/link";

const worshipTimes = [
  { name: "주일예배", time: "8:00 / 10:00 / 12:00", day: "매주 일요일 (1·2·3부)", accent: "from-primary-500 to-primary-700" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일", accent: "from-emerald-500 to-emerald-700" },
  { name: "금요기도회", time: "오후 8:30", day: "매주 금요일", accent: "from-violet-500 to-violet-700" },
  { name: "새벽예배", time: "오전 6:00", day: "월~금 (토 6:30)", accent: "from-amber-500 to-amber-700" },
];

export function WorshipTimeCard() {
  return (
    <section className="bg-church-cream py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            예배 시간
          </h2>
          <div className="section-divider mt-3" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {worshipTimes.map((item) => (
            <Link
              key={item.name}
              href="/worship"
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Top accent bar */}
              <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />

              <p className="text-sm font-medium tracking-wide text-gray-400">
                {item.day}
              </p>
              <h3 className="mt-2 text-lg font-bold text-gray-900">
                {item.name}
              </h3>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-primary-600">
                {item.time}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
