import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadUpdates, stripMetaComments } from "@/lib/updates";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "업데이트 노트",
  description: "명성비전교회 홈페이지 운영 시스템의 변경 사항을 안내합니다.",
};
export const revalidate = 3600;

export default async function PublicUpdatesPage() {
  const items = (await loadUpdates()).filter((e) => !e.staffOnly);

  return (
    <>
      <PageHeader
        title="업데이트 노트"
        description="홈페이지에 적용된 변경 사항을 안내합니다."
      />
      <Container>
        <div className="mx-auto max-w-3xl pb-16">
          {items.length === 0 ? (
            <p className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center text-sm text-gray-400 shadow-sm">
              아직 등록된 업데이트가 없습니다.
            </p>
          ) : (
            <ol className="relative space-y-6 border-l border-gray-200 pl-6">
              {items.map((u) => {
                const body = stripMetaComments(u.body);
                return (
                  <li key={u.date + u.title} className="relative">
                    <span
                      className="absolute -left-[31px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-primary-500"
                      aria-hidden
                    />
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <time className="text-xs font-semibold text-gray-500">
                          {u.date}
                        </time>
                        {u.highlight && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Sparkles size={10} />
                            NEW
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-lg font-semibold text-gray-900">
                        {u.title}
                      </h2>
                      {body && (
                        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-700">
                          {body}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </Container>
    </>
  );
}
