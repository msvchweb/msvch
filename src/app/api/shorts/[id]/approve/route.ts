import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireShortsAdmin } from "@/lib/shorts/permissions";
import { reviewClip } from "@/lib/shorts/review";
import { approveAndSchedule } from "@/lib/shorts/publication";
import { shortsHttpError } from "@/lib/shorts/http";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireShortsAdmin(request);
    const text = await request.text();
    const raw = text ? JSON.parse(text) : {};
    if (raw.platforms)
      return NextResponse.json(
        await approveAndSchedule((await context.params).id, raw),
        { status: 202 },
      );
    const body = z
      .object({ expectedVersion: z.number().int().positive().optional() })
      .parse(raw);
    return NextResponse.json(
      await reviewClip(
        (await context.params).id,
        "approve",
        body.expectedVersion ?? null,
      ),
    );
  } catch (e) {
    return shortsHttpError(e);
  }
}
