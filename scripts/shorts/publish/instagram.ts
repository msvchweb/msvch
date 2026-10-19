import { z } from "zod";
import type { PublicationLease } from "../../../src/types/shorts";
import {
  createPublishContext,
  safeFailure,
  type PublishContext,
  type Checkpoint,
} from "./context";
import { retryResult, waitResult, type PublishResult } from "./queue";
const Id = z.object({ id: z.string().min(1) });
export async function publishInstagram(
  lease: PublicationLease,
  supplied?: PublishContext,
): Promise<PublishResult> {
  let ctx = supplied,
    cp: Checkpoint | null = supplied?.checkpoint ?? null;
  try {
    ctx ??= await createPublishContext(lease);
    cp = ctx.checkpoint ? { ...ctx.checkpoint } : null;
    const p = lease.publication;
    const save = async (value: Checkpoint) => {
      try {
        await ctx!.save(value);
      } catch {
        throw new Error("checkpoint_failed");
      }
    };
    if (p.test_only)
      return {
        status: "needs_attention",
        code: "instagram_private_test_unsupported",
      };
    if (ctx.accountId !== ctx.expectedAccountId)
      return { status: "needs_attention", code: "account_mismatch" };
    if (
      !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(ctx.accountType ?? "")
    )
      return {
        status: "needs_attention",
        code: "professional_account_required",
      };
    const endpoint = (id: string) =>
      ctx!.apiBase + "/" + encodeURIComponent(id);
    const failure = (r: Response, safe = false): PublishResult => {
      if (r.status === 401 || r.status === 403)
        return { status: "needs_attention", code: "credentials_expired" };
      if (r.status === 429 && safe)
        return retryResult("rate_limited", p.attempt_count, ctx!.now(), false);
      if (r.status >= 500 && safe)
        return retryResult(
          "provider_temporary",
          p.attempt_count,
          ctx!.now(),
          false,
        );
      return { status: "needs_attention", code: "instagram_response_unknown" };
    };
    if (cp?.mediaId) {
      const response = await ctx.request(
        endpoint(cp.mediaId) + "?fields=id,permalink",
      );
      if (!response.ok) return failure(response, true);
      const data = z
        .object({ id: z.string(), permalink: z.url() })
        .parse(await response.json());
      if (
        !["www.instagram.com", "instagram.com"].includes(
          new URL(data.permalink).hostname,
        )
      )
        throw new Error("invalid_permalink");
      return {
        status: "published",
        providerId: data.id,
        providerUrl: data.permalink,
      };
    }
    if (!cp || cp.phase === "not_started") {
      if (lease.recovery && !cp)
        return {
          status: "needs_attention",
          code: "instagram_container_result_unknown",
        };
      if (!(await ctx.guard()))
        return waitResult("publishing_paused", ctx.now());
      cp = { phase: "container_creating", recreated: cp?.recreated ?? 0 };
      await save(cp);
      const response = await ctx.request(endpoint(ctx.accountId) + "/media", {
        method: "POST",
        body: new URLSearchParams({
          media_type: "REELS",
          video_url: ctx.clip.video_url!,
          caption: ctx.clip.caption_ig ?? "",
          share_to_feed: "true",
        }),
      });
      if (!response.ok) {
        // Confirmed rejection is restartable after reconnect; response loss is not.
        if ([401, 403, 429].includes(response.status)) {
          await save({ phase: "not_started", recreated: cp.recreated });
          return failure(response, true);
        }
        return failure(response);
      }
      cp = {
        ...cp,
        phase: "processing",
        containerId: Id.parse(await response.json()).id,
      };
      await save(cp);
    }
    if (!cp.containerId)
      return {
        status: "needs_attention",
        code: "instagram_container_result_unknown",
      };
    const status = await ctx.request(
      endpoint(cp.containerId) + "?fields=status_code,status",
    );
    if (!status.ok) return failure(status, true);
    const state = z
      .object({ status_code: z.string() })
      .parse(await status.json()).status_code;
    if (cp.phase === "publishing" || state === "PUBLISHED")
      return {
        status: "needs_attention",
        code: "instagram_publish_result_unknown",
      };
    if (state === "IN_PROGRESS")
      return waitResult("provider_processing", ctx.now());
    if (
      state === "EXPIRED" &&
      cp.phase === "processing" &&
      (cp.recreated ?? 0) < 1
    ) {
      const next = { phase: "not_started", recreated: (cp.recreated ?? 0) + 1 };
      await save(next);
      return publishInstagram(lease, { ...ctx, checkpoint: next });
    }
    if (state !== "FINISHED")
      return {
        status: "needs_attention",
        code: "instagram_container_" + state.toLowerCase(),
        definiteFailure: true,
      };
    if (!(await ctx.guard())) return waitResult("publishing_paused", ctx.now());
    cp = { ...cp, phase: "publishing" };
    await save(cp);
    const publish = await ctx.request(
      endpoint(ctx.accountId) + "/media_publish",
      {
        method: "POST",
        body: new URLSearchParams({ creation_id: cp.containerId! }),
      },
    );
    if (!publish.ok) {
      if (publish.status === 429) {
        cp = { ...cp, phase: "processing" };
        await save(cp);
        return failure(publish, true);
      }
      return failure(publish);
    }
    cp = {
      ...cp,
      phase: "published",
      mediaId: Id.parse(await publish.json()).id,
    };
    await save(cp);
    return publishInstagram(lease, { ...ctx, checkpoint: cp });
  } catch (e) {
    const code = safeFailure(e);
    return {
      status: "needs_attention",
      code:
        code === "publication_interrupted"
          ? cp?.phase === "publishing"
            ? "instagram_publish_result_unknown"
            : "instagram_result_unknown"
          : code,
    };
  } finally {
    if (!supplied) await ctx?.cleanup();
  }
}
