/**
 * 모바일 주보 섹션 제목. 서버 섹션(MobileBulletinSections)과 클라이언트 섹션(ChurchNews)이
 * 함께 쓰므로 별도 모듈로 둔다 — 서버 모듈을 클라이언트 번들로 끌어오지 않기 위해서다.
 */
export function SectionHeading({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2 px-0.5">
      <h2 className="text-[17px] font-extrabold tracking-[-0.035em] text-[var(--bt-ink)]">
        {children}
      </h2>
      {sub && <span className="text-xs text-[var(--bt-faint)]">{sub}</span>}
    </div>
  );
}
