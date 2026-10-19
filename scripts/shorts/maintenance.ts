import { reconcileJobs } from "./reconcile-jobs";
import { enqueueSermons } from "./enqueue-sermons";
async function main() {
  await reconcileJobs();
  const result = await enqueueSermons();
  console.log(JSON.stringify(result));
  if (result.failed.length) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Shorts maintenance failed. Check workflow permissions, configuration and job states.",
  );
  process.exitCode = 1;
});
