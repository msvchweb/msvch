// @vitest-environment node
import { expect, it, vi } from "vitest";
import { publishYoutube } from "./youtube";

import { youtubeFixture } from "./test-fixtures";
it("blocks an unexpected channel and expired credentials before upload", async () => {
  const { lease, context } = youtubeFixture();
  context.accountId = "wrong";
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "needs_attention",
    code: "account_mismatch",
  });
  expect(context.request).not.toHaveBeenCalled();
  context.accountId = "channel";
  context.checkpoint = { phase: "uploaded", videoId: "id" };
  vi.mocked(context.request).mockResolvedValue(
    new Response(null, { status: 401 }),
  );
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "needs_attention",
    code: "credentials_expired",
  });
});
it("resumes from the 308 offset, then keeps a test upload private", async () => {
  const { lease, context } = youtubeFixture();
  context.checkpoint = {
    phase: "uploading",
    sessionUri:
      "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=x",
    size: 6,
  };
  vi.mocked(context.request)
    .mockResolvedValueOnce(
      new Response(null, { status: 308, headers: { Range: "bytes=0-2" } }),
    )
    .mockResolvedValueOnce(Response.json({ id: "video" }))
    .mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: "video",
            snippet: { channelId: "channel" },
            status: { privacyStatus: "private", uploadStatus: "processed" },
            processingDetails: { processingStatus: "succeeded" },
          },
        ],
      }),
    );
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "test_uploaded",
    providerId: "video",
  });
  const upload = vi.mocked(context.request).mock.calls[1][1];
  expect(new Headers(upload?.headers).get("Content-Range")).toBe("bytes 3-5/6");
  expect(
    vi.mocked(context.request).mock.calls.some(([, o]) => o?.method === "POST"),
  ).toBe(false);
});
it("recovers a successful upload response from the same session and never starts another", async () => {
  const { lease, context } = youtubeFixture();
  context.checkpoint = {
    phase: "uploading",
    sessionUri:
      "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=x",
    size: 6,
  };
  vi.mocked(context.request)
    .mockResolvedValueOnce(Response.json({ id: "video" }))
    .mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: "video",
            snippet: { channelId: "channel" },
            status: { privacyStatus: "private", uploadStatus: "processed" },
          },
        ],
      }),
    );
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "test_uploaded",
  });
  expect(context.media).not.toHaveBeenCalled();
});
it("sends no bytes when saving the new resumable session fails", async () => {
  const { lease, context } = youtubeFixture();
  vi.mocked(context.request).mockResolvedValue(
    new Response(null, {
      status: 200,
      headers: {
        Location:
          "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=x",
      },
    }),
  );
  vi.mocked(context.save)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("db unavailable"));
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "needs_attention",
  });
  expect(context.request).toHaveBeenCalledTimes(1);
});
it("retains quota when a status query is rate-limited after publication may have succeeded", async () => {
  const { lease, context } = youtubeFixture(false);
  context.checkpoint = { phase: "publishing", videoId: "video" };
  vi.mocked(context.request).mockResolvedValue(
    new Response(null, { status: 429 }),
  );
  expect(await publishYoutube(lease, context)).toMatchObject({
    status: "retry_wait",
    definiteFailure: false,
  });
});
it.each([401, 403])(
  "can reconnect after initial session creation is rejected with %i",
  async (status) => {
    const { lease, context } = youtubeFixture();
    vi.mocked(context.save).mockImplementation(async (value) => {
      context.checkpoint = value;
    });
    vi.mocked(context.request).mockResolvedValueOnce(
      new Response(null, { status }),
    );
    expect(await publishYoutube(lease, context)).toMatchObject({
      status: "needs_attention",
      code: "credentials_expired",
    });
    expect(context.checkpoint).toEqual({ phase: "not_started" });
    context.accessToken = "reconnected-token";
    vi.mocked(context.request)
      .mockReset()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            Location:
              "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=new",
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "video" }))
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              snippet: { channelId: "channel" },
              status: { privacyStatus: "private", uploadStatus: "processed" },
            },
          ],
        }),
      );
    expect(await publishYoutube(lease, context)).toMatchObject({
      status: "test_uploaded",
    });
    expect(context.request).toHaveBeenCalledTimes(3);
  },
);
it("does not recreate an initial session whose response was lost", async () => {
  const { lease, context } = youtubeFixture();
  vi.mocked(context.save).mockImplementation(async (value) => {
    context.checkpoint = value;
  });
  vi.mocked(context.request).mockRejectedValue(new Error("response lost"));
  expect(await publishYoutube(lease, context)).toMatchObject({
    code: "upload_result_unknown",
  });
  expect(context.checkpoint?.phase).toBe("session_creating");
  vi.mocked(context.request).mockClear();
  expect(await publishYoutube(lease, context)).toMatchObject({
    code: "upload_result_unknown",
  });
  expect(context.request).not.toHaveBeenCalled();
});
