import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Bulletin from "@/components/bulletin/Bulletin";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import { hasStaffAccess } from "@/lib/admin-auth";
import type { Weekly } from "@/types/notice";

async function loadWeekly(id: string, token: string | undefined) {
  const supabase = await createClient();

  const printSecret = process.env.PRINT_BYPASS_SECRET;
  const hasBypass = !!printSecret && token === printSecret;

  if (!hasBypass) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { forbidden: true as const };
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!hasStaffAccess((profile as { role?: string } | null)?.role)) {
      return { forbidden: true as const };
    }
  }

  const [{ data }, master] = await Promise.all([
    supabase.from("weeklies").select("*").eq("id", id).single(),
    loadBulletinMaster(supabase),
  ]);
  if (!data) return { notFound: true as const };
  return { weekly: data as Weekly, master };
}

export default async function WeeklyPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const res = await loadWeekly(id, token);

  if ("forbidden" in res) {
    return (
      <div className="p-10 text-center text-red-600">관리자 권한이 필요합니다.</div>
    );
  }
  if ("notFound" in res) notFound();

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e5e7eb; }
        body > header, body > footer, body > div[class*="ChatBot"], body > nav, body > div:has(> button[aria-label*="챗봇"]) { display: none !important; }
        main { padding: 0 !important; }

        /* 화면(상단 미리보기) — A4 가로 시트 두 장을 세로로 쌓아 보여줌 */
        .bulletin-print {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8mm;
          padding: 8mm 0;
        }
        .bulletin-print .page {
          width: 297mm;
          height: 210mm;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          display: grid;
          grid-template-columns: 148.5mm 148.5mm;
          page-break-after: always;
          overflow: hidden;
          box-sizing: border-box;
        }
        .bulletin-print .page:last-child { page-break-after: auto; }
        .bulletin-print .a5-cell {
          width: 148.5mm;
          height: 210mm;
          overflow: hidden;
          background: white;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          box-sizing: border-box;
        }
        /* 주보 컴포넌트의 자연 디자인 폭(133×189mm) → zoom 1.11 로 A5 (148×210mm) 채움 */
        .bulletin-print .bulletin-fit {
          width: 133mm;
          min-height: 189mm;
          padding: 4mm;
          zoom: 1.11;
          box-sizing: border-box;
          background: white;
        }

        @media print {
          body { background: white !important; }
          .bulletin-print { padding: 0; gap: 0; }
          .bulletin-print .page { box-shadow: none; margin: 0; }
        }
      `}</style>
      <Bulletin weekly={res.weekly} mode="print" master={res.master} />
    </>
  );
}
