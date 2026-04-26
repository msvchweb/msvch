import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasStaffAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export interface MeResponse {
  authenticated: boolean;
  userId: string | null;
  role: string | null;
  isStaff: boolean;
  /** admin OR master — 모든 컨텐츠 삭제 권한 */
  isAdminOrMaster: boolean;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<MeResponse>(
      {
        authenticated: false,
        userId: null,
        role: null,
        isStaff: false,
        isAdminOrMaster: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const role = profile?.role ?? null;

  return NextResponse.json<MeResponse>(
    {
      authenticated: true,
      userId: user.id,
      role,
      isStaff: hasStaffAccess(role),
      isAdminOrMaster: role === "admin" || role === "master",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
