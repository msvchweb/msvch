import { FileText, Download, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { WeeklyInlineView } from "@/components/weekly/WeeklyInlineView";
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
        <div className="mx-auto max-w-2xl space-y-4">
          {weeklies.length > 0 ? (
            weeklies.map((w) => {
              const hasContent =
                w.sermon_title ||
                w.scripture ||
                w.weekly_verse ||
                (w.prayer_items && w.prayer_items.length > 0) ||
                (w.announcements && w.announcements.length > 0);

              return (
                <details key={w.id} className="group rounded-xl border border-gray-100 bg-white shadow-sm open:shadow-md">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="shrink-0 text-primary-500" size={20} />
                      <div>
                        <p className="font-medium text-gray-900">{w.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-400">
                          {w.date && <span>{formatDateKorean(w.date)}</span>}
                          {w.volume && w.issue && (
                            <span>· {w.volume}권 {w.issue}호</span>
                          )}
                          {w.sermon_title && (
                            <span className="hidden sm:inline">
                              · &ldquo;{w.sermon_title}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {w.pdf_url && (
                        <a
                          href={w.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-100"
                        >
                          <Download size={14} /> PDF
                        </a>
                      )}
                      {hasContent && (
                        <ChevronDown
                          size={16}
                          className="text-gray-400 transition-transform group-open:rotate-180"
                        />
                      )}
                    </div>
                  </summary>

                  {hasContent && (
                    <div className="px-6 pb-5">
                      <WeeklyInlineView weekly={w} />
                    </div>
                  )}
                </details>
              );
            })
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
