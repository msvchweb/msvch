import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "인사말" };

export default function GreetingsPage() {
  return (
    <>
      <PageHeader title="인사말" description="명성비전교회에 오신 것을 환영합니다" />
      <Container>
        <div className="mx-auto max-w-3xl">
          <Image
            src="/images/greetings.avif"
            alt="명성비전교회 인사말"
            width={800}
            height={600}
            className="w-full rounded-2xl shadow-md"
            priority
          />
        </div>
      </Container>
    </>
  );
}
