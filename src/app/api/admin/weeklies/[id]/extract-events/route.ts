import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { createApiClient } from "@/lib/supabase/api";
import {
  extractEventsFromNews,
  GeminiUnavailableError,
} from "@/lib/news-event-extractor";
import type { ExtractEventsResponse } from "@/types/event-extraction";
import type { NewsItem, MeetingRow } from "@/types/notice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface WeeklyForExtraction {
  id: string;
  date: string | null;
  news: NewsItem[] | null;
  meetings: MeetingRow[] | null;
  north_korea_note: string | null;
}

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "잘못된 weekly id 형식입니다." },
        { status: 400 },
      );
    }

    await requireAdmin(request);
    const supabase = await createApiClient(request);

    const { data: weekly, error } = await supabase
      .from("weeklies")
      .select("id, date, news, meetings, north_korea_note")
      .eq("id", id)
      .maybeSingle<WeeklyForExtraction>();

    if (error) {
      console.error("extract-events SELECT error:", error);
      return NextResponse.json(
        { error: "주보 조회 중 오류가 발생했습니다." },
        { status: 500 },
      );
    }
    if (!weekly) {
      return NextResponse.json(
        { error: "주보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    if (!weekly.date) {
      return NextResponse.json(
        { error: "주보 날짜가 비어 있어 일정 추출을 할 수 없습니다." },
        { status: 400 },
      );
    }

    const result = await extractEventsFromNews({
      anchorDate: weekly.date,
      news: weekly.news ?? [],
      meetings: weekly.meetings ?? [],
      northKoreaNote: weekly.north_korea_note ?? "",
    });

    const body: ExtractEventsResponse = {
      weeklyId: weekly.id,
      anchorDate: weekly.date,
      candidates: result.candidates,
      skipped: result.skipped,
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof z.ZodError) {
      console.error("extract-events Zod error:", err.issues);
      return NextResponse.json(
        { error: "AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요." },
        { status: 502 },
      );
    }
    console.error("extract-events error:", err);
    return NextResponse.json(
      { error: "일정 추출 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
