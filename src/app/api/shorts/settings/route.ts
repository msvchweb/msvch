import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { shortsDb } from "@/lib/shorts/db";
import { SettingsPatchSchema } from "@/lib/shorts/validation";
import { ShortsError } from "@/lib/shorts/generation";
import { shortsHttpError } from "@/lib/shorts/http";
export async function GET(request: NextRequest) {
  try {
    await requireShortsAdmin(request);
    const db = shortsDb();
    const [settings, connections] = await Promise.all([
      db.from("shorts_settings").select("*").eq("id", 1).single(),
      db
        .from("shorts_connections")
        .select("platform,account_id,status,expires_at,updated_at"),
    ]);
    if (settings.error || connections.error)
      throw new Error("settings_read_failed");
    return NextResponse.json({
      settings: settings.data,
      connections: connections.data,
    });
  } catch (e) {
    return shortsHttpError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    await requireShortsAdmin(request);
    const db = shortsDb(),
      patch = SettingsPatchSchema.parse(await request.json());
    const { data, error } = await db.rpc("shorts_update_settings", {
      p_patch: patch,
    });
    if (error)
      throw new ShortsError(
        "자동 제작에는 설교 전용 재생목록과 허용 분류 설정이 필요합니다.",
      );
    return NextResponse.json(data);
  } catch (e) {
    return shortsHttpError(e);
  }
}
