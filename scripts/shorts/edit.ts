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

function escapeASSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

/** segment 텍스트 내 keywords 매칭 부분을 ASS inline override 로 감싼다. */
function highlightKeywords(text: string, keywords: string[]): string {
  if (keywords.length === 0) return escapeASSText(text);

  // 긴 단어부터 매칭(부분 일치 우선순위 충돌 방지)
  const sorted = [...keywords].sort((a, b) => b.length - a.length);

  // 텍스트를 keyword 단위로 분해
  const tokens: { text: string; emphasize: boolean }[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let hitIdx = -1;
    let hitKw = "";
    for (const kw of sorted) {
      if (kw.length === 0) continue;
      const idx = remaining.indexOf(kw);
      if (idx !== -1 && (hitIdx === -1 || idx < hitIdx)) {
        hitIdx = idx;
        hitKw = kw;
      }
    }
    if (hitIdx === -1) {
      tokens.push({ text: remaining, emphasize: false });
      break;
    }
    if (hitIdx > 0) {
      tokens.push({ text: remaining.slice(0, hitIdx), emphasize: false });
    }
    tokens.push({ text: hitKw, emphasize: true });
    remaining = remaining.slice(hitIdx + hitKw.length);
  }

  return tokens
    .map((t) =>
      t.emphasize
        ? `{\\c&H00FFFF&\\b1}${escapeASSText(t.text)}{\\c&HFFFFFF&\\b0}`
        : escapeASSText(t.text),
    )
    .join("");
}

function generateASS(
  subtitlePath: string,
  startSec: number,
  endSec: number,
  keywords: string[],
  cardText: string,
): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8")) as {
    events: Json3Event[];
  };
  const events = raw.events ?? [];

  const clipDuration = endSec - startSec;
  let assDialogue = "";

  // 1) 상단 고정 카드 — 클립 전체 동안 상단 여백 영역(Alignment=8)에 노출
  if (cardText.trim().length > 0 && clipDuration > 0) {
    assDialogue += `Dialogue: 0,${fmtASSTime(0)},${fmtASSTime(clipDuration)},Card,,0,0,0,,{\\fad(300,0)}${escapeASSText(cardText.trim())}\n`;
  }

  // 2) 하단 본문 자막
  //    YouTube 자동자막은 rolling caption 이라 인접 event 시간이 겹쳐서 ASS 가 두 줄로 분리함.
  //    이전 evt 의 end 를 다음 evt 의 start 로 clamp 해서 겹침을 없애 항상 한 줄로 표시.
  const subtitles: { start: number; end: number; text: string }[] = [];
  for (const e of events) {
    const evtStart = e.tStartMs / 1000;
    const evtEnd = (e.tStartMs + e.dDurationMs) / 1000;
    if (evtEnd < startSec || evtStart > endSec) continue;
    if (!e.segs) continue;
    const text = e.segs.map((s) => s.utf8).join("").trim();
    if (!text) continue;
    subtitles.push({ start: evtStart, end: evtEnd, text });
  }
  subtitles.sort((a, b) => a.start - b.start);
  for (let i = 0; i < subtitles.length - 1; i++) {
    if (subtitles[i].end > subtitles[i + 1].start) {
      subtitles[i].end = subtitles[i + 1].start;
    }
  }
  for (const evt of subtitles) {
    const relStart = Math.max(0, evt.start - startSec);
    const relEnd = Math.min(endSec - startSec, evt.end - startSec);
    if (relEnd <= relStart) continue;
    const styled = highlightKeywords(evt.text, keywords);
    assDialogue += `Dialogue: 0,${fmtASSTime(relStart)},${fmtASSTime(relEnd)},Default,,0,0,0,,${styled}\n`;
  }

  // 레이아웃:
  //   y=0~350  상단 여백 (카드 영역, Alignment=8, MarginV=120)
  //   y=350~1430  영상 1080x1080 (overlay y=350, 1:1 정사각 crop)
  //   y=1430~1920  하단 여백 (본문 자막, Alignment=2, MarginV=240 → y≈1680)
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK KR,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,40,40,240,1
Style: Card,Noto Sans CJK KR,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,8,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assDialogue}`;
}

/** ffmpeg filter graph 안에 들어갈 ass= 경로를 escape (Windows ':' / ',' 등). */
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function editClips(
  videoPath: string,
  subtitlePath: string,
  highlights: HighlightSegment[],
): string[] {
  const outputPaths: string[] = [];

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const assContent = generateASS(
      subtitlePath,
      h.start_sec,
      h.end_sec,
      h.keywords,
      h.card_text,
    );
    const assPath = path.join(WORK_DIR, `clip_${i}.ass`);
    const outputPath = path.join(WORK_DIR, `clip_${i}.mp4`);

    writeFileSync(assPath, assContent, "utf-8");

    const assRef = escapeFilterPath(assPath);

    // 필터 그래프:
    //   검정 1080x1920 캔버스 [bg]
    //   영상은 1:1 정사각 crop (화자 크게) + 1080x1080 + 컬러 그레이딩 [fg]
    //   overlay y=350 — 영상이 상단 여백 350 아래에 붙고 하단 490이 자막 영역
    //   ass 로 자막(하단)+카드(상단) 번인
    const filterComplex = [
      "color=c=black:s=1080x1920:d=1[bg]",
      "[0:v]crop=ih:ih,scale=1080:1080,eq=contrast=1.05:saturation=1.1[fg]",
      "[bg][fg]overlay=0:350[merged]",
      `[merged]ass='${assRef}'[out]`,
    ].join(";");

    execSync(
      [
        "ffmpeg -y",
        `-ss ${h.start_sec}`,
        `-to ${h.end_sec}`,
        `-i "${videoPath}"`,
        `-filter_complex "${filterComplex}"`,
        `-map "[out]" -map 0:a`,
        "-c:v libx264 -preset medium -crf 23",
        "-c:a aac -b:a 128k",
        "-movflags +faststart",
        `"${outputPath}"`,
      ].join(" "),
      { stdio: "inherit", timeout: 180_000 },
    );

    outputPaths.push(outputPath);
  }

  return outputPaths;
}
