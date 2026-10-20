import { GenerationRequestSchema, IdSchema } from "./validation";
import { shortsDb } from "./db";
import type { RpcClient } from "../../../scripts/shorts/lib/attempts";
export class ShortsError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export interface GenerationResult {
  jobId: string;
  attemptId: string;
  status: "pending";
}
type Dependencies = { db: RpcClient; token?: string; fetch: typeof fetch };
export const GITHUB_REPO = "msvchweb/msvch";
export function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
async function dispatch(
  result: GenerationResult,
  input: { videoId: string; count: number },
  d: Dependencies,
) {
  let code: string | undefined;
  if (!d.token) code = "github_token_missing";
  else {
    try {
      const response = await d.fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sermon-shorts.yml/dispatches`,
        {
          method: "POST",
          headers: githubHeaders(d.token),
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            ref: process.env.SHORTS_WORKFLOW_REF || "main",
            inputs: {
              videoId: input.videoId,
              jobId: result.jobId,
              attemptId: result.attemptId,
              count: String(input.count),
            },
          }),
        },
      );
      // 5xx or lost response may have accepted the dispatch; reconcile before any retry.
      if (response.status >= 400 && response.status < 500)
        code = `dispatch_${response.status}`;
    } catch {
      /* Retain queued. Do not dispatch twice on response loss. */
    }
  }
  if (code) {
    const { error } = await d.db.rpc("shorts_fail_attempt", {
      p_attempt: result.attemptId,
      p_code: code,
      p_message: "제작 실행 요청 실패: 관리자 설정을 확인하세요.",
    });
    if (error) throw new ShortsError("제작 상태 저장에 실패했습니다.", 503);
    throw new ShortsError(code, 502);
  }
  return result;
}
export async function createGeneration(
  request: unknown,
  dependencies?: Dependencies,
): Promise<GenerationResult> {
  const input = GenerationRequestSchema.parse(request);
  const d = dependencies ?? {
    db: shortsDb(),
    token: process.env.GITHUB_PAT,
    fetch,
  };
  const { data, error } = await d.db.rpc("shorts_create_generation", {
    p_request: input,
  });
  if (error)
    throw new ShortsError(
      "이미 작업이 있거나 제작 요청을 저장하지 못했습니다.",
    );
  return dispatch(data as GenerationResult, input, d);
}
export async function retryGeneration(
  jobId: string,
): Promise<GenerationResult> {
  IdSchema.parse(jobId);
  const db = shortsDb();
  const { data: job, error: jobError } = await db
    .from("shorts_jobs")
    .select("video_id,highlight_count,status,active_attempt_id")
    .eq("id", jobId)
    .single();
  if (jobError || !job) throw new ShortsError("작업을 찾을 수 없습니다.", 404);
  if (
    !job.active_attempt_id &&
    ["pending", "downloading", "transcribing", "selecting", "editing"].includes(
      job.status,
    )
  ) {
    await assertLegacyRunnerIdle(process.env.GITHUB_PAT);
  }
  const { data: attempt, error } = await db.rpc("shorts_create_attempt", {
    p_job: jobId,
  });
  if (error || !attempt)
    throw new ShortsError(
      "실행 중이거나 승인된 클립이 있는 작업은 다시 만들 수 없습니다.",
    );
  return dispatch(
    { jobId, attemptId: attempt.id, status: "pending" },
    { videoId: job.video_id, count: job.highlight_count },
    { db, token: process.env.GITHUB_PAT, fetch },
  );
}
export async function assertLegacyRunnerIdle(
  token?: string,
  fetcher: typeof fetch = fetch,
) {
  if (!token)
    throw new ShortsError("기존 실행을 확인할 GitHub 권한이 필요합니다.", 503);
  for (const status of [
    "queued",
    "in_progress",
    "waiting",
    "pending",
    "requested",
  ]) {
    const response = await fetcher(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sermon-shorts.yml/runs?status=${status}&per_page=1`,
      {
        headers: githubHeaders(token),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new ShortsError(
        "기존 GitHub 실행 상태를 확인하지 못했습니다.",
        503,
      );
    const data = await response.json();
    if (data.workflow_runs?.length)
      throw new ShortsError(
        "기존 제작 실행이 남아 있습니다. Actions 종료 상태를 먼저 확인하세요.",
      );
  }
}
export async function cancelQueuedGeneration(jobId: string) {
  IdSchema.parse(jobId);
  const db = shortsDb();
  const { data: job, error } = await db
    .from("shorts_jobs")
    .select("active_attempt_id")
    .eq("id", jobId)
    .single();
  if (error || !job?.active_attempt_id)
    throw new ShortsError("대기 중인 제작 요청이 없습니다.");
  const { data, error: cancelError } = await db.rpc("shorts_fail_attempt", {
    p_attempt: job.active_attempt_id,
    p_code: "operator_canceled_queued",
    p_message: "관리자가 대기 요청을 취소했습니다.",
  });
  if (cancelError || data !== true)
    throw new ShortsError(
      "이미 실행 중인 작업은 대기 취소할 수 없습니다. Actions 기록을 확인하세요.",
    );
  return { ok: true };
}
