import Link from "next/link";
import { FileText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Bulletin from "@/components/bulletin/Bulletin";
import { createClient } from "@/lib/supabase/server";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import { formatDateKorean } from "@/lib/utils";
import type { Weekly } from "@/types/notice";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "주보" };
export const revalidate = 3600;

export default async function WeeklyPage() {
  const supabase = await createClient();
  const [{ data: published }, master] = await Promise.all([
    supabase
      .from("weeklies")
      .select("*")
      .eq("is_published", true)
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20),
    loadBulletinMaster(supabase),
  ]);

  const weeklies = (published ?? []) as Weekly[];
  const latest = weeklies[0];
  const archive = weeklies.slice(1);

  return (
    <>
      <PageHeader title="주보" description="매주 주보를 확인하세요" />
      <Container>
        {!latest ? (
          <p className="py-12 text-center text-gray-400">
            주보가 준비 중입니다.
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                  {latest.title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                  {latest.date && formatDateKorean(latest.date)}
                  {latest.volume && latest.issue
                    ? ` · ${latest.volume}권 ${latest.issue}호`
                    : ""}
                </p>
              </div>
              <Bulletin weekly={latest} mode="web" master={master} />
            </div>

            {archive.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
                  <h3 className="text-sm font-semibold text-gray-700">
                    지난 주보
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {archive.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/weekly/${w.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 sm:px-6"
                      >
                        <FileText
                          size={16}
                          className="shrink-0 text-primary-400"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {w.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {w.date && formatDateKorean(w.date)}
                            {w.volume && w.issue
                              ? ` · ${w.volume}권 ${w.issue}호`
                              : ""}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </Container>
    </>
  );
}
