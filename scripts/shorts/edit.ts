import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { HighlightSegment, VoicedChunk, Mood } from "./highlight";
import { WORK_DIR } from "./lib/paths";

const BGM_DIR = path.join(process.cwd(), "scripts/shorts/bgm");

/** mood → BGM 파일 경로. 해당 무드 음원 없으면 다른 무드라도 있으면 사용. 모두 없으면 null. */
function getBgmPath(mood: Mood): string | null {
  const candidate = path.join(BGM_DIR, `${mood}.mp3`);
  if (existsSync(candidate)) return candidate;
  for (const m of ["peaceful", "uplifting", "solemn", "reflective"] as const) {
    const p = path.join(BGM_DIR, `${m}.mp3`);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 자막 segment 의 절대 시간(absStart, absEnd)을 voiced chunks 기반 컷 후 상대 시간으로 변환.
 * segment 가 침묵 구간을 걸치면 voiced 영역 부분만 추출(시간이 줄어듦).
 * 침묵 안에 완전히 포함되면 null.
 */
function shiftSegment(
  absStart: number,
  absEnd: number,
  voiced: VoicedChunk[],
): { relStart: number; relEnd: number } | null {
  let accumulated = 0;
  let relStart: number | null = null;
  let relEnd: number | null = null;
  for (const v of voiced) {
    const overlapStart = Math.max(absStart, v.start);
    const overlapEnd = Math.min(absEnd, v.end);
    if (overlapEnd > overlapStart) {
      if (relStart === null) relStart = accumulated + (overlapStart - v.start);
      relEnd = accumulated + (overlapEnd - v.start);
    }
    accumulated += v.end - v.start;
  }
  if (relStart === null || relEnd === null || relEnd <= relStart) return null;
  return { relStart, relEnd };
}

/** voiced chunks 가 단일 chunk 이고 [startSec, endSec] 전체를 덮으면 컷 없음. */
function isFullClip(voiced: VoicedChunk[], startSec: number, endSec: number): boolean {
  return (
    voiced.length === 1 &&
    Math.abs(voiced[0].start - startSec) < 0.05 &&
    Math.abs(voiced[0].end - endSec) < 0.05
  );
}

/** voiced chunks 를 ffmpeg select/aselect 의 between() 표현식으로 변환. 기준 시간은 클립 상대(startSec=0). */
function buildSelectExpr(voiced: VoicedChunk[], startSec: number): string {
  return voiced
    .map((v) => {
      const a = Math.max(0, v.start - startSec).toFixed(3);
      const b = Math.max(0, v.end - startSec).toFixed(3);
      return `between(t,${a},${b})`;
    })
    .join("+");
}

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
  voiced: VoicedChunk[],
): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8")) as {
    events: Json3Event[];
  };
  const events = raw.events ?? [];

  // 컷 후 클립 길이 = voiced chunks 합계
  const finalDuration = voiced.reduce((sum, v) => sum + (v.end - v.start), 0);
  let assDialogue = "";

  // 1) 상단 고정 카드 — 컷 후 클립 전체 동안 노출
  if (cardText.trim().length > 0 && finalDuration > 0) {
    assDialogue += `Dialogue: 0,${fmtASSTime(0)},${fmtASSTime(finalDuration)},Card,,0,0,0,,{\\fad(300,0)}${escapeASSText(cardText.trim())}\n`;
  }

  // 2) 하단 본문 자막
  //    YouTube 자동자막 rolling caption 겹침 정리 후, voiced 기반으로 시간 시프트.
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
    const shifted = shiftSegment(evt.start, evt.end, voiced);
    if (!shifted) continue;
    const styled = highlightKeywords(evt.text, keywords);
    assDialogue += `Dialogue: 0,${fmtASSTime(shifted.relStart)},${fmtASSTime(shifted.relEnd)},Default,,0,0,0,,${styled}\n`;
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

/** editClips 성공 결과 — 출력 경로와 그 클립의 highlight 짝. 다운스트림 인덱스 정합 보존용. */
export interface EditedClip {
  outputPath: string;
  highlight: HighlightSegment;
}

