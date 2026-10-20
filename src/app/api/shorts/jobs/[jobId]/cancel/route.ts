import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { cancelQueuedGeneration } from "@/lib/shorts/generation";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(
      await cancelQueuedGeneration((await context.params).jobId),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
