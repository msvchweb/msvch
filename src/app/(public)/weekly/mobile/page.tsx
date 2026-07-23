import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { MobileBulletin } from "@/components/mobile-bulletin/MobileBulletin";
import { createClient } from "@/lib/supabase/server";
import type { Weekly } from "@/types/notice";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "모바일 주보" };
export const revalidate = 3600;

export default async function MobileWeeklyPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeklies")
    .select("*")
    .eq("is_published", true)
    .order("date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Container className="py-6 sm:py-10">
      <div className="mb-4 mx-auto w-full max-w-[800px]">
        <Link href="/weekly" className="text-sm text-gray-500 hover:text-gray-900">
          ← 종이 주보
        </Link>
      </div>
      <MobileBulletin weekly={(data as Weekly | null) ?? null} />
    </Container>
  );
}
