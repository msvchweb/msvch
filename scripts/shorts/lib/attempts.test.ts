// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  claimGenerationAttempt,
  finishGenerationAttempt,
  updateAttempt,
} from "./attempts";

describe("generation ownership", () => {
  it("refuses a stale runner rather than allowing it to proceed", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    expect(await claimGenerationAttempt("attempt", "123", 1, db)).toBe(false);
    expect(db.rpc).toHaveBeenCalledWith("shorts_claim_attempt", {
      p_attempt: "attempt",
      p_run: "123",
      p_run_attempt: 1,
    });
  });
  it("fences completion with the run attempt, preserving newer ownership", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    expect(
      await finishGenerationAttempt("attempt", "123", 1, { success: true }, db),
    ).toBe(false);
    expect(db.rpc.mock.calls[0][1]).toMatchObject({
      p_run_attempt: 1,
      p_success: true,
    });
  });
  it("stops processing on heartbeat ownership loss or a database failure", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    await expect(updateAttempt("a", "1", 2, "editing", db)).rejects.toThrow(
      "attempt_ownership_lost",
    );
    db.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(claimGenerationAttempt("a", "1", 1, db)).rejects.toThrow(
      "offline",
    );
  });
});
