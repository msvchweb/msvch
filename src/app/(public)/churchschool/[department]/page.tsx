import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface DepartmentInfo {
  title: string;
  description: string;
  ageGroup: string;
  time: string;
  teacher: string;
  features: string[];
}

const departments: Record<string, DepartmentInfo> = {
  infant: {
    title: "유아부",
    description: "하나님의 사랑 안에서 자라는 아이들",
    ageGroup: "0~7세",
    time: "주일 오전 11:00",
    teacher: "담당 전도사",
    features: ["찬양 율동", "성경 이야기", "만들기 활동", "간식 시간"],
  },
  elementary: {
    title: "초등부",
    description: "말씀으로 자라나는 어린이 제자",
    ageGroup: "초등 1~6학년",
    time: "주일 오전 11:00",
    teacher: "담당 전도사",
    features: ["예배", "성경공부", "특별활동", "여름성경학교"],
  },
  teen: {
    title: "청소년부",
    description: "꿈을 품고 세상을 변화시키는 청소년",
    ageGroup: "중1~고3",
    time: "주일 오후 1:30",
    teacher: "담당 전도사",
    features: ["예배", "소그룹", "수련회", "봉사활동"],
  },
  youth: {
    title: "청년부",
    description: "믿음 위에 미래를 세우는 청년 공동체",
    ageGroup: "대학생·청년",
    time: "주일 오후 2:00",
    teacher: "담당 목사",
    features: ["예배", "셀 모임", "수양회", "선교"],
  },
};

type Params = Promise<{ department: string }>;

export async function generateStaticParams() {
  return Object.keys(departments).map((department) => ({ department }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = departments[department];
  if (!dept) return {};
  return { title: dept.title };
}

export default async function DepartmentPage({
  params,
}: {
  params: Params;
}) {
  const { department } = await params;
  const dept = departments[department];
  if (!dept) notFound();

  return (
    <>
      <PageHeader title={dept.title} description={dept.description} />
      <Container>
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-8">
            <div className="space-y-4">
              <InfoRow label="대상" value={dept.ageGroup} />
              <InfoRow label="시간" value={dept.time} />
              <InfoRow label="담당" value={dept.teacher} />
            </div>

            <div className="mt-8">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
                주요 프로그램
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {dept.features.map((f) => (
                  <li
                    key={f}
                    className="rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-700"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-12 shrink-0 font-semibold text-gray-700">
        {label}
      </span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}
