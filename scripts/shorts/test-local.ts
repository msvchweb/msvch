/** Runs the production renderer on prepared local fixtures, without upload or publication. */
import path from "node:path";
import { readFileSync, mkdirSync } from "node:fs";
import { editClips } from "./edit";
import type { HighlightSegment } from "./highlight";
import { arg } from "./run";
async function main() {
  const video = arg("video"),
    subtitles = arg("subtitles"),
    manifest = arg("manifest"),
    out = arg("out");
  if (!video || !subtitles || !manifest || !out)
    throw new Error(
      "Usage: --video=PATH --subtitles=PATH --manifest=PATH --out=PATH",
    );
  const highlights = (
    JSON.parse(readFileSync(manifest, "utf8")) as {
      accepted: HighlightSegment[];
    }
  ).accepted;
  const workDir = path.resolve(out);
  mkdirSync(workDir, { recursive: true });
  const edited = await editClips(
    path.resolve(video),
    path.resolve(subtitles),
    highlights,
    { workDir, bgmEnabled: false },
  );
  console.log(edited.map((e) => ({ file: e.outputPath, check: e.mediaCheck })));
}
main().catch(() => {
  console.error("Local render failed. Check toolchain and input fixtures.");
  process.exitCode = 1;
});
