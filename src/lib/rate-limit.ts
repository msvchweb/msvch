import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * IP 기반 rate-limit 헬퍼 — 분 윈도우 + 일 윈도우 동시 체크.
 *
 * chat / chat-inquiry 등 무인증 공개 라우트에서 공유.
 * chat_rate_limit 테이블을 공용으로 사용하되, key prefix 로 라우트별 카운터 분리:
 *   - `chat:<ip>` → /api/chat
 *   - `inquiry:<ip>` → /api/chat/inquiry
 *
 * 동작:
 *   - (prefixed_ip, window_start) upsert → request_count 증가
 *   - 분/일 한도 초과 시 { allowed: false, retryAfter }
 *   - 2일 이상 된 레코드는 fire-and-forget 정리
 */

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

/**
 * Vercel 환경에서는 x-vercel-forwarded-for 가 플랫폼이 신뢰하는 헤더.
 * 그 외 환경(로컬 dev / 비-Vercel) 에서는 x-real-ip → x-forwarded-for 순으로 폴백.
 *
 * 임의의 x-forwarded-for 헤더를 그대로 신뢰하면 헤더 스푸핑으로 분당 한도가 무력화됨.
 */
export function getClientIp(request: NextRequest): string {
  if (process.env.VERCEL) {
    const vfw = request.headers
      .get("x-vercel-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    if (vfw) return vfw;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export interface RateLimitConfig {
  /** chat_rate_limit.ip 컬럼 앞에 붙는 prefix (예: "chat", "inquiry") */
  windowKey: string;
  /** 분당 허용 횟수 */
  perMinute: number;
  /** 일일 허용 횟수 */
  perDay: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const supabase = getSupabase();
  const now = new Date();
  const key = `${config.windowKey}:${ip}`;

  const minuteWindow = new Date(now);
  minuteWindow.setSeconds(0, 0);

  // 오늘 00:00 KST → UTC
  const dayWindow = new Date(now);
  dayWindow.setUTCHours(
    dayWindow.getUTCHours() - ((dayWindow.getUTCHours() + 9) % 24),
    0,
    0,
    0,
  );

  const { data: minuteRow, error: minuteErr } = await supabase
    .from("chat_rate_limit")
    .upsert(
      {
        ip: key,
        window_start: minuteWindow.toISOString(),
        request_count: 1,
      },
      { onConflict: "ip,window_start", ignoreDuplicates: false },
    )
    .select("request_count")
    .single<{ request_count: number }>();

  if (minuteErr) {
    const { data: existing } = await supabase
      .from("chat_rate_limit")
      .select("request_count")
      .eq("ip", key)
      .eq("window_start", minuteWindow.toISOString())
      .single<{ request_count: number }>();

    if (existing) {
      const newCount = existing.request_count + 1;
      await supabase
        .from("chat_rate_limit")
        .update({ request_count: newCount })
        .eq("ip", key)
        .eq("window_start", minuteWindow.toISOString());

      if (newCount > config.perMinute) {
        return { allowed: false, retryAfter: 60 - now.getSeconds() };
      }
    }
  } else if (minuteRow && minuteRow.request_count > config.perMinute) {
    return { allowed: false, retryAfter: 60 - now.getSeconds() };
  }

  const { data: dayRows } = await supabase
    .from("chat_rate_limit")
    .select("request_count")
    .eq("ip", key)
    .gte("window_start", dayWindow.toISOString())
    .returns<{ request_count: number }[]>();

  const dayTotal = (dayRows ?? []).reduce(
    (sum, r) => sum + r.request_count,
    0,
  );

  if (dayTotal > config.perDay) {
    return { allowed: false, retryAfter: 86400 };
  }

  // 2일 이상 된 레코드 정리 (fire-and-forget)
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  supabase
    .from("chat_rate_limit")
    .delete()
    .lt("window_start", cutoff.toISOString())
    .then(() => {
      /* fire-and-forget */
    });

  return { allowed: true };
}

/** HTML 특수문자 이스케이프 — 이메일 템플릿 리터럴 등 신뢰되지 않는 입력 보간용. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
