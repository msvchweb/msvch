// @vitest-environment node
import { expect, it, vi } from "vitest";
import { publishInstagram } from "./instagram";
import { youtubeFixture } from "./test-fixtures";
function fixture() {
  const f = youtubeFixture(false);
  f.lease.publication.platform = "instagram";
  return f;
}
it("refuses wrong/nonprofessional accounts before creating a container", async () => {
  const { lease, context } = fixture();
  context.accountType = "PERSONAL";
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "needs_attention",
    code: "professional_account_required",
  });
  expect(context.request).not.toHaveBeenCalled();
});
it("polls IN_PROGRESS without publishing or consuming a failure retry", async () => {
  const { lease, context } = fixture();
  context.checkpoint = { phase: "processing", containerId: "container" };
  vi.mocked(context.request).mockResolvedValue(
    Response.json({ status_code: "IN_PROGRESS" }),
  );
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "retry_wait",
    code: "provider_processing",
  });
  expect(context.request).toHaveBeenCalledTimes(1);
});
it("publishes only FINISHED and returns the confirmed media permalink", async () => {
  const { lease, context } = fixture();
  context.checkpoint = { phase: "processing", containerId: "container" };
  vi.mocked(context.request)
    .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
    .mockResolvedValueOnce(Response.json({ id: "media" }))
    .mockResolvedValueOnce(
      Response.json({
        id: "media",
        permalink: "https://www.instagram.com/reel/example/",
      }),
    );
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "published",
    providerId: "media",
  });
});
it("never republishes when a previous publish response was lost", async () => {
  const { lease, context } = fixture();
  context.checkpoint = { phase: "publishing", containerId: "container" };
  vi.mocked(context.request).mockResolvedValue(
    Response.json({ status_code: "PUBLISHED" }),
  );
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "needs_attention",
    code: "instagram_publish_result_unknown",
  });
  expect(
    vi.mocked(context.request).mock.calls.some(([, o]) => o?.method === "POST"),
  ).toBe(false);
});
it("retains quota when looking up an already published media ID is rate-limited", async () => {
  const { lease, context } = fixture();
  context.checkpoint = { phase: "published", mediaId: "media" };
  vi.mocked(context.request).mockResolvedValue(
    new Response(null, { status: 429 }),
  );
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "retry_wait",
    definiteFailure: false,
  });
});
it("replaces a confirmed expired container only when no publish was attempted", async () => {
  const { lease, context } = fixture();
  context.checkpoint = { phase: "processing", containerId: "expired" };
  vi.mocked(context.request)
    .mockResolvedValueOnce(Response.json({ status_code: "EXPIRED" }))
    .mockResolvedValueOnce(Response.json({ id: "replacement" }))
    .mockResolvedValueOnce(Response.json({ status_code: "IN_PROGRESS" }));
  expect(await publishInstagram(lease, context)).toMatchObject({
    status: "retry_wait",
    code: "provider_processing",
  });
  expect(
    vi
      .mocked(context.request)
      .mock.calls.filter(([, o]) => o?.method === "POST"),
  ).toHaveLength(1);
  const ambiguous = fixture();
  ambiguous.context.checkpoint = {
    phase: "publishing",
    containerId: "expired",
  };
  vi.mocked(ambiguous.context.request).mockResolvedValue(
    Response.json({ status_code: "EXPIRED" }),
  );
  expect(
    await publishInstagram(ambiguous.lease, ambiguous.context),
  ).toMatchObject({ status: "needs_attention" });
  expect(
    vi
      .mocked(ambiguous.context.request)
      .mock.calls.some(([, o]) => o?.method === "POST"),
  ).toBe(false);
});
it.each([401, 403])(
  "can reconnect after initial container creation is rejected with %i",
  async (status) => {
    const { lease, context } = fixture();
    vi.mocked(context.save).mockImplementation(async (value) => {
      context.checkpoint = value;
    });
    vi.mocked(context.request).mockResolvedValueOnce(
      new Response(null, { status }),
    );
    expect(await publishInstagram(lease, context)).toMatchObject({
      status: "needs_attention",
      code: "credentials_expired",
    });
    expect(context.checkpoint).toEqual({ phase: "not_started", recreated: 0 });
    context.accessToken = "reconnected-token";
    vi.mocked(context.request)
      .mockReset()
      .mockResolvedValueOnce(Response.json({ id: "container" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media" }))
      .mockResolvedValueOnce(
        Response.json({
          id: "media",
          permalink: "https://www.instagram.com/reel/example/",
        }),
      );
    expect(await publishInstagram(lease, context)).toMatchObject({
      status: "published",
    });
    expect(context.request).toHaveBeenCalledTimes(4);
  },
);
it("does not recreate an initial container whose response was lost", async () => {
  const { lease, context } = fixture();
  vi.mocked(context.save).mockImplementation(async (value) => {
    context.checkpoint = value;
  });
  vi.mocked(context.request).mockRejectedValue(new Error("response lost"));
  expect(await publishInstagram(lease, context)).toMatchObject({
    code: "instagram_result_unknown",
  });
  expect(context.checkpoint?.phase).toBe("container_creating");
  vi.mocked(context.request).mockClear();
  expect(await publishInstagram(lease, context)).toMatchObject({
    code: "instagram_container_result_unknown",
  });
  expect(context.request).not.toHaveBeenCalled();
});
