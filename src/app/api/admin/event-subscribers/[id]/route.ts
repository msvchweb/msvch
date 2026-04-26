import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import {
  EventSubscriberSchema,
  normalizeKoreanPhone,
} from "@/lib/validation";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    // partial 형태로 검증 — 필드별로 들어온 것만 갱신
    const parsed = EventSubscriberSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const patch: Record<string, string | boolean | null> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.phone !== undefined) {
      const normalized = normalizeKoreanPhone(parsed.data.phone);
      if (!normalized) {
        return NextResponse.json(
          { error: "휴대폰 번호 형식이 올바르지 않습니다." },
          { status: 400 },
        );
      }
      patch.phone = normalized;
    }
    if (parsed.data.isActive !== undefined)
      patch.is_active = parsed.data.isActive;
    if (parsed.data.notifyD1 !== undefined)
      patch.notify_d1 = parsed.data.notifyD1;
    if (parsed.data.notifyDDay !== undefined)
      patch.notify_d_day = parsed.data.notifyDDay;
    if (parsed.data.note !== undefined) patch.note = parsed.data.note ?? null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "변경 사항이 없습니다." },
        { status: 400 },
      );
    }

    const supabase = await createApiClient(request);
    const { error } = await supabase
      .from("event_subscribers")
      .update(patch)
      .eq("id", id);

    if (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "23505") {
        return NextResponse.json(
          { error: "이미 등록된 전화번호입니다." },
          { status: 409 },
        );
      }
      console.error("subscriber update error", error);
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    await requireAdmin(request);

    const supabase = await createApiClient(request);
    const { error } = await supabase
      .from("event_subscribers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("subscriber delete error", error);
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
