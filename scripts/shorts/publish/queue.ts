import { shortsDb } from "../../../src/lib/shorts/db";
import { GITHUB_REPO, githubHeaders } from "../../../src/lib/shorts/generation";
import type {
  PublicationLease,
  ShortsPublication,
} from "../../../src/types/shorts";
export type PublishResult =
  | {
      status: "published" | "test_uploaded";
      providerId: string;
      providerUrl: string;
    }
  | {
      status: "retry_wait";
      code: string;
      nextAttemptAt: string;
      consumeRetry?: boolean;
      definiteFailure?: boolean;
    }
  | { status: "needs_attention"; code: string; definiteFailure?: boolean };
export async function claimDuePublication(
  now: Date,
  workerRunId: string,
  mode: "private-test" | "live",
): Promise<PublicationLease | null> {
  const { data, error } = await shortsDb().rpc("shorts_claim_publication", {
    p_now: now.toISOString(),
    p_worker: workerRunId,
    p_mode: mode,
  });
  if (error) throw new Error("publication_claim_failed");
  return data
    ? { publication: data as ShortsPublication, leaseToken: data.lease_token }
    : null;
}
export async function recoverExpiredPublication(
  now: Date,
  workerRunId: string,
  mode: "private-test" | "live",
): Promise<PublicationLease | null> {
  const db = shortsDb(),
    token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const { data, error } = await db
    .from("shorts_publications")
    .select("*")
    .eq("status", "processing")
    .eq("test_only", mode === "private-test")
    .lt("lease_expires_at", now.toISOString())
    .limit(10);
  if (error) throw new Error("recovery_read_failed");
  for (const p of (data ?? []) as ShortsPublication[]) {
    if (!p.worker_run_id || !/^\d+:\d+$/.test(p.worker_run_id)) continue;
    const [run, attempt] = p.worker_run_id.split(":");
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${run}/attempts/${attempt}`,
      { headers: githubHeaders(token), signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) continue;
    const old = await response.json();
    if (old.status !== "completed") continue;
    const { data: lease, error: claimError } = await db.rpc(
      "shorts_recover_publication",
      {
        p_id: p.id,
        p_old_worker: p.worker_run_id,
        p_worker: workerRunId,
        p_now: now.toISOString(),
      },
    );
    if (claimError) throw new Error("recovery_claim_failed");
    if (lease)
      return {
        publication: lease,
        leaseToken: lease.lease_token,
        recovery: true,
      };
  }
  return null;
}
export async function guardPublication(lease: PublicationLease) {
  const { data, error } = await shortsDb().rpc("shorts_guard_publication", {
    p_id: lease.publication.id,
    p_token: lease.leaseToken,
  });
  if (error) throw new Error("publication_guard_failed");
  return data === true;
}
export async function finishPublication(
  lease: PublicationLease,
  result: PublishResult,
) {
  const { data, error } = await shortsDb().rpc("shorts_finish_publication", {
    p_id: lease.publication.id,
    p_token: lease.leaseToken,
    p_result: result,
  });
  if (error || data !== true) throw new Error("publication_finish_failed");
}
export function retryResult(
  code: string,
  attemptCount: number,
  now = new Date(),
  definiteFailure = true,
): PublishResult {
  if (attemptCount >= 3)
    return { status: "needs_attention", code, definiteFailure };
  const delay = [2, 10, 30][attemptCount] * 60000;
  return {
    status: "retry_wait",
    code,
    consumeRetry: true,
    definiteFailure,
    nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
  };
}
export function waitResult(code: string, now = new Date()): PublishResult {
  return {
    status: "retry_wait",
    code,
    nextAttemptAt: new Date(now.getTime() + 60000).toISOString(),
  };
}
