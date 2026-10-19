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
