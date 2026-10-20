// @vitest-environment node
import { expect, it } from "vitest";
import { clipStorageKey } from "./upload";
it("gives a new attempt a new immutable URL and keeps same attempt keys stable", () => {
  expect(clipStorageKey("job", "attemptA", 0)).toBe(
    "shorts/job/attemptA/clip_0.mp4",
  );
  expect(clipStorageKey("job", "attemptB", 0)).toBe(
    "shorts/job/attemptB/clip_0.mp4",
  );
});
