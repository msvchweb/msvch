import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Baby, BookOpen, GraduationCap, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교회���교",
};

const departments = [
  {
    slug: "infant",
    title: "유아부",
    ageGroup: "0~7세",
    icon: Baby,
    color: "bg-pink-50 text-pink-600",
  },
  {
    slug: "elementary",
    title: "초등부",
    ageGroup: "초등 1~6학년",
    icon: BookOpen,
    color: "bg-green-50 text-green-600",
  },
  {
    slug: "teen",
    title: "청소년부",
    ageGroup: "중1~고3",
    icon: GraduationCap,
    color: "bg-blue-50 text-blue-600",
  },
  {
    slug: "youth",
    title: "청년부",
    ageGroup: "대학생·청년",
    icon: Users,
    color: "bg-purple-50 text-purple-600",
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
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          {departments.map((dept) => (
            <Link
              key={dept.slug}
              href={`/churchschool/${dept.slug}`}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div
                className={`mb-4 inline-flex rounded-lg p-3 ${dept.color}`}
              >
                <dept.icon size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600">
                {dept.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{dept.ageGroup}</p>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
