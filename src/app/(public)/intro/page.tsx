import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heart, BookOpen, Users, Globe } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교회소개",
};

const visionItems = [
  {
    icon: BookOpen,
    title: "말씀 중심",
    description: "하나님의 말씀을 통해 삶의 방향을 찾습니다.",
  },
  {
    icon: Heart,
    title: "사랑의 공동체",
    description: "서로 사랑하고 섬기는 따뜻한 교회를 만들어 ��니다.",
  },
  {
    icon: Users,
    title: "다음 세대",
    description: "어린이와 청소년이 믿음 안에서 성장하도록 돕습니다.",
  },
  {
    icon: Globe,
    title: "지역사회 섬김",
    description: "이웃과 함께하며 지역사회에 선한 영향력을 전합니다.",
  },
];

export default function IntroPage() {
  return (
    <>
      <PageHeader title="교회소개" description="명성비전교회를 소개합니다" />
      <Container>
        <div className="mx-auto max-w-4xl">
          <section className="mb-16">
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
              우리의 비전
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {visionItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <item.icon className="mb-3 text-primary-500" size={32} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
              교회 연혁
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <div className="space-y-4 text-gray-700">
                <div className="flex gap-4">
                  <span className="w-24 shrink-0 font-semibold text-primary-600">
                    설립
                  </span>
                  <span>명성비전교회 창립</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-24 shrink-0 font-semibold text-primary-600">
                    현재
                  </span>
                  <span>
                    다양한 사역과 봉사를 통해 지역사회와 함께 성장하고 있습니다.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
