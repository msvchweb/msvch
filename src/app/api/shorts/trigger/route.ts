import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { createGeneration } from "@/lib/shorts/generation";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(request: NextRequest) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(await createGeneration(await request.json()), {
      status: 202,
    });
  } catch (error) {
    return shortsHttpError(error);
  }
}
