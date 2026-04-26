import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasStaffAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export interface MeResponse {
  authenticated: boolean;
  isStaff: boolean;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json<MeResponse>(
      { authenticated: false, isStaff: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  return NextResponse.json<MeResponse>(
    { authenticated: true, isStaff: hasStaffAccess(profile?.role) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
