import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import Bulletin from "@/components/bulletin/Bulletin";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import type { Weekly } from "@/types/notice";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeklies")
    .select("title")
    .eq("id", id)
    .single();
  return { title: (data as { title?: string } | null)?.title ?? "주보" };
}

export default async function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, master] = await Promise.all([
    supabase
      .from("weeklies")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .single(),
    loadBulletinMaster(supabase),
  ]);

  if (!data) notFound();
  const weekly = data as Weekly;

  return (
    <Container className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/weekly" className="text-sm text-gray-500 hover:text-gray-900">
          ← 주보 목록
        </Link>
        {weekly.pdf_url && (
          <a
            href={weekly.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-100"
          >
            PDF 다운로드
          </a>
        )}
      </div>
      <Bulletin weekly={weekly} mode="web" master={master} />
    </Container>
  );
}
