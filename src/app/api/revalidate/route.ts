import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { RevalidateSchema } from "@/lib/validation";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const parsed = RevalidateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !safeCompare(parsed.data.secret, secret)) {
    return NextResponse.json(
      { error: "Invalid secret" },
      { status: 401 },
    );
  }

  for (const path of parsed.data.paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true });
}
