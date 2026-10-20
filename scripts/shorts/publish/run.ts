import { pathToFileURL } from "node:url";
import { shortsDb } from "../../../src/lib/shorts/db";
import type { PublicationLease } from "../../../src/types/shorts";
import {
  claimDuePublication,
  recoverExpiredPublication,
  finishPublication,
  type PublishResult,
} from "./queue";
import { createPublishContext, safeFailure } from "./context";
import { publishYoutube } from "./youtube";
import { publishInstagram } from "./instagram";
export interface TickDependencies {
  enabled: () => Promise<boolean>;
  claim: typeof claimDuePublication;
  recover: typeof recoverExpiredPublication;
  execute: (lease: PublicationLease, deadline: Date) => Promise<PublishResult>;
  finish: typeof finishPublication;
  clock: () => Date;
}
async function execute(
  lease: PublicationLease,
  deadline: Date,
): Promise<PublishResult> {
  const controller = new AbortController(),
    remaining = deadline.getTime() - Date.now();
  const stop = setTimeout(() => controller.abort(), Math.max(1, remaining));
  let pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (pending) return;
    pending = (async () => {
      const { data, error } = await shortsDb().rpc(
        "shorts_publication_checkpoint",
        { p_id: lease.publication.id, p_token: lease.leaseToken },
      );
      if (error || data !== true) controller.abort();
    })()
      .catch(() => {
        controller.abort();
      })
      .finally(() => {
        pending = undefined;
      });
  }, 30000);
  let ctx: Awaited<ReturnType<typeof createPublishContext>> | undefined;
  try {
    ctx = await createPublishContext(lease, controller.signal);
    return lease.publication.platform === "youtube"
      ? await publishYoutube(lease, ctx)
      : await publishInstagram(lease, ctx);
  } catch (e) {
    return { status: "needs_attention", code: safeFailure(e) };
  } finally {
    clearInterval(timer);
    clearTimeout(stop);
    await pending;
    await ctx?.cleanup();
  }
}
function defaults(): TickDependencies {
  return {
    async enabled() {
      const { data, error } = await shortsDb()
        .from("shorts_settings")
        .select("publishing_enabled")
        .eq("id", 1)
        .single();
      if (error) throw new Error("settings_read_failed");
      return data?.publishing_enabled === true;
    },
    claim: claimDuePublication,
    recover: recoverExpiredPublication,
    execute,
    finish: finishPublication,
    clock: () => new Date(),
  };
}
export async function runPublishTick(
  options: {
    now: Date;
    workerRunId: string;
    mode: "dry-run" | "private-test" | "live";
  },
  d = defaults(),
) {
  const result = { processed: 0, deferred: 0, errors: 0, ids: [] as string[] };
  if (options.mode === "dry-run" || !(await d.enabled())) return result;
  const stopClaimAt = options.now.getTime() + 18 * 60000,
    deadline = new Date(options.now.getTime() + 19 * 60000);
  for (let i = 0; i < 50 && d.clock().getTime() < stopClaimAt; i++) {
    if (!(await d.enabled())) break;
    const lease =
      (await d.recover(d.clock(), options.workerRunId, options.mode)) ??
      (await d.claim(d.clock(), options.workerRunId, options.mode));
    if (!lease) break;
    const p = lease.publication;
    result.ids.push(p.id);
    if (
      (options.mode === "private-test" &&
        (!p.test_only || p.platform !== "youtube")) ||
      (options.mode === "live" && p.test_only)
    ) {
      await d.finish(lease, {
        status: "needs_attention",
        code: "worker_mode_mismatch",
      });
      result.errors++;
      continue;
    }
    const published = await d.execute(lease, deadline);
    await d.finish(lease, published);
    if (
      published.status === "published" ||
      published.status === "test_uploaded"
    )
      result.processed++;
    else if (published.status === "retry_wait") result.deferred++;
    else result.errors++;
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const mode =
    process.argv.find((a) => a.startsWith("--mode="))?.slice(7) ?? "dry-run";
  if (!["dry-run", "private-test", "live"].includes(mode)) {
    console.error("Invalid publish mode.");
    process.exitCode = 1;
  } else {
    const runId = process.env.GITHUB_RUN_ID,
      attempt = process.env.GITHUB_RUN_ATTEMPT;
    if (mode !== "dry-run" && (!runId || !attempt)) {
      console.error("GitHub run identity required for publication.");
      process.exitCode = 1;
    } else
      runPublishTick({
        now: new Date(),
        workerRunId: (runId ?? "local") + ":" + (attempt ?? "0"),
        mode: mode as "dry-run" | "private-test" | "live",
      })
        .then((result) => {
          console.log(JSON.stringify(result));
          if (result.errors) process.exitCode = 1;
        })
        .catch(() => {
          console.error(
            "Publish tick failed. Inspect queue state before retrying.",
          );
          process.exitCode = 1;
        });
  }
}
