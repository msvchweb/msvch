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
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e5e7eb; }
        body > header, body > footer, body > div[class*="ChatBot"], body > nav, body > div:has(> button[aria-label*="챗봇"]) { display: none !important; }
        main { padding: 0 !important; }
        .bulletin-print .page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto 8mm auto;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
          page-break-after: always;
          box-sizing: border-box;
        }
        .bulletin-print .page:last-child { page-break-after: auto; margin-bottom: 0; }
        @media print {
          body { background: white !important; }
          .bulletin-print .page { box-shadow: none; margin: 0; }
        }
      `}</style>
      <Bulletin weekly={res.weekly} mode="print" master={res.master} />
    </>
  );
}
