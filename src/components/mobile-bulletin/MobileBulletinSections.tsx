import Link from "next/link";
import type { OfferingAccountValue } from "@/types/bulletin-master";
import type { GuideCommitteeRow } from "@/types/notice";
import { SectionHeading } from "./SectionHeading";

const PART_LABELS = ["1부", "2부", "3부"];

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** 분류 라벨 왼쪽 + 부별 명단 오른쪽. 핸드오프의 Committee 행 형태. */
function ServingGroup({
  label,
  rows,
  first,
}: {
  label: string;
  rows: Array<{ part: string; name: string }>;
  first: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={`flex gap-3 py-3.5 ${first ? "" : "border-t border-[var(--bt-line)]"}`}>
      <dt className="w-16 shrink-0 pt-px text-[12.5px] font-extrabold text-[var(--bt-acc)]">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-1.5">
        {rows.map(({ part, name }) => (
          <span key={`${part}-${name}`} className="flex gap-2 text-[13.5px] text-[var(--bt-ink)]">
            {part && <span className="w-7 shrink-0 text-[var(--bt-faint)]">{part}</span>}
            <span className="min-w-0 break-words tracking-[-0.01em]">{name}</span>
          </span>
        ))}
      </dd>
    </div>
  );
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
    <section className="scroll-mt-20 snap-start bg-[var(--bt-bg)] px-4 pb-10 transition-colors duration-300 motion-reduce:transition-none sm:px-6">
      <SectionHeading>다음 주 섬김</SectionHeading>

      <dl className="rounded-2xl border border-[var(--bt-line)] bg-[var(--bt-card)] px-4 py-1">
        <ServingGroup
          label="기도"
          rows={prayers.map(({ label, name }) => ({ part: label, name }))}
          first
        />
        <ServingGroup
          label="헌금위원"
          rows={offerings.map(({ label, name }) => ({ part: label, name }))}
          first={prayers.length === 0}
        />
        <ServingGroup
          label="안내위원"
          rows={guideRows.map((guide) => ({
            part: guide.part,
            name: [
              guide.indoor && `실내 ${guide.indoor}`,
              guide.outdoor && `실외 ${guide.outdoor}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          first={prayers.length === 0 && offerings.length === 0}
        />
      </dl>
    </section>
  );
}

export function PrayerTopics({ prayers }: { prayers: string[] }): React.ReactNode {
  const visible = prayers.map((text) => text.trim()).filter(nonEmpty);
  if (visible.length === 0) return null;

  return (
    <section className="scroll-mt-20 snap-start bg-[var(--bt-bg)] px-4 pb-10 transition-colors duration-300 motion-reduce:transition-none sm:px-6">
      <SectionHeading>기도제목</SectionHeading>

      <ol className="rounded-2xl border border-[var(--bt-line)] bg-[var(--bt-card)] px-4 py-1.5">
        {visible.map((text, index) => (
          <li
            key={`${text}-${index}`}
            className={`flex gap-2.5 py-2.5 ${index === 0 ? "" : "border-t border-[var(--bt-line)]"}`}
          >
            <span className="mt-px shrink-0 text-xs font-extrabold tabular-nums text-[var(--bt-acc)]">
              {index + 1}
            </span>
            <span className="min-w-0 break-words text-[13.5px] leading-[1.6] tracking-[-0.01em] text-[var(--bt-ink)]">
              {text}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OfferingAccount({
  account,
}: {
  account: OfferingAccountValue | null;
}): React.ReactNode {
  if (!account) return null;

  return (
    <section className="scroll-mt-20 snap-start bg-[var(--bt-bg)] px-4 pb-10 transition-colors duration-300 motion-reduce:transition-none sm:px-6">
      <SectionHeading>온라인 헌금</SectionHeading>

      <div className="rounded-2xl bg-[var(--bt-acc-soft)] px-[18px] py-4">
        {account.note.trim() && (
          <p className="mb-1 text-[13px] text-[var(--bt-sub)]">{account.note}</p>
        )}
        <p className="break-words text-[15px] font-extrabold tracking-[-0.02em] text-[var(--bt-ink)]">
          {account.bank} {account.number} {account.holder}
        </p>
      </div>
    </section>
  );
}

export function BulletinFooterLinks(): React.ReactNode {
  return (
    <nav
      aria-label="주보 바로가기"
      className="scroll-mt-20 snap-start bg-[var(--bt-bg)] px-4 pb-12 transition-colors duration-300 motion-reduce:transition-none sm:px-6"
    >
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/weekly"
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--bt-acc-soft)] px-4 text-[13px] font-bold text-[var(--bt-acc)]"
        >
          종이 주보 보기
        </Link>
        <Link
          href="/sermons"
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--bt-line)] bg-[var(--bt-card)] px-4 text-[13px] font-bold text-[var(--bt-sub)]"
        >
          설교 영상 보기
        </Link>
      </div>

      <p className="mt-7 text-center text-[11.5px] leading-[1.7] text-[var(--bt-faint)]">
        명성비전교회 · 서울 동작구 사당로 16바길 9
        <br />
        02-534-0691
      </p>
    </nav>
  );
}
