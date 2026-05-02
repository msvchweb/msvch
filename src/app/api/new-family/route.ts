import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NewFamilyRegistrationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  const parsed = NewFamilyRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.visitPaths.includes("etc") && !data.visitPathsEtc?.trim()) {
    return NextResponse.json(
      { error: "방문 경로 '기타'는 직접 입력 내용이 필요합니다." },
      { status: 400 },
    );
  }
  if (data.churchHistory === "etc" && !data.churchHistoryEtc?.trim()) {
    return NextResponse.json(
      { error: "신앙생활 '기타'는 직접 입력 내용이 필요합니다." },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("new_family_registrations").insert({
    visit_paths: data.visitPaths,
    visit_paths_etc: data.visitPaths.includes("etc")
      ? data.visitPathsEtc?.trim() ?? null
      : null,
    faith_status: data.faithStatus,
    name: data.name.trim(),
    gender: data.gender,
    birth: data.birth.trim(),
    phone: data.phone.trim(),
    region: data.region?.trim() || null,
    church_history: data.churchHistory,
    church_history_etc:
      data.churchHistory === "etc"
        ? data.churchHistoryEtc?.trim() ?? null
        : null,
    message: data.message?.trim() || null,
    privacy_consent: true,
  });

  if (error) {
    console.error("new-family insert error", error);
    return NextResponse.json(
      { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
