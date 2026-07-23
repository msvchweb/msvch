import Link from "next/link";
import type { GuideCommitteeRow, NewsItem } from "@/types/notice";

const PART_LABELS = ["1부", "2부", "3부"];

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function NextWeekServing({
  prayer,
  offering,
  guides,
}: {
  prayer: string[];
  offering: { p1: string; p2: string; p3: string };
  guides: GuideCommitteeRow[];
}): React.ReactNode {
  const prayers = prayer
    .map((name, index) => ({ label: PART_LABELS[index] ?? `${index + 1}부`, name: name.trim() }))
    .filter(({ name }) => nonEmpty(name));
  const offerings = [offering.p1, offering.p2, offering.p3]
    .map((name, index) => ({ label: PART_LABELS[index], name: name.trim() }))
    .filter(({ name }) => nonEmpty(name));
  const guideRows = guides
    .map((guide) => ({
      part: guide.part.trim(),
      indoor: guide.indoor.trim(),
      outdoor: guide.outdoor.trim(),
    }))
    .filter((guide) => Object.values(guide).some(nonEmpty));

  if (prayers.length === 0 && offerings.length === 0 && guideRows.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-stone-200 bg-white px-5 py-10 sm:px-8">
      <h2 className="text-2xl font-bold text-stone-950">다음 주 섬김</h2>

      {prayers.length > 0 && (
        <div className="mt-7">
          <h3 className="text-lg font-bold text-liturgy-brand">기도</h3>
          <dl className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200">
            {prayers.map(({ label, name }) => (
              <div key={label} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-4 py-3">
                <dt className="text-sm font-semibold text-stone-500">{label}</dt>
                <dd className="break-words text-base text-stone-800">{name}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {offerings.length > 0 && (
        <div className="mt-7">
          <h3 className="text-lg font-bold text-liturgy-brand">헌금</h3>
          <dl className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200">
            {offerings.map(({ label, name }) => (
              <div key={label} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-4 py-3">
                <dt className="text-sm font-semibold text-stone-500">{label}</dt>
                <dd className="break-words text-base text-stone-800">{name}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {guideRows.length > 0 && (
        <div className="mt-7">
          <h3 className="text-lg font-bold text-liturgy-brand">안내위원</h3>
          <div className="mt-3 space-y-3">
            {guideRows.map((guide, index) => (
              <article key={`${guide.part}-${index}`} className="rounded-xl border border-stone-200 px-4 py-4">
                {guide.part && <h4 className="text-base font-bold text-stone-900">{guide.part}</h4>}
                <dl className="mt-2 space-y-2">
                  {guide.indoor && (
                    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
                      <dt className="text-sm font-semibold text-stone-500">실내</dt>
                      <dd className="break-words text-base text-stone-800">{guide.indoor}</dd>
                    </div>
                  )}
                  {guide.outdoor && (
                    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
                      <dt className="text-sm font-semibold text-stone-500">실외</dt>
                      <dd className="break-words text-base text-stone-800">{guide.outdoor}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ChurchNews({ news }: { news: NewsItem[] }): React.ReactNode {
  const visibleNews = news
    .map((item) => ({
      title: item.title.trim(),
      items: item.items.map((line) => line.trim()).filter(nonEmpty),
    }))
    .filter((item) => nonEmpty(item.title) && item.items.length > 0);

  if (visibleNews.length === 0) return null;

  return (
    <section className="border-t border-stone-200 bg-church-cream px-5 py-10 sm:px-8">
      <h2 className="text-2xl font-bold text-stone-950">교회소식</h2>
      <div className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {visibleNews.map((item, index) => (
          <details key={`${item.title}-${index}`} open={index === 0} className="group px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-bold text-stone-900 marker:content-none">
              <span className="min-w-0 break-words">{item.title}</span>
              <span aria-hidden="true" className="shrink-0 text-liturgy-brand group-open:rotate-45 motion-reduce:transition-none">
                +
              </span>
            </summary>
            <ul className="space-y-3 pb-5 pl-5 text-base leading-7 text-stone-700">
              {item.items.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="list-disc whitespace-pre-wrap break-words">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

export function BulletinFooterLinks(): React.ReactNode {
  return (
    <nav aria-label="주보 바로가기" className="border-t border-stone-200 bg-white px-5 py-8 sm:px-8">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/weekly"
          className="inline-flex min-h-11 items-center rounded-full border border-liturgy-brand px-4 py-2 text-sm font-semibold text-liturgy-brand hover:bg-liturgy-brand-soft"
        >
          종이 주보 보기
        </Link>
        <Link
          href="/sermons"
          className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-church-cream"
        >
          설교 영상 보기
        </Link>
      </div>
    </nav>
  );
}
