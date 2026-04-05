import { FileText, Download } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getWeeklies } from "@/lib/notices";
import { formatDateKorean } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "주보" };
export const revalidate = 3600;

export default async function WeeklyPage() {
  const weeklies = await getWeeklies();

  return (
    <>
      <PageHeader title="주보" description="매주 주보를 확인하세요" />
      <Container>
        <div className="mx-auto max-w-2xl space-y-3">
          {weeklies.length > 0 ? (
            weeklies.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-6 py-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-primary-500" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">{w.title}</p>
                    {w.date && (
                      <p className="text-sm text-gray-400">
                        {formatDateKorean(w.date)}
                      </p>
                    )}
                  </div>
                </div>
                {w.pdf_url && (
                  <a
                    href={w.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-100"
                  >
                    <Download size={14} /> PDF
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-gray-400">
              주보가 준비 중입니다.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
