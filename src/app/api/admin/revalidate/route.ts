import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/admin-auth";

/**
 * 관리자(세션) 기반 ISR revalidate.
 *
 * 시크릿 토큰 기반인 `/api/revalidate`는 서버-서버용으로 남겨두고,
 * 브라우저 admin UI는 이 엔드포인트를 사용한다 (시크릿 노출 없이 세션 인증).
 */

const Schema = z.object({
  paths: z
    .array(z.string().startsWith("/").max(500))
    .min(1)
    .max(20),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "인증 오류" }, { status: 500 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 },
    );
  }

  for (const path of parsed.data.paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true });
}
