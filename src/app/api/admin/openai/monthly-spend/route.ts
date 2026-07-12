import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface CostBucket {
  start_time?: number;
  end_time?: number;
  results?: Array<{
    amount?: {
      value?: number | string;
      currency?: string;
    };
    line_item?: string | null;
    project_id?: string | null;
  }>;
}

interface CostsResponse {
  data?: CostBucket[];
  next_page?: string | null;
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

    const debug = request.nextUrl.searchParams.get("debug") === "1";
    const { startTime, monthLabel } = getCurrentKoreanMonthRange();
    const { data, error, status } = await fetchMonthlyCosts(adminKey, startTime);
    if (error) return NextResponse.json({ error }, { status });

    let totalUsd = 0;
    let currency = "usd";
    for (const bucket of data.data ?? []) {
      for (const result of bucket.results ?? []) {
        const value = parseAmount(result.amount?.value);
        if (value !== null) totalUsd += value;
        if (result.amount?.currency) currency = result.amount.currency;
      }
    }

    return NextResponse.json({
      totalUsd,
      currency,
      monthLabel,
      startTime,
      ...(debug ? { debug: buildDebugSummary(data) } : {}),
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

async function fetchMonthlyCosts(
  adminKey: string,
  startTime: number,
): Promise<{ data: CostsResponse; status: number; error?: string }> {
  const headers = {
    Authorization: `Bearer ${adminKey}`,
    "Content-Type": "application/json",
  };
  const allBuckets: CostBucket[] = [];
  let page: string | null | undefined;

  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, { headers, cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as CostsResponse;
    if (!response.ok) {
      return {
        data,
        status: response.status,
        error: data.error?.message ?? "OpenAI 비용 조회에 실패했습니다.",
      };
    }

    allBuckets.push(...(data.data ?? []));
    page = data.next_page;
  } while (page);

  return { data: { data: allBuckets }, status: 200 };
}

function parseAmount(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildDebugSummary(data: CostsResponse) {
  const buckets = data.data ?? [];
  const results = buckets.flatMap((bucket) => bucket.results ?? []);
  return {
    bucketCount: buckets.length,
    resultCount: results.length,
    nonZeroResultCount: results.filter((result) => {
      const value = parseAmount(result.amount?.value);
      return value !== null && value !== 0;
    }).length,
    firstBuckets: buckets.slice(0, 3).map((bucket) => ({
      startTime: bucket.start_time ?? null,
      endTime: bucket.end_time ?? null,
      resultCount: bucket.results?.length ?? 0,
      results: (bucket.results ?? []).slice(0, 3).map((result) => ({
        amount: result.amount ?? null,
        lineItem: result.line_item ?? null,
        projectId: result.project_id ?? null,
      })),
    })),
  };
}

function getCurrentKoreanMonthRange(): {
  startTime: number;
  monthLabel: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return {
    startTime: Math.floor(Date.UTC(year, month - 1, 1, -9) / 1000),
    monthLabel: `${month}월`,
  };
}
