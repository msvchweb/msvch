import Link from "next/link";

const sections = [
  {
    href: "/admin/masters/topic",
    title: "교회 표어 (올해의 주제)",
    desc: "주보 1페이지 우측에 표시되는 연도 표어 — 예: '복음의 열매'",
  },
  {
    href: "/admin/masters/mokjang",
    title: "소그룹 목장",
    desc: "주보 3페이지 소그룹 목장 표 (목장 번호 / 목자 / 부목자)",
  },
  {
    href: "/admin/masters/servants",
    title: "섬기는 분들",
    desc: "주보 4페이지 좌측 '섬기는 분들' 역할 ↔ 이름",
  },
  {
    href: "/admin/masters/supports",
    title: "우리가 후원하는 분들",
    desc: "주보 4페이지 좌측 '우리가 후원하는 분들' 섹션 (해외·국내·방송 등)",
  },
  {
    href: "/admin/masters/community-prayers",
    title: "교회공동체 기도제목",
    desc: "주보 2페이지 '교회공동체 기도제목' 목록 (최대 7줄)",
  },
  {
    href: "/admin/masters/worship-resources",
    title: "예배자료",
    desc: "성경·찬송가·신앙고백 본문과 출처를 관리합니다.",
  },
];

export default function AdminMastersHubPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">주보 마스터</h1>
        <p className="mt-1 text-sm text-gray-500">
          매주 바뀌지 않고, 주보 여러 페이지에서 공용으로 쓰는 값들을 관리합니다. 저장 즉시 다음 주보 렌더링부터 반영됩니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-gray-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-sm"
          >
            <h3 className="mb-1 text-base font-semibold text-gray-900">{s.title}</h3>
            <p className="text-xs text-gray-500">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
