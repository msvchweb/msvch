import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface CostBucket {
  results?: Array<{
    amount?: {
      value?: number;
      currency?: string;
    };
  }>;
}

interface CostsResponse {
  data?: CostBucket[];
  error?: { message?: string };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const adminKey = process.env.OPENAI_ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json(
        { error: "OPENAI_ADMIN_KEY가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const { startTime, endTime, monthLabel } = getCurrentKoreanMonthRange();
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as CostsResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "OpenAI 비용 조회에 실패했습니다." },
        { status: response.status },
      );
    }

    let totalUsd = 0;
    let currency = "usd";
    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const value = result.amount?.value;
        if (typeof value === "number") totalUsd += value;
        if (result.amount?.currency) currency = result.amount.currency;
      }
    }

    return NextResponse.json({
      totalUsd,
      currency,
      monthLabel,
      startTime,
      endTime,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("openai/monthly-spend error", err);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function getCurrentKoreanMonthRange(): {
  startTime: number;
  endTime: number;
  monthLabel: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    startTime: Math.floor(Date.UTC(year, month - 1, 1, -9) / 1000),
    endTime: Math.floor(Date.UTC(nextYear, nextMonth - 1, 1, -9) / 1000),
    monthLabel: `${month}월`,
  };
}
