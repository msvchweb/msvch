import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { UtensilsCrossed, Scissors, GraduationCap, TableProperties } from "lucide-react";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = { title: "봉사센터" };

interface CenterItem {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  schedule: string;
}

const centers: CenterItem[] = [
  {
    slug: "sidedish",
    title: "사랑의 반찬나눔",
    description: "홀몸 어르신과 이웃에게 정성스러운 반찬을 만들어 나눕니다",
    icon: UtensilsCrossed,
    schedule: "",
  },
  {
    slug: "beauty",
    title: "사랑의 이미용봉사",
    description: "지역 주민들과 어르신들을 대상으로 무료 미용봉사를 진행합니다",
    icon: Scissors,
    schedule: "매월 둘째 주 월요일",
  },
  {
    slug: "culture",
    title: "비전문화학교",
    description: "지역사회를 위한 문화 교육 프로그램을 운영합니다",
    icon: GraduationCap,
    schedule: "",
  },
  {
    slug: "tabletennis",
    title: "탁구교실",
    description: "교인과 지역 주민이 함께하는 건강한 운동과 교제",
    icon: TableProperties,
    schedule: "",
  },
];

export default function VolunteerCenterPage() {
  return (
    <>
      <PageHeader title="봉사센터" description="지역사회를 섬기는 명성비전교회 봉사 사역" />
      <Container>
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {centers.map((center) => (
            <Link
              key={center.slug}
              href={`/volunteer-center/${center.slug}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <center.icon size={28} className="text-primary-600" />
              <h3 className="mt-3 text-lg font-bold text-gray-900">{center.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{center.description}</p>
              {center.schedule && (
                <p className="mt-3 text-xs font-medium text-primary-600">{center.schedule}</p>
              )}
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
