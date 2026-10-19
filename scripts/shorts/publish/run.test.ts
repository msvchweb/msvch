// @vitest-environment node
import { expect, it, vi } from "vitest";
import { runPublishTick, type TickDependencies } from "./run";
import type { PublicationLease } from "../../../src/types/shorts";
const now = new Date("2026-10-19T01:00:00Z");
function deps() {
  return {
    enabled: vi.fn().mockResolvedValue(true),
    claim: vi.fn().mockResolvedValue(null),
    recover: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({
      status: "published",
      providerId: "id",
      providerUrl: "https://youtube.com/id",
    }),
    finish: vi.fn(),
    clock: () => now,
  } satisfies TickDependencies;
}
it("does not claim or contact providers when publishing is off or dry-run", async () => {
  for (const mode of ["live", "dry-run"] as const) {
    const d = deps();
    d.enabled.mockResolvedValue(mode === "dry-run");
    await runPublishTick({ now, workerRunId: "1:1", mode }, d);
    expect(d.claim).not.toHaveBeenCalled();
    expect(d.execute).not.toHaveBeenCalled();
    expect(d.finish).not.toHaveBeenCalled();
  }
});
it("rejects private test / live row mismatches before provider calls", async () => {
  for (const [mode, platform, testOnly] of [
    ["private-test", "instagram", true],
    ["private-test", "youtube", false],
    ["live", "youtube", true],
  ] as const) {
    const d = deps();
    d.claim.mockResolvedValueOnce({
      publication: { id: "p", platform, test_only: testOnly },
      leaseToken: "t",
    } as PublicationLease);
    await runPublishTick({ now, workerRunId: "1:1", mode }, d);
    expect(d.execute).not.toHaveBeenCalled();
  }
});
it("stops acquiring new work before the workflow deadline", async () => {
  const d = deps();
  d.clock = () => new Date(now.getTime() + 18 * 60000);
  await runPublishTick({ now, workerRunId: "1:1", mode: "live" }, d);
  expect(d.claim).not.toHaveBeenCalled();
});
