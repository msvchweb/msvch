import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { updateClip } from "@/lib/shorts/review";
import { shortsHttpError } from "@/lib/shorts/http";
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(
      await updateClip((await context.params).id, await request.json()),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
