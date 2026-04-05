import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "인사말",
};

export default function GreetingsPage() {
  return (
    <>
      <PageHeader title="인사말" description="명성비전교회에 오신 것을 환영합니다" />
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex flex-col items-center gap-6 md:flex-row">
            <Image
              src="/images/pastor.avif"
              alt="이양재 목사"
              width={160}
              height={200}
              className="rounded-xl object-cover shadow-md"
            />
            <div>
              <h2 className="text-xl font-bold text-gray-900">담임목사 이양재</h2>
              <p className="mt-1 text-gray-500">대한예수교장로회(통합) 명성비전교회</p>
            </div>
          </div>
          <div className="prose max-w-none text-gray-700">
            <p>
              사랑하는 성도 여러분, 명성비전교회 홈페이지를 방문해 주셔서 진심으로
              감사드립니다.
            </p>
            <p>
              저희 교회는 하나님의 말씀을 중심으로, 서로 사랑하고 섬기는
              공동체를 지향합니다. 예배와 기도, 말씀과 교제를 통해 하나님 나라의
              비전을 이루어 가고 있습니다.
            </p>
            <p>
              이 곳에서 하나님의 은혜와 사랑을 경험하시길 바라며, 언제든지
              방문해 주시기를 환영합니다.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
