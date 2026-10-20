import { shortsDb } from "../../src/lib/shorts/db";
import { IdSchema } from "../../src/lib/shorts/validation";
async function main() {
  const id = IdSchema.parse(process.env.ATTEMPT_ID);
  const { error } = await shortsDb().rpc("shorts_fail_attempt", {
    p_attempt: id,
    p_code: "workflow_failed",
    p_message: "제작 워크플로가 실패했습니다. 실행 기록을 확인하세요.",
    p_run: process.env.GITHUB_RUN_ID,
  });
  if (error) throw new Error("finalize_failed");
}
main().catch(() => {
  console.error("Attempt finalization failed; maintenance will reconcile.");
  process.exitCode = 1;
});
