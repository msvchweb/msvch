// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createGeneration, assertLegacyRunnerIdle } from "./generation";
import { hasShortsAccess } from "./permissions";
const input = { videoId: "abcdefghijk", videoTitle: "설교", count: 5 as const };
function deps(token = "token") {
  return {
    token,
    fetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    db: {
      rpc: vi.fn().mockImplementation(async (name: string) => ({
        data:
          name === "shorts_create_generation"
            ? { jobId: "job", attemptId: "attempt", status: "pending" }
            : true,
        error: null,
      })),
    },
  };
}
it("rejects malformed input before creating or dispatching anything", async () => {
  const d = deps();
  await expect(
    createGeneration({ ...input, videoId: "abc; rm" }, d),
  ).rejects.toThrow();
  expect(d.db.rpc).not.toHaveBeenCalled();
  expect(d.fetch).not.toHaveBeenCalled();
  expect(hasShortsAccess("staff")).toBe(false);
  expect(hasShortsAccess("admin")).toBe(true);
});
it("records missing configuration and definite dispatch failures on that attempt", async () => {
  for (const d of [deps(""), deps()]) {
    d.fetch.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(createGeneration(input, d)).rejects.toThrow();
    expect(d.db.rpc.mock.calls.at(-1)).toEqual([
      "shorts_fail_attempt",
      expect.objectContaining({ p_attempt: "attempt" }),
    ]);
  }
});
it("does not retry or fail an ambiguous dispatch that may have been accepted", async () => {
  const d = deps();
  d.fetch.mockRejectedValue(new Error("response lost"));
  expect(await createGeneration(input, d)).toMatchObject({
    attemptId: "attempt",
    status: "pending",
  });
  expect(d.db.rpc).toHaveBeenCalledTimes(1);
  expect(d.fetch).toHaveBeenCalledTimes(1);
});
it("refuses a legacy restart until existing GitHub runs can be confirmed idle", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ workflow_runs: [{ status: "in_progress" }] }),
    );
  await expect(assertLegacyRunnerIdle("token", fetcher)).rejects.toThrow();
  fetcher.mockImplementation(async () => Response.json({ workflow_runs: [] }));
  await expect(
    assertLegacyRunnerIdle("token", fetcher),
  ).resolves.toBeUndefined();
  fetcher.mockResolvedValue(new Response(null, { status: 403 }));
  await expect(assertLegacyRunnerIdle("token", fetcher)).rejects.toThrow();
});
