import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Baby, BookOpen, GraduationCap, Users, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "교회학교",
};

interface Department {
  slug: string;
  title: string;
  ageGroup: string;
  icon: LucideIcon;
  gradient: string;
  description: string;
}

const departments: Department[] = [
  {
    slug: "infant",
    title: "영유치부",
    ageGroup: "0~7세",
    icon: Baby,
    gradient: "from-pink-500 to-rose-600",
    description: "하나님의 사랑 안에서 자라는 아이들",
  },
  {
    slug: "elementary",
    title: "아동부",
    ageGroup: "초등 1~6학년",
    icon: BookOpen,
    gradient: "from-emerald-500 to-green-600",
    description: "말씀으로 자라나는 어린이 제자",
  },
  {
    slug: "teen",
    title: "청소년부",
    ageGroup: "중1~고3",
    icon: GraduationCap,
    gradient: "from-blue-500 to-indigo-600",
    description: "꿈을 품고 세상을 변화시키는 청소년",
  },
  {
    slug: "youth",
    title: "청년부",
    ageGroup: "대학생·청년",
    icon: Users,
    gradient: "from-violet-500 to-purple-600",
    description: "믿음 위에 미래를 세우는 청년 공동체",
  },
];

export default function ChurchSchoolPage() {
  return (
    <>
      <PageHeader
        title="교회학교"
        description="다음 세대를 세우는 교회학교입니다"
      />
      <Container>
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {departments.map((dept) => (
            <Link
              key={dept.slug}
              href={`/churchschool/${dept.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${dept.gradient} p-3 text-white shadow-sm`}>
                <dept.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 transition-colors group-hover:text-primary-600">
                {dept.title}
              </h3>
              <p className="mt-1 text-sm text-gray-400">{dept.ageGroup}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {dept.description}
              </p>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
                자세히 보기 <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
