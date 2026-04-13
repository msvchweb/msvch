import { NextRequest, NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { parseLimit } from "@/lib/validation";

export const revalidate = 600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = parseLimit(searchParams.get("limit"), 20);
  const rawDays = parseInt(searchParams.get("days") ?? "60", 10);
  const daysAhead = Math.min(
    isNaN(rawDays) || rawDays < 1 ? 60 : rawDays,
    365,
  );

  const events = await getUpcomingEvents(limit, daysAhead);
  return NextResponse.json(events);
}
