import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewFamilyForm } from "./NewFamilyForm";

export const metadata: Metadata = {
  title: "새가족 등록",
  description:
    "명성비전교회 새가족 등록 페이지입니다. 환영합니다.",
};

export default function NewFamilyPage() {
  return (
    <>
      <PageHeader
        title="새가족 등록"
        description="명성비전교회를 찾아주신 여러분을 환영합니다."
      />
      <Container className="py-10">
        <div className="mx-auto max-w-2xl">
          <NewFamilyForm />
        </div>
      </Container>
    </>
  );
}
