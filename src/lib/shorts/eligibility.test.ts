// @vitest-environment node
import { expect, it } from "vitest";
import {
  isEligibleForAutoGeneration,
  type SourceVideo,
  type SourcePolicy,
} from "./eligibility";
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
it("accepts only new allowed sermons, excluding shorts, livestreams and other sources", () => {
  expect(isEligibleForAutoGeneration(video, policy)).toBe(true);
  for (const patch of [
    { channelId: "other" },
    { inSourcePlaylist: false },
    { durationSec: 180 },
    { durationSec: 0 },
    { liveStatus: "live" },
    { liveStatus: "upcoming" },
    { publishedAt: "2026-10-17T00:00:00Z" },
    { category: "praise" },
    { title: "주일 예배 전체 실황" },
  ])
    expect(isEligibleForAutoGeneration({ ...video, ...patch }, policy)).toBe(
      false,
    );
  expect(
    isEligibleForAutoGeneration(video, { ...policy, enabled: false }),
  ).toBe(false);
  expect(
    isEligibleForAutoGeneration(video, { ...policy, sourcePlaylistId: "" }),
  ).toBe(false);
  expect(
    isEligibleForAutoGeneration(video, {
      ...policy,
      publishedVideoIds: ["abcdefghijk"],
    }),
  ).toBe(false);
});
