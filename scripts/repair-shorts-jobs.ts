import { IdSchema } from "../src/lib/shorts/validation";
import { reconcileJobs } from "./shorts/reconcile-jobs";
import { cancelQueuedGeneration } from "../src/lib/shorts/generation";
const jobId = process.argv.find((a) => a.startsWith("--jobId="))?.slice(8);
async function main() {
  IdSchema.parse(jobId);
  if (process.argv.includes("--cancelQueued"))
    await cancelQueuedGeneration(jobId!);
  await reconcileJobs(jobId);
  console.log(
    "Selected job reconciled. Retry through the admin page if it is failed.",
  );
}
main().catch(() => {
  console.error(
    "Repair failed. Supply one valid --jobId and GitHub/DB credentials.",
  );
  process.exitCode = 1;
});
