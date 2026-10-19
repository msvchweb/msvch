export interface RpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
async function client(db?: RpcClient): Promise<RpcClient> {
  return db ?? (await import("./supabase")).supabase;
}
export async function attemptRpc(
  name: string,
  args: Record<string, unknown>,
  db?: RpcClient,
) {
  const { data, error } = await (await client(db)).rpc(name, args);
  if (error) throw new Error(error.message);
  return data === true;
}
export function claimGenerationAttempt(
  attemptId: string,
  runId: string,
  runAttempt: number,
  db?: RpcClient,
) {
  return attemptRpc(
    "shorts_claim_attempt",
    { p_attempt: attemptId, p_run: runId, p_run_attempt: runAttempt },
    db,
  );
}
export function finishGenerationAttempt(
  attemptId: string,
  runId: string,
  runAttempt: number,
  outcome:
    { success: true } | { success: false; code: string; message: string },
  db?: RpcClient,
) {
  return attemptRpc(
    "shorts_finish_attempt",
    {
      p_attempt: attemptId,
      p_run: runId,
      p_run_attempt: runAttempt,
      p_success: outcome.success,
      p_code: outcome.success ? null : outcome.code,
      p_message: outcome.success ? null : outcome.message,
    },
    db,
  );
}
export async function updateAttempt(
  attemptId: string,
  runId: string,
  runAttempt: number,
  stage: string,
  db?: RpcClient,
  source?: string,
) {
  if (
    !(await attemptRpc(
      "shorts_update_attempt",
      {
        p_attempt: attemptId,
        p_run: runId,
        p_run_attempt: runAttempt,
        p_stage: stage,
        p_source: source ?? null,
      },
      db,
    ))
  )
    throw new Error("attempt_ownership_lost");
}
