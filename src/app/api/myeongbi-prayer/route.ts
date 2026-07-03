import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/api";
import { MyeongbiPrayerApplicationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "올바르지 않은 요청입니다." },
      { status: 400 },
    );
  }

  const parsed = MyeongbiPrayerApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "입력값이 올바르지 않습니다.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("myeongbi_prayer_applications")
    .insert({
      name: data.name,
      phone: data.phone,
      affiliation: data.affiliation,
      available: true,
      message: data.message || null,
    });

  if (error) {
    console.error("myeongbi-prayer insert error", error);
    return NextResponse.json(
      { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
