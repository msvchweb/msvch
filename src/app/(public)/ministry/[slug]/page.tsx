import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface MinistryInfo {
  title: string;
  description: string;
  schedule: string;
  content: string;
}

const ministries: Record<string, MinistryInfo> = {
  beauty: {
    title: "���용봉사",
    description: "지역사회를 섬기는 미용봉사 사역",
    schedule: "매월 셋째 주 토요일",
    content:
      "지역 주민들과 어르신들을 대상으로 무료 미용봉사를 진행합니다. 작은 섬김이지만 이웃에게 따뜻한 사랑을 전하는 귀한 사역입니다.",
  },
  tabletennis: {
    title: "탁구",
    description: "건강한 몸과 마음을 위한 탁구 모임",
    schedule: "매주 토요일 오후 2:00",
    content:
      "교인과 지역 주민이 함께하는 탁구 모임입니다. 건강한 운동과 즐거운 교제가 함께합니다.",
  },
  sidedish: {
    title: "반찬사역",
    description: "이웃을 향한 사랑의 반찬 나눔",
    schedule: "매주 금요일",
    content:
      "홀몸 어르신과 이웃에게 정성스러운 반찬을 만들어 나눕니다. 동작구와 함께하는 이웃사랑 나눔의 손길입니다.",
  },
};

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return Object.keys(ministries).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = ministries[slug];
  return m ? { title: m.title } : {};
}

export default async function MinistryPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const m = ministries[slug];
  if (!m) notFound();

  return (
    <>
      <PageHeader title={m.title} description={m.description} />
      <Container>
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-8">
            <div className="mb-6 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
              <strong>일정:</strong> {m.schedule}
            </div>
            <div className="prose max-w-none text-gray-700">
              <p>{m.content}</p>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
