import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  EventSubscriberSchema,
  normalizeKoreanPhone,
} from "@/lib/validation";
import type { EventSubscriber } from "@/types/subscribers";

export const dynamic = "force-dynamic";

interface SubscriberRow {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
  notify_d1: boolean;
  notify_d_day: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function toDto(row: SubscriberRow): EventSubscriber {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    isActive: row.is_active,
    notifyD1: row.notify_d1,
    notifyDDay: row.notify_d_day,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("event_subscribers")
      .select(
        "id, name, phone, is_active, notify_d1, notify_d_day, note, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("subscribers list error", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    const dtos = ((data ?? []) as SubscriberRow[]).map(toDto);
    return NextResponse.json(dtos);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const parsed = EventSubscriberSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }
    const phone = normalizeKoreanPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "휴대폰 번호 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("event_subscribers")
      .insert({
        name: parsed.data.name,
        phone,
        is_active: parsed.data.isActive ?? true,
        notify_d1: parsed.data.notifyD1 ?? true,
        notify_d_day: parsed.data.notifyDDay ?? false,
        note: parsed.data.note ?? null,
      })
      .select(
        "id, name, phone, is_active, notify_d1, notify_d_day, note, created_at, updated_at",
      )
      .single<SubscriberRow>();

    if (error || !data) {
      // 중복 phone (UNIQUE) 위반 시 23505
      const code = (error as { code?: string } | null)?.code;
      if (code === "23505") {
        return NextResponse.json(
          { error: "이미 등록된 전화번호입니다." },
          { status: 409 },
        );
      }
      console.error("subscriber create error", error);
      return NextResponse.json({ error: "등록 실패" }, { status: 500 });
    }
    return NextResponse.json(toDto(data), { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}
