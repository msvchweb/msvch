import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { HighlightSegment } from "./highlight";

const WORK_DIR = "/tmp/shorts";

interface Json3Seg {
  utf8: string;
}

interface Json3Event {
  tStartMs: number;
  dDurationMs: number;
  segs?: Json3Seg[];
}

function fmtASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function generateASS(
  subtitlePath: string,
  startSec: number,
  endSec: number,
): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8")) as {
    events: Json3Event[];
  };
  const events = raw.events ?? [];

  let assDialogue = "";
  for (const e of events) {
    const evtStart = e.tStartMs / 1000;
    const evtEnd = (e.tStartMs + e.dDurationMs) / 1000;

    if (evtEnd < startSec || evtStart > endSec) continue;
    if (!e.segs) continue;

    const text = e.segs.map((s) => s.utf8).join("").trim();
    if (!text) continue;

    const relStart = Math.max(0, evtStart - startSec);
    const relEnd = Math.min(endSec - startSec, evtEnd - startSec);

    assDialogue += `Dialogue: 0,${fmtASSTime(relStart)},${fmtASSTime(relEnd)},Default,,0,0,0,,${text}\n`;
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK KR,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,20,20,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assDialogue}`;
}

export function editClips(
  videoPath: string,
  subtitlePath: string,
  highlights: HighlightSegment[],
): string[] {
  const outputPaths: string[] = [];

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const assContent = generateASS(subtitlePath, h.start_sec, h.end_sec);
    const assPath = path.join(WORK_DIR, `clip_${i}.ass`);
    const outputPath = path.join(WORK_DIR, `clip_${i}.mp4`);

    writeFileSync(assPath, assContent, "utf-8");

    execSync(
      [
        "ffmpeg -y",
        `-ss ${h.start_sec}`,
        `-to ${h.end_sec}`,
        `-i "${videoPath}"`,
        `-vf "crop=ih*9/16:ih,scale=1080:1920,ass=${assPath}"`,
        "-c:v libx264 -preset medium -crf 23",
        "-c:a aac -b:a 128k",
        "-movflags +faststart",
        `"${outputPath}"`,
      ].join(" "),
      { stdio: "inherit", timeout: 120_000 },
    );

    outputPaths.push(outputPath);
  }

  return outputPaths;
}
