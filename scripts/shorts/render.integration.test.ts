// @vitest-environment node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { runTool } from "./lib/process";
import { editClips } from "./edit";
import type { HighlightSegment } from "./highlight";
// Explicit opt-in: FFmpeg and fonts are machine dependencies, unlike the ordinary unit suite.
it.runIf(process.env.SHORTS_MEDIA_TEST === "1")(
  "renders both production paths with normalized duration and audio",
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "shorts-media-test-"));
    try {
      const video = path.join(dir, "source.mp4"),
        subtitles = path.join(dir, "source.json3");
      await runTool(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "testsrc2=size=720x720:rate=30:duration=4",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=4",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-c:a",
          "aac",
          "-shortest",
          video,
        ],
        { timeoutMs: 30000 },
      );
      await writeFile(
        subtitles,
        JSON.stringify({
          events: [
            { tStartMs: 0, dDurationMs: 4000, segs: [{ utf8: "테스트 자막" }] },
          ],
        }),
      );
      for (const voiced of [
        [{ start: 0, end: 4 }],
        [
          { start: 0, end: 1 },
          { start: 2, end: 4 },
        ],
      ]) {
        const selection = {
          start_id: "s1",
          end_id: "s2",
          quote_start: "테스트",
          quote_end: "자막",
          title: "테스트",
          hook: "테스트",
          reason: "테스트",
          topic: "테스트",
          keywords: [],
          card_text: "테스트",
          mood: "peaceful" as const,
          scores: {
            hook: 3,
            standalone: 3,
            empathy: 3,
            completeness: 3,
            context: 3,
          },
          total_score: 15,
        };
        const h: HighlightSegment = {
          id: "test",
          start_sec: 0,
          end_sec: 4,
          title: "테스트",
          hook: "테스트",
          reason: "테스트",
          keywords: [],
          card_text: "테스트",
          mood: "peaceful",
          transcript: "테스트",
          selection_data: selection,
          voiced,
        };
        const clips = await editClips(video, subtitles, [h], {
          workDir: dir,
          bgmEnabled: false,
        });
        expect(clips[0].mediaCheck).toMatchObject({
          valid: true,
          warnings: [],
        });
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  120000,
);
