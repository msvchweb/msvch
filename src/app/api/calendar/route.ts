import { NextRequest, NextResponse } from "next/server";
import {
  getUpcomingEvents,
  createCalendarEvent,
} from "@/lib/google-calendar";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { parseLimit, CalendarEventSchema } from "@/lib/validation";

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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const parsed = CalendarEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const event = await createCalendarEvent(parsed.data);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    console.error("Calendar create error:", err);
    return NextResponse.json(
      { error: "일정 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
