import { shortsDb } from "./db";
import { ApprovalRequestSchema, IdSchema } from "./validation";
import { ShortsError, GITHUB_REPO, githubHeaders } from "./generation";
export async function approveAndSchedule(clipId: string, request: unknown) {
  IdSchema.parse(clipId);
  const body = ApprovalRequestSchema.parse(request);
  const { data, error } = await shortsDb().rpc("shorts_approve_schedule", {
    p_clip: clipId,
    p_version: body.expectedVersion,
    p_platforms: body.platforms,
    p_scheduled: body.scheduledAt,
    p_test: body.testOnly,
  });
  if (error)
    throw new ShortsError(
      "예약하지 못했습니다. 최신 버전·영상 검사·계정 연결 상태를 확인하세요.",
    );
  // Queue commit survives dispatch failure. Scheduled ticks will still find it.
  const token = process.env.GITHUB_PAT;
  if (token)
    try {
      await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/shorts-publish.yml/dispatches`,
        {
          method: "POST",
          headers: githubHeaders(token),
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            ref: process.env.SHORTS_WORKFLOW_REF || "main",
            inputs: { mode: body.testOnly ? "private-test" : "live" },
          }),
        },
      );
    } catch {
      /* A dispatch error must not roll back the approval or create another publication. */
    }
  return data;
}
export async function changePublication(
  id: string,
  action: "retry" | "cancel",
) {
  IdSchema.parse(id);
  const { error } = await shortsDb().rpc("shorts_change_publication", {
    p_id: id,
    p_action: action,
  });
  if (error)
    throw new ShortsError(
      "현재 상태에서는 변경할 수 없습니다. 결과가 불명확한 게시 건은 먼저 플랫폼 기록을 확인하세요.",
    );
  return { ok: true };
}
