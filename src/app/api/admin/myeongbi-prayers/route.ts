import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireAdmin } from "@/lib/admin-auth";
import { createApiClient } from "@/lib/supabase/api";
import type { MyeongbiPrayerApplication } from "@/types/myeongbi-prayer";

export const dynamic = "force-dynamic";

interface MyeongbiPrayerApplicationRow {
  id: string;
  name: string;
  phone: string;
  affiliation: string;
  available: boolean;
  message: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  "id, name, phone, affiliation, available, message, created_at, updated_at";

function toDto(row: MyeongbiPrayerApplicationRow): MyeongbiPrayerApplication {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    affiliation: row.affiliation,
    available: row.available,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("myeongbi_prayer_applications")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("myeongbi-prayers list error", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    return NextResponse.json(
      ((data ?? []) as MyeongbiPrayerApplicationRow[]).map(toDto),
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
