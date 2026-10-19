// @vitest-environment node
import { expect, it, vi } from "vitest";
import { enqueueCandidates } from "./enqueue-sermons";
import type {
  SourcePolicy,
  SourceVideo,
} from "../../src/lib/shorts/eligibility";
it("enqueues a video only once in a scan and never automatically retries an existing job", async () => {
  const video: SourceVideo = {
    videoId: "abcdefghijk",
    title: "주일 설교",
    channelId: "church",
    publishedAt: "2026-10-19T00:00:00Z",
    durationSec: 1800,
    category: "sunday",
    liveStatus: "none",
    inSourcePlaylist: true,
  };
  const policy: SourcePolicy = {
    enabled: true,
    sourceChannelId: "church",
    sourcePlaylistId: "sermons",
    allowedCategories: ["sunday"],
    enabledAfter: "2026-10-18T00:00:00Z",
    publishedVideoIds: [],
  };
  const create = vi
    .fn()
    .mockResolvedValue({ jobId: "j", attemptId: "a", status: "pending" });
  expect(
    await enqueueCandidates([video, video], policy, new Set(), create),
  ).toMatchObject({ queued: ["abcdefghijk"] });
  expect(create).toHaveBeenCalledTimes(1);
  create.mockClear();
  await enqueueCandidates([video], policy, new Set(["abcdefghijk"]), create);
  expect(create).not.toHaveBeenCalled();
});
