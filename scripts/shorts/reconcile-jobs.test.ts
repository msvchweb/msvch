// @vitest-environment node
import { expect, it } from "vitest";
import { terminalFailure } from "./reconcile-jobs";
it("never infers a running worker's failure from age or an offline runner", () => {
  expect(terminalFailure({ status: "in_progress", conclusion: null })).toBe(
    false,
  );
  expect(terminalFailure({ status: "queued", conclusion: null })).toBe(false);
  expect(
    terminalFailure({ status: "completed", conclusion: "cancelled" }),
  ).toBe(true);
  expect(terminalFailure({ status: "completed", conclusion: "success" })).toBe(
    false,
  );
});
