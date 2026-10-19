// @vitest-environment node
import { expect, it } from "vitest";
import { getAttemptDir } from "./lib/paths";
import { inspectMedia } from "./verify-clip";
const video = {
  codec_type: "video",
  codec_name: "h264",
  width: 1080,
  height: 1920,
  duration: "30",
};
const audio = {
  codec_type: "audio",
  codec_name: "aac",
  duration: "30",
  sample_rate: "48000",
};
it("isolates attempt files and rejects path traversal", () => {
  const job = "10000000-0000-4000-8000-000000000001";
  expect(getAttemptDir(job, job)).not.toBe(
    getAttemptDir(job, "20000000-0000-4000-8000-000000000001"),
  );
  expect(() => getAttemptDir(job, "../../another")).toThrow();
});
it("rejects missing audio and unusable media, warns for duration drift", () => {
  expect(
    inspectMedia({ streams: [video, audio], format: { duration: "30" } }, 30),
  ).toMatchObject({ valid: true, warnings: [] });
  expect(
    inspectMedia({ streams: [video], format: { duration: "30" } }, 30).valid,
  ).toBe(false);
  expect(
    inspectMedia({ streams: [video, audio], format: { duration: "0" } }, 30)
      .valid,
  ).toBe(false);
  expect(
    inspectMedia(
      {
        streams: [video, { ...audio, duration: "29" }],
        format: { duration: "30" },
      },
      28,
    ).warnings,
  ).toEqual(["duration_mismatch", "av_duration_mismatch"]);
  expect(
    inspectMedia(
      {
        streams: [video, { ...audio, sample_rate: "16000" }],
        format: { duration: "30" },
      },
      30,
    ).valid,
  ).toBe(false);
});
