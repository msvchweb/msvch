import { NextResponse, type NextRequest } from "next/server";
import { getUpcomingEvents, toCalendarEvent } from "@/lib/events";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { parseLimit, CalendarEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

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

interface InsertedEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  rrule: string | null;
  notify: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAdmin(request);
    const parsed = CalendarEventSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
        date: parsed.data.date,
        start_time: parsed.data.startTime ?? null,
        end_time: parsed.data.endTime ?? null,
        notify: parsed.data.notify ?? false,
        created_by: userId,
      })
      .select(
        "id, title, description, location, date, start_time, end_time, rrule, notify",
      )
      .single<InsertedEventRow>();

    if (error || !data) {
      console.error("Event create error:", error);
      return NextResponse.json(
        { error: "일정 생성에 실패했습니다." },
        { status: 500 },
      );
    }
    return NextResponse.json(toCalendarEvent(data), { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Event create error:", err);
    return NextResponse.json(
      { error: "일정 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
