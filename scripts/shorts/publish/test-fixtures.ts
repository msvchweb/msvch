import { vi } from "vitest";
import type { PublishContext } from "./context";
import type { PublicationLease } from "../../../src/types/shorts";
export function youtubeFixture(testOnly = true) {
  const lease = {
    publication: {
      id: "p",
      clip_id: "c",
      platform: "youtube",
      test_only: testOnly,
      scheduled_at: "2026-01-01",
      attempt_count: 0,
    },
    leaseToken: "lease",
  } as PublicationLease;
  const context = {
    publication: lease.publication,
    clip: {
      title: "제목",
      title_yt: "제목",
      caption_yt: "설명",
      video_url: "https://cdn.example.com/shorts/a/b/clip_0.mp4",
    },
    checkpoint: null,
    accountId: "channel",
    expectedAccountId: "channel",
    accountType: "BUSINESS",
    accessToken: "token",
    apiBase: "https://graph.instagram.com/v23.0",
    request: vi.fn(),
    save: vi.fn(),
    guard: vi.fn().mockResolvedValue(true),
    now: () => new Date("2026-10-19T00:00:00Z"),
    media: vi.fn().mockResolvedValue({
      size: 6,
      body: (offset: number) =>
        new Uint8Array(Buffer.from("abcdef").subarray(offset)),
    }),
    cleanup: vi.fn(),
  } as unknown as PublishContext;
  return { lease, context };
}
