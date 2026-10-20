import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { rejectClip } from "@/lib/shorts/review";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(
      await rejectClip((await context.params).id, await request.json()),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
