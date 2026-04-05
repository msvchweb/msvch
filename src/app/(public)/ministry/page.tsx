import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Scissors, TableProperties, UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문화사역",
};

const ministries = [
  {
    slug: "beauty",
    title: "미용봉사",
    description: "지역 주민 대상 무료 미용봉사",
    schedule: "매월 셋째 주 토요일",
    icon: Scissors,
  },
  {
    slug: "tabletennis",
    title: "탁구",
    description: "교인과 지역 주민이 함께하는 운동 모임",
    schedule: "매주 토요일 오후 2:00",
    icon: TableProperties,
  },
  {
    slug: "sidedish",
    title: "반찬사역",
    description: "어르신과 이웃을 위한 반찬 나눔",
    schedule: "매주 금요일",
    icon: UtensilsCrossed,
  },
];

export default function MinistryListPage() {
  return (
    <>
      <PageHeader
        title="문화사역"
        description="지역사회와 함께하는 명성비전교회의 사역입니다"
      />
      <Container>
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-3">
          {ministries.map((m) => (
            <Link
              key={m.slug}
              href={`/ministry/${m.slug}`}
              className="group rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <m.icon
                className="mx-auto mb-3 text-primary-500 transition group-hover:text-primary-600"
                size={36}
              />
              <h3 className="font-bold text-gray-900 group-hover:text-primary-600">
                {m.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500">{m.description}</p>
              <p className="mt-2 text-xs text-primary-500">{m.schedule}</p>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
