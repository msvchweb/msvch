import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Heart, BookOpen, Users, Globe } from "lucide-react";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "교회소개",
};

interface VisionItem {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}

const visionItems: VisionItem[] = [
  {
    icon: BookOpen,
    title: "말씀 중심",
    description: "하나님의 말씀을 통해 삶의 방향을 찾습니다.",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: Heart,
    title: "사랑의 공동체",
    description: "서로 사랑하고 섬기는 따뜻한 교회를 만들어 갑니다.",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    icon: Users,
    title: "다음 세대",
    description: "어린이와 청소년이 믿음 안에서 성장하도록 돕습니다.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: Globe,
    title: "지역사회 섬김",
    description: "이웃과 함께하며 지역사회에 선한 영향력을 전합니다.",
    gradient: "from-emerald-500 to-teal-600",
  },
];

export default function IntroPage() {
  return (
    <>
      <PageHeader title="교회소개" description="명성비전교회를 소개합니다" />
      <Container>
        <div className="mx-auto max-w-4xl">
          <section className="mb-20">
            <h2 className="text-center text-2xl font-bold text-gray-900">
              우리의 비전
            </h2>
            <div className="section-divider mt-3" />
            <div className="grid gap-5 sm:grid-cols-2">
              {visionItems.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${item.gradient} p-3 text-white shadow-sm`}>
                    <item.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-gray-500">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-center text-2xl font-bold text-gray-900">
              교회 연혁
            </h2>
            <div className="section-divider mt-3" />
            <div className="relative ml-4 border-l-2 border-primary-100 pl-8">
              <TimelineItem year="설립" text="명성비전교회 창립" />
              <TimelineItem
                year="현재"
                text="다양한 사역과 봉사를 통해 지역사회와 함께 성장하고 있습니다."
                isLast
              />
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}

function TimelineItem({
  year,
  text,
  isLast = false,
}: {
  year: string;
  text: string;
  isLast?: boolean;
}) {
  return (
    <div className={`relative ${isLast ? "" : "pb-8"}`}>
      <div className="absolute -left-[41px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary-300 bg-white">
        <div className="h-2 w-2 rounded-full bg-primary-500" />
      </div>
      <p className="text-sm font-semibold text-primary-600">{year}</p>
      <p className="mt-1 text-gray-600">{text}</p>
    </div>
  );
}
