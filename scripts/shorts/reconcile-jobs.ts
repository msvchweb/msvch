import { shortsDb } from "../../src/lib/shorts/db";
import { GITHUB_REPO, githubHeaders } from "../../src/lib/shorts/generation";
import type { ShortsAttempt } from "../../src/types/shorts";
export function terminalFailure(run: {
  status: string;
  conclusion: string | null;
}) {
  return (
    run.status === "completed" &&
    [
      "failure",
      "cancelled",
      "timed_out",
      "action_required",
      "startup_failure",
      "stale",
    ].includes(run.conclusion ?? "")
  );
}
interface Run {
  id: number;
  run_attempt: number;
  display_title: string;
  status: string;
  conclusion: string | null;
}
export async function reconcileJobs(jobId?: string) {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("github_token_missing");
  const db = shortsDb();
  let query = db
    .from("shorts_job_attempts")
    .select("*")
    .in("status", ["queued", "running"]);
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error) throw new Error("attempts_read_failed");
  const headers = githubHeaders(token);
  async function get(url: string) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`github_read_${r.status}`);
    return r.json();
  }
  for (const a of (data ?? []) as ShortsAttempt[]) {
    let run: Run | undefined;
    if (a.github_run_id) {
      run = await get(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${a.github_run_id}/attempts/${a.github_run_attempt}`,
      );
    } else {
      for (let page = 1; page <= 10 && !run; page++) {
        const since = new Date(Date.parse(a.created_at) - 60000).toISOString();
        const response = await get(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sermon-shorts.yml/runs?per_page=100&page=${page}&created=${encodeURIComponent(">=" + since)}`,
        );
        const runs = response.workflow_runs as Run[];
        run = runs.find((r) => r.display_title.includes(a.id));
        if (runs.length < 100) break;
      }
    }
    // Success should already have committed the DB result; otherwise expose the unfinished transition.
    if (
      run &&
      (terminalFailure(run) ||
        (run.status === "completed" && run.conclusion === "success"))
    ) {
      const { error: updateError } = await db.rpc("shorts_fail_attempt", {
        p_attempt: a.id,
        p_code:
          run.conclusion === "success"
            ? "runner_completed_without_result"
            : `github_${run.conclusion}`,
        p_message:
          "GitHub 실행이 종료되었습니다. 기록을 확인한 뒤 재시도하세요.",
        p_run: String(run.id),
      });
      if (updateError) throw new Error("attempt_reconcile_failed");
    }
  }
}
