import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/api";
import { timingSafeEqual } from "crypto";
import {
  sendAlimtalk,
  buildEventNotificationBody,
  type AlimtalkStatus,
} from "@/lib/alimtalk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface EventForNotification {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
}

interface SubscriberRow {
  id: string;
  name: string;
  phone: string;
  notify_d1: boolean;
  notify_d_day: boolean;
}

interface SentRow {
  event_id: string;
  recipient: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** KST 기준 오늘 + offset 일자 (YYYY-MM-DD) */
function dateOffsetKST(offsetDays: number): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}월 ${d}일`;
}

function formatTimeLabel(start: string | null, end: string | null): string {
  if (!start) return "(종일)";
  const trim = (t: string) => t.slice(0, 5); // HH:mm:ss → HH:mm
  if (!end) return `${trim(start)}~`;
  return `${trim(start)} ~ ${trim(end)}`;
}

interface RunSummary {
  template: string;
  targetDate: string;
  events: number;
  subscribers: number;
  sent: number;
  failed: number;
  noop: number;
  skipped_already_sent: number;
}

/**
 * GET /api/admin/cron/alimtalk-events
 *
 * 인증: x-cron-secret 헤더 (Vercel Cron Authorization 헤더 또는 자체 시크릿)
 * 동작:
 *   1. D-1 (내일) 일정 중 notify=true 만 조회
 *   2. notify_d1=true 인 활성 구독자 목록 조회
 *   3. (event × subscriber) 조합으로 alimtalk_sent 미발송 건만 sendAlimtalk 호출
 *   4. 결과를 alimtalk_sent 에 기록 (status='noop' 도 기록 — 중복 방지)
 *
 * 카카오 비즈 미설정 시 sendAlimtalk 가 noop 반환 → 실 발송 없이 추적만.
 */
export async function GET(request: NextRequest) {
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "supabase env missing" },
      { status: 500 },
    );
  }

  const targetDate = dateOffsetKST(1); // D-1 = 내일
  const template = "event_d1";

  const { data: eventsRaw, error: eventsErr } = await supabase
    .from("events")
    .select("id, title, description, location, date, start_time, end_time")
    .eq("date", targetDate)
    .eq("notify", true);

  if (eventsErr) {
    console.error("[cron/alimtalk-events] events fetch error", eventsErr);
    return NextResponse.json({ error: "events fetch failed" }, { status: 500 });
  }
  const events = (eventsRaw ?? []) as EventForNotification[];

  const { data: subsRaw, error: subsErr } = await supabase
    .from("event_subscribers")
    .select("id, name, phone, notify_d1, notify_d_day")
    .eq("is_active", true)
    .eq("notify_d1", true);

  if (subsErr) {
    console.error("[cron/alimtalk-events] subscribers fetch error", subsErr);
    return NextResponse.json(
      { error: "subscribers fetch failed" },
      { status: 500 },
    );
  }
  const subscribers = (subsRaw ?? []) as SubscriberRow[];

  const summary: RunSummary = {
    template,
    targetDate,
    events: events.length,
    subscribers: subscribers.length,
    sent: 0,
    failed: 0,
    noop: 0,
    skipped_already_sent: 0,
  };

  if (events.length === 0 || subscribers.length === 0) {
    return NextResponse.json(summary);
  }

  // 이미 발송된 (event_id, recipient) 조합 미리 조회
  const eventIds = events.map((e) => e.id);
  const { data: sentRowsRaw } = await supabase
    .from("alimtalk_sent")
    .select("event_id, recipient")
    .eq("template", template)
    .in("event_id", eventIds);
  const sentRows = (sentRowsRaw ?? []) as SentRow[];
  const alreadySent = new Set(
    sentRows.map((r) => `${r.event_id}::${r.recipient}`),
  );

  for (const event of events) {
    const dateLabel = formatDateLabel(event.date);
    const timeLabel = formatTimeLabel(event.start_time, event.end_time);
    const body = buildEventNotificationBody({
      title: event.title,
      dateLabel,
      timeLabel,
      location: event.location,
    });

    for (const sub of subscribers) {
      const key = `${event.id}::${sub.phone}`;
      if (alreadySent.has(key)) {
        summary.skipped_already_sent++;
        continue;
      }

      const result = await sendAlimtalk({
        template,
        to: sub.phone,
        vars: {
          name: sub.name,
          title: event.title,
          date: dateLabel,
          time: timeLabel,
          location: event.location ?? "",
        },
        body,
      });

      const status: AlimtalkStatus = result.status;
      if (status === "sent") summary.sent++;
      else if (status === "failed") summary.failed++;
      else summary.noop++;

      // 추적 기록 (실패도 기록 — 재발송은 별도 정책으로)
      await supabase.from("alimtalk_sent").insert({
        template,
        event_id: event.id,
        recipient: sub.phone,
        status,
        error: result.error ?? null,
      });
    }
  }

  return NextResponse.json(summary);
}
