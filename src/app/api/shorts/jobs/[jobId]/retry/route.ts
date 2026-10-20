import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { retryGeneration } from "@/lib/shorts/generation";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(
      await retryGeneration((await context.params).jobId),
      { status: 202 },
    );
  } catch (error) {
    return shortsHttpError(error);
  }
}
