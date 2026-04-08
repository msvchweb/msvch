import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "섬기는 이들" };

interface StaffMember {
  name: string;
  title: string;
  role: string;
  image: string;
}

const staff: StaffMember[] = [
  { name: "이양재", title: "담임목사", role: "", image: "/images/staff1.avif" },
  { name: "우 영", title: "목사", role: "교구 / 목장", image: "/images/staff2.avif" },
  { name: "이준영", title: "전도사", role: "기획 / 청년부", image: "/images/staff3.avif" },
  { name: "최희성", title: "전도사", role: "행정 미디어 / 청소년부", image: "/images/staff4.avif" },
  { name: "임한나", title: "전도사", role: "아동부", image: "/images/staff5.avif" },
  { name: "박가람", title: "교육사", role: "영유치부", image: "/images/staff6.avif" },
];

export default function StaffPage() {
  return (
    <>
      <PageHeader title="섬기는 이들" description="명성비전교회를 섬기는 사역자들입니다" />
      <Container>
        <div className="mx-auto max-w-4xl">
          {/* 담임목사 */}
          <div className="mb-10 flex flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:flex-row">
            <Image
              src={staff[0].image}
              alt={staff[0].name}
              width={180}
              height={220}
              className="rounded-xl object-cover shadow-md"
            />
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-primary-600">{staff[0].title}</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">{staff[0].name}</h2>
            </div>
          </div>

          {/* 나머지 사역자 */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.slice(1).map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  width={140}
                  height={170}
                  className="rounded-xl object-cover shadow-md"
                />
                <p className="mt-4 text-sm font-medium text-primary-600">{member.title}</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">{member.name}</h3>
                {member.role && (
                  <p className="mt-1 text-sm text-gray-500">{member.role}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
