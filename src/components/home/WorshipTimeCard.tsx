import Link from "next/link";

const SERVICES = [
  { when: "매주 일요일 (1·2·3부)", title: "주일예배", time: "8:00 / 10:00 / 12:00" },
  { when: "매주 수요일", title: "수요예배", time: "오후 7:30" },
  { when: "매주 금요일", title: "금요기도회", time: "오후 8:30" },
  { when: "월~금", title: "새벽예배", time: "오전 6:00" },
];

export function WorshipTimeCard() {
  return (
    <section className="bg-[var(--color-hero-bg-2)] px-4 py-16 sm:px-12 sm:py-[88px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 flex flex-col items-baseline gap-2 sm:flex-row sm:gap-6">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-church-dark sm:text-4xl">
            예배 시간
          </h2>
          <div className="text-sm text-gray-500">매주 정기적으로 드리는 예배입니다</div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-200 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link
              key={s.title}
              href="/worship"
              className="bg-[var(--color-hero-bg-1)] px-7 py-8 transition-colors hover:bg-white"
            >
              <div className="mb-4 text-xs tracking-[-0.01em] text-gray-500">{s.when}</div>
              <div className="mb-2 text-[22px] font-bold tracking-[-0.025em] text-church-dark">
                {s.title}
              </div>
              <div className="text-sm font-medium tabular-nums text-primary-700">{s.time}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