export function editClips(
  videoPath: string,
  subtitlePath: string,
  highlights: HighlightSegment[],
): EditedClip[] {
  const result: EditedClip[] = [];

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];

    // 이중 방어선: 파트 1이 무력화돼도 ffmpeg -to < -ss 재발 차단.
    const dur = h.end_sec - h.start_sec;
    if (!(dur > 0)) {
      console.error(
        `[shorts] clip ${i} 비정상 시간 (skip): start=${h.start_sec} end=${h.end_sec} dur=${dur}`,
      );
      continue;
    }

    try {
      const assContent = generateASS(
        subtitlePath,
        h.start_sec,
        h.end_sec,
        h.keywords,
        h.card_text,
        h.voiced,
      );
      const assPath = path.join(WORK_DIR, `clip_${i}.ass`);
      const outputPath = path.join(WORK_DIR, `clip_${i}.mp4`);

      writeFileSync(assPath, assContent, "utf-8");

      const assRef = escapeFilterPath(assPath);
      const bgmPath = getBgmPath(h.mood);
      const logoPath = path.join(process.cwd(), "scripts/shorts/banner.png");
      const useCut = !isFullClip(h.voiced, h.start_sec, h.end_sec);
      const logoInputIdx = bgmPath ? 2 : 1;

      // 비디오 체인:
      //   (옵션) select: 침묵 컷 적용 → [vcut]
      //   color 1080x1920 검정 캔버스 [bg]
      //   영상 1:1 정사각 crop → [fg]
      //   overlay y=350 [merged] → ass 자막/카드 번인 → [captioned]
      //   로고 overlay (하단 가운데) → [vout]
      const videoFilters: string[] = [];
      if (useCut) {
        videoFilters.push(`[0:v]select='${buildSelectExpr(h.voiced, h.start_sec)}',setpts=N/FRAME_RATE/TB[vcut]`);
      }
      const fgSource = useCut ? "[vcut]" : "[0:v]";
      videoFilters.push("color=c=black:s=1080x1920:d=1[bg]");
      videoFilters.push(`${fgSource}crop=ih:ih,scale=1080:1080,eq=contrast=1.05:saturation=1.1[fg]`);
      videoFilters.push("[bg][fg]overlay=0:350[merged]");
      videoFilters.push(`[merged]ass='${assRef}'[captioned]`);
      videoFilters.push(`[${logoInputIdx}:v]scale=400:-1[logo]`);
      videoFilters.push(`[captioned][logo]overlay=(W-w)/2:H-h-30:shortest=1[vout]`);

      // 오디오 체인:
      //   (옵션) aselect: 침묵 컷 적용 → [acut]
      //   (옵션) BGM amix → [aout], 없으면 sermon audio 그대로
      const audioFilters: string[] = [];
      if (useCut) {
        audioFilters.push(`[0:a]aselect='${buildSelectExpr(h.voiced, h.start_sec)}',asetpts=N/SR/TB[acut]`);
      }
      const sermonAudio = useCut ? "[acut]" : "[0:a]";
      if (bgmPath) {
        audioFilters.push("[1:a]volume=0.08,afade=t=in:d=0.5[bgm]");
        audioFilters.push(`${sermonAudio}[bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
      } else if (useCut) {
        // BGM 없고 cut 적용 — sermon audio (cut) 만 [aout] 로 통일
        audioFilters.push(`${sermonAudio}anull[aout]`);
      }

      const filterComplex = [...videoFilters, ...audioFilters].join(";");

      // BGM 없고 cut 도 없으면 [0:a] 그대로 map
      const audioMap = bgmPath || useCut ? '-map "[aout]"' : "-map 0:a";

      const sermonInput = `-ss ${h.start_sec} -to ${h.end_sec} -i "${videoPath}"`;
      const bgmInput = bgmPath ? `-i "${bgmPath}"` : "";
      const logoInput = `-loop 1 -i "${logoPath}"`;
      const inputs = [sermonInput, bgmInput, logoInput].filter(Boolean).join(" ");

      execSync(
        [
          "ffmpeg -y",
          inputs,
          `-filter_complex "${filterComplex}"`,
          `-map "[vout]" ${audioMap}`,
          "-c:v libx264 -preset medium -crf 23",
          "-c:a aac -b:a 128k",
          "-movflags +faststart",
          `"${outputPath}"`,
        ].join(" "),
        { stdio: "inherit", timeout: 180_000 },
      );

      console.log(
        `[shorts] clip ${i}: mood=${h.mood}, cut=${useCut ? `${h.voiced.length}chunks` : "none"}, bgm=${bgmPath ? path.basename(bgmPath) : "none"}`,
      );

      result.push({ outputPath, highlight: h });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[shorts] clip ${i} 렌더 실패 (skip): ${msg}`);
      continue;
    }
  }

  if (result.length === 0) {
    throw new Error("모든 클립 렌더 실패");
  }

  return result;
}
