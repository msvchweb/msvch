import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { hasStaffAccess } from "@/lib/admin-auth";
import { hasMediaDeptBoardAccess } from "@/lib/boards";

export const dynamic = "force-dynamic";

export interface MeResponse {
  authenticated: boolean;
  userId: string | null;
  role: string | null;
  isStaff: boolean;
  /** admin OR master — 모든 컨텐츠 삭제 권한 */
  isAdminOrMaster: boolean;
  /** 미디어선교부 전용 게시판 접근 가능 여부 (멤버 OR admin/master) — 네비 노출 조건 (O4) */
  isMediaDeptMember: boolean;
}

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
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
        isMediaDeptMember: false,
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
  const mediaDeptMember = await hasMediaDeptBoardAccess(supabase);

  return NextResponse.json<MeResponse>(
    {
      authenticated: true,
      userId: user.id,
      role,
      isStaff: hasStaffAccess(role),
      isAdminOrMaster: role === "admin" || role === "master",
      isMediaDeptMember: mediaDeptMember,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
