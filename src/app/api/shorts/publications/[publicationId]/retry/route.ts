import { NextRequest, NextResponse } from "next/server";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { changePublication } from "@/lib/shorts/publication";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicationId: string }> },
) {
  try {
    await requireShortsAdmin(request);
    return NextResponse.json(
      await changePublication((await context.params).publicationId, "retry"),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
