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
function sessionUrl(value: string) {
  const url = new URL(value);
  if (
    url.origin !== "https://www.googleapis.com" ||
    !url.pathname.startsWith("/upload/youtube/v3/videos")
  )
    throw new Error("provider_url_not_allowed");
  return url.toString();
}
export async function publishYoutube(
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
    if (ctx.accountId !== ctx.expectedAccountId)
      return { status: "needs_attention", code: "account_mismatch" };
    if (p.platform !== "youtube")
      return { status: "needs_attention", code: "platform_mismatch" };
    const request = ctx.request;
    const failure = (r: Response, knownSafe = false): PublishResult => {
      if (r.status === 401 || r.status === 403)
        return { status: "needs_attention", code: "credentials_expired" };
      if (r.status === 429)
        return retryResult("rate_limited", p.attempt_count, ctx!.now(), false);
      if (r.status >= 500 && knownSafe)
        return retryResult(
          "provider_temporary",
          p.attempt_count,
          ctx!.now(),
          false,
        );
      return { status: "needs_attention", code: "youtube_response_unknown" };
    };
    if (!cp || cp.phase === "not_started") {
      if (lease.recovery && !cp)
        return { status: "needs_attention", code: "upload_result_unknown" };
      if (!(await ctx.guard()))
        return waitResult("publishing_paused", ctx.now());
      const media = await ctx.media();
      cp = { phase: "session_creating", size: media.size };
      await save(cp);
      const start = await request(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Upload-Content-Length": String(media.size),
            "X-Upload-Content-Type": "video/mp4",
          },
          body: JSON.stringify({
            snippet: {
              title: ctx.clip.title_yt ?? ctx.clip.title,
              description: ctx.clip.caption_yt ?? "",
              categoryId: "22",
            },
            status: {
              privacyStatus: "private",
              selfDeclaredMadeForKids: false,
            },
          }),
        },
      );
      if (!start.ok) {
        // A returned auth/rate rejection created no upload. A lost response stays ambiguous.
        if ([401, 403, 429].includes(start.status)) {
          await save({ phase: "not_started" });
          return failure(start, true);
        }
        return failure(start);
      }
      const location = start.headers.get("Location");
      if (!location)
        return { status: "needs_attention", code: "upload_session_missing" };
      cp = {
        phase: "uploading",
        sessionUri: sessionUrl(location),
        size: media.size,
      };
      await save(cp);
    }
    if (!cp.videoId) {
      if (!cp.sessionUri || !cp.size)
        return { status: "needs_attention", code: "upload_result_unknown" };
      const uri = sessionUrl(cp.sessionUri);
      // Always query the original session before resuming, including after response loss.
      const status = await request(uri, {
        method: "PUT",
        headers: {
          "Content-Length": "0",
          "Content-Range": `bytes */${cp.size}`,
        },
      });
      if (status.ok) {
        cp = {
          ...cp,
          phase: "uploaded",
          videoId: Id.parse(await status.json()).id,
        };
        await save(cp);
      } else if (status.status === 308) {
        const range = status.headers.get("Range"),
          match = range?.match(/^bytes=0-(\d+)$/);
        if (range && !match)
          return { status: "needs_attention", code: "upload_offset_invalid" };
        const offset = match ? Number(match[1]) + 1 : 0;
        if (offset >= cp.size)
          return waitResult("provider_processing", ctx.now());
        const media = await ctx.media();
        if (media.size !== cp.size)
          return { status: "needs_attention", code: "media_changed" };
        if (!(await ctx.guard()))
          return waitResult("publishing_paused", ctx.now());
        const response = await request(uri, {
          method: "PUT",
          duplex: "half",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(media.size - offset),
            "Content-Range": `bytes ${offset}-${media.size - 1}/${media.size}`,
          },
          body: media.body(offset),
        });
        if (response.status === 308)
          return retryResult(
            "provider_temporary",
            p.attempt_count,
            ctx.now(),
            false,
          );
        if (!response.ok) return failure(response, true);
        cp = {
          ...cp,
          phase: "uploaded",
          videoId: Id.parse(await response.json()).id,
        };
        await save(cp);
      } else if (status.status === 404)
        return { status: "needs_attention", code: "upload_session_expired" };
      else return failure(status, true);
    }
    const videoId = cp.videoId!;
    const readVideo = () =>
      request(
        "https://www.googleapis.com/youtube/v3/videos?part=snippet,status,processingDetails&id=" +
          encodeURIComponent(videoId),
      );
    const response = await readVideo();
    if (!response.ok) return failure(response, true);
    const video = (await response.json()).items?.[0] as
      | {
          snippet?: { channelId?: string };
          status?: { privacyStatus?: string; uploadStatus?: string };
          processingDetails?: { processingStatus?: string };
        }
      | undefined;
    if (!video || video.snippet?.channelId !== ctx.accountId)
      return { status: "needs_attention", code: "account_or_video_mismatch" };
    if (
      ["failed", "terminated"].includes(
        video.processingDetails?.processingStatus ?? "",
      ) ||
      ["failed", "rejected", "deleted"].includes(
        video.status?.uploadStatus ?? "",
      )
    )
      return {
        status: "needs_attention",
        code: "youtube_processing_failed",
        definiteFailure: true,
      };
    const providerUrl =
      "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId);
    if (p.test_only) {
      if (video.status?.privacyStatus !== "private")
        return { status: "needs_attention", code: "test_privacy_changed" };
      if (
        video.processingDetails?.processingStatus !== "succeeded" &&
        video.status?.uploadStatus !== "processed"
      )
        return waitResult("provider_processing", ctx.now());
      return { status: "test_uploaded", providerId: videoId, providerUrl };
    }
    if (video.status?.privacyStatus === "public")
      return { status: "published", providerId: videoId, providerUrl };
    if (
      video.processingDetails?.processingStatus !== "succeeded" &&
      video.status?.uploadStatus !== "processed"
    )
      return waitResult("provider_processing", ctx.now());
    if (
      Date.parse(p.scheduled_at) > ctx.now().getTime() ||
      !(await ctx.guard())
    )
      return waitResult("publishing_paused", ctx.now());
    cp = { ...cp, phase: "publishing" };
    await save(cp);
    const publish = await request(
      "https://www.googleapis.com/youtube/v3/videos?part=status",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: videoId,
          status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
        }),
      },
    );
    if (!publish.ok) return failure(publish, true);
    const verify = await readVideo();
    if (!verify.ok) return failure(verify, true);
    if ((await verify.json()).items?.[0]?.status?.privacyStatus !== "public")
      return waitResult("provider_processing", ctx.now());
    return { status: "published", providerId: videoId, providerUrl };
  } catch (e) {
    const code = safeFailure(e);
    if (code !== "publication_interrupted")
      return { status: "needs_attention", code };
    if (ctx && (cp?.sessionUri || cp?.videoId))
      return retryResult(
        "provider_temporary",
        lease.publication.attempt_count,
        ctx.now(),
        false,
      );
    return { status: "needs_attention", code: "upload_result_unknown" };
  } finally {
    if (!supplied) await ctx?.cleanup();
  }
}
