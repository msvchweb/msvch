import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heart, Music, BookOpen, HandHeart, Coffee } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "봉사",
};

const volunteerAreas = [
  {
    title: "찬양팀",
    description: "예배 찬양과 악기 연주로 하나님을 찬양합니다.",
    icon: Music,
  },
  {
    title: "교회학교 교사",
    description: "다음 세대를 세우는 교육 사역에 참여합니다.",
    icon: BookOpen,
  },
  {
    title: "봉사센터",
    description: "지역사회를 섬기는 다양한 봉사활동을 진행합니다.",
    icon: HandHeart,
  },
  {
    title: "환영/접대",
    description: "새가족과 방문자를 따뜻하게 맞이합니다.",
    icon: Coffee,
  },
  {
    title: "사랑의 나눔",
    description: "어려운 이웃에게 물질적, 정서적 도움을 전합니다.",
    icon: Heart,
  },
];

export default function VolunteerPage() {
  return (
    <>
      <PageHeader
        title="봉사"
        description="함께 섬기며 사랑을 나누는 봉사에 참여해 주세요"
      />
      <Container>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {volunteerAreas.map((area) => (
            <div
              key={area.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <area.icon className="mb-3 text-primary-500" size={28} />
              <h3 className="font-bold text-gray-900">{area.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{area.description}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-2xl rounded-xl bg-primary-50 p-8 text-center">
          <h3 className="text-lg font-bold text-primary-800">
            봉사에 참여하고 싶으시면
          </h3>
          <p className="mt-2 text-primary-700">
            교회 사무실(02-XXX-XXXX)로 연락하시거나, 주일예배 후 안내 데스크를
            방문해 주세요.
          </p>
        </div>
      </Container>
    </>
  );
}
