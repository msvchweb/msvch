import os from "node:os";
import path from "node:path";
import { IdSchema } from "../../../src/lib/shorts/validation";
export const WORK_DIR = path.join(os.tmpdir(), "shorts");
export function getAttemptDir(jobId: string, attemptId: string) {
  IdSchema.parse(jobId);
  IdSchema.parse(attemptId);
  return path.join(WORK_DIR, jobId, attemptId);
}
