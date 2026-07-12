"use client";

import { useEffect, useState } from "react";

interface SpendResponse {
  totalUsd?: number;
  currency?: string;
  monthLabel?: string;
  error?: string;
}

export function OpenAIMonthlySpendBadge() {
  const [loading, setLoading] = useState(true);
  const [spend, setSpend] = useState<SpendResponse | null>(null);
  const fallbackMonth = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/openai/monthly-spend", {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as SpendResponse;
        if (!cancelled) setSpend(response.ok ? data : { ...data, totalUsd: undefined });
      } catch {
        if (!cancelled) setSpend(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
        총 사용량 불러오는 중
      </span>
    );
  }

  const monthLabel = spend?.monthLabel ?? fallbackMonth;
  const value =
    typeof spend?.totalUsd === "number"
      ? `$${spend.totalUsd.toFixed(2)}`
      : "-";

  return (
    <span className="inline-flex rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
      총 사용량 {value} / {monthLabel}
    </span>
  );
}
