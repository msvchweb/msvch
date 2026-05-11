/**
 * 로컬 테스트용 — 이미 다운로드된 영상+자막으로 쇼츠 1개만 생성하여 퀄리티 확인.
 * Supabase 업로드 없이 로컬 파일만 생성.
 *
 * Usage: npx tsx scripts/shorts/test-local.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import os from "os";

const WORK_DIR = path.join(os.tmpdir(), "shorts");
const VIDEO_ID = "AZn08S-GlCQ";
const BGM_DIR = path.join(process.cwd(), "scripts/shorts/bgm");

type Mood = "solemn" | "uplifting" | "peaceful" | "reflective";
const MOODS: Mood[] = ["solemn", "uplifting", "peaceful", "reflective"];

interface VoicedChunk { start: number; end: number }

// --- json3 파싱 ---
interface Json3Seg { utf8: string }
interface Json3Event { tStartMs: number; dDurationMs: number; segs?: Json3Seg[] }
interface SubSegment { startMs: number; endMs: number; text: string }

function parseJson3(filePath: string): SubSegment[] {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as { events: Json3Event[] };
  return raw.events
    .filter((e) => e.segs && e.segs.some((s) => s.utf8.trim()))
    .map((e) => ({
      startMs: e.tStartMs,
      endMs: e.tStartMs + e.dDurationMs,
      text: (e.segs ?? []).map((s) => s.utf8).join(""),
    }));
}

// --- 음성 chunks 산출 ---
function computeVoicedChunks(segments: SubSegment[], startSec: number, endSec: number): VoicedChunk[] {
  const compute = (threshold: number): VoicedChunk[] => {
    const inClip = segments
      .filter((s) => s.endMs / 1000 > startSec && s.startMs / 1000 < endSec)
      .map((s) => ({
        start: Math.max(startSec, s.startMs / 1000),
        end: Math.min(endSec, s.endMs / 1000),
      }))
      .sort((a, b) => a.start - b.start);
    for (let i = 0; i < inClip.length - 1; i++) {
      if (inClip[i].end > inClip[i + 1].start) inClip[i].end = inClip[i + 1].start;
    }
    const chunks: VoicedChunk[] = [];
    for (const seg of inClip) {
      const last = chunks[chunks.length - 1];
      if (!last || seg.start - last.end > threshold) {
        chunks.push({ start: seg.start, end: seg.end });
      } else {
        last.end = seg.end;
      }
    }
    return chunks;
  };

  let voiced = compute(1.0);
  if (voiced.length >= 6) voiced = compute(1.5);

  const clipDuration = endSec - startSec;
  const voicedDuration = voiced.reduce((sum, v) => sum + (v.end - v.start), 0);
  if (clipDuration <= 0 || voicedDuration / clipDuration < 0.7 || voicedDuration < 20) {
    return [{ start: startSec, end: endSec }];
  }
  return voiced;
}

// --- Gemini 호출 ---
interface HighlightSegment {
  start_sec: number;
  end_sec: number;
  title: string;
  hook: string;
  reason: string;
  keywords: string[];
  card_text: string;
  peak_sec?: number;
  mood: Mood;
  voiced: VoicedChunk[];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function selectHighlights(subtitlePath: string): Promise<HighlightSegment[]> {
  const segments = parseJson3(subtitlePath);
  console.log(`자막 세그먼트 ${segments.length}개 파싱 완료`);

  const transcript = segments
    .map((s) => {
      const sec = Math.floor(s.startMs / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${s.text.trim()}`;
    })
    .filter((line) => line.length > 8)
    .join("\n");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 필요");

  console.log("Gemini 하이라이트 선정 요청 중...");

  const prompt = `당신은 교회 설교 편집자입니다.
아래는 한국어 설교 트랜스크립트입니다. 각 줄 앞에 [MM:SS] 형식의 타임스탬프가 있습니다.

다음 조건을 만족하는 30~55초 길이의 구간 3개를 골라주세요:
- 한 가지 완결된 메시지를 담고 있을 것
- 문장이 자연스럽게 시작하고 끝날 것
- 감정적 호소, 핵심 적용, 인상 깊은 비유, 도전적 권면 중 하나에 해당
- 비신자에게도 이해 가능할 것
- 3개는 서로 주제가 겹치지 않을 것

중요: start_sec와 end_sec는 반드시 "초" 단위 숫자입니다. 예를 들어 트랜스크립트에서 [05:30]은 330초, [12:45]는 765초입니다.
end_sec - start_sec는 반드시 30~55 사이여야 합니다.

각 클립에 대해 추가로 함께 산출하세요:
- keywords: 본문에서 시각적으로 강조할 핵심 단어 3~5개. 명사·동사 위주, 조사/접속사 제외. 본문에 실제로 등장하는 표기 그대로.
- card_text: 화면 상단에 큰 글씨로 띄울 15자 이내 한 줄. 호기심을 유발하는 문장 또는 핵심 단어.
- peak_sec: 구간 내 가장 임팩트 있는 한 시점(초).
- mood: 이 클립의 정서. 다음 중 정확히 하나로만 답하세요.
  · solemn — 엄숙·회개·죄·십자가·심판
  · uplifting — 희망·은혜·약속·찬양
  · peaceful — 평온·위로·안식·사랑
  · reflective — 사색·결단·적용·말씀 묵상

반드시 아래 JSON 형식으로만 응답하세요.

{"highlights":[{"start_sec":330,"end_sec":375,"title":"20자 이내","hook":"첫 3초 훅 한 줄","reason":"선정 이유 1문장","keywords":["단어1","단어2","단어3"],"card_text":"15자 이내","peak_sec":345,"mood":"peaceful"}]}

트랜스크립트:
${transcript}`;

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  let res: Response | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`  Gemini 호출: ${model} (시도 ${attempt + 1}/3)`);
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );
      if (res.ok) break;
      console.log(`  ${res.status} — ${attempt < 2 ? "재시도..." : "다음 모델..."}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    if (res?.ok) break;
  }

  if (!res?.ok) throw new Error(`Gemini 모든 모델 실패`);

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답 비어있음");

  const parsed = JSON.parse(text) as { highlights: HighlightSegment[] };
  console.log(`하이라이트 ${parsed.highlights.length}개 선정:`);
  for (const h of parsed.highlights) {
    console.log(`  ${h.title} (${h.start_sec}s ~ ${h.end_sec}s) — ${h.hook}`);
  }

  // segment 경계 스냅 + 기본값 + voiced
  const snapped = parsed.highlights.map((h) => {
    const startSeg = segments.reduce((best, s) =>
      Math.abs(s.startMs / 1000 - h.start_sec) < Math.abs(best.startMs / 1000 - h.start_sec) ? s : best
    );
    const endSeg = segments.reduce((best, s) =>
      Math.abs(s.endMs / 1000 - h.end_sec) < Math.abs(best.endMs / 1000 - h.end_sec) ? s : best
    );
    const startSec = startSeg.startMs / 1000;
    const endSec = endSeg.endMs / 1000;
    const mood: Mood = MOODS.includes(h.mood) ? h.mood : "peaceful";
    return {
      ...h,
      start_sec: startSec,
      end_sec: endSec,
      keywords: Array.isArray(h.keywords) ? h.keywords.filter((k) => k.trim().length > 0) : [],
      card_text: typeof h.card_text === "string" && h.card_text.trim().length > 0 ? h.card_text.trim() : h.title,
      mood,
      voiced: computeVoicedChunks(segments, startSec, endSec),
    };
  });

  // 최소 15초 이상인 것만 유지
  const valid = snapped.filter((h) => h.end_sec - h.start_sec >= 15);
  if (valid.length === 0) {
    throw new Error("유효한 하이라이트가 없습니다 (모두 15초 미만). Gemini 응답을 확인하세요.");
  }
  console.log(`유효한 클립: ${valid.length}개 (스냅 후)`);
  return valid;
}

// --- FFmpeg 편집 ---
function fmtASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function escapeASSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function highlightKeywords(text: string, keywords: string[]): string {
  if (keywords.length === 0) return escapeASSText(text);
  const sorted = [...keywords].sort((a, b) => b.length - a.length);

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
    if (hitIdx > 0) tokens.push({ text: remaining.slice(0, hitIdx), emphasize: false });
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

function shiftSegment(absStart: number, absEnd: number, voiced: VoicedChunk[]): { relStart: number; relEnd: number } | null {
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

function isFullClip(voiced: VoicedChunk[], startSec: number, endSec: number): boolean {
  return (
    voiced.length === 1 &&
    Math.abs(voiced[0].start - startSec) < 0.05 &&
    Math.abs(voiced[0].end - endSec) < 0.05
  );
}

function buildSelectExpr(voiced: VoicedChunk[], startSec: number): string {
  return voiced
    .map((v) => {
      const a = Math.max(0, v.start - startSec).toFixed(3);
      const b = Math.max(0, v.end - startSec).toFixed(3);
      return `between(t,${a},${b})`;
    })
    .join("+");
}

function getBgmPath(mood: Mood): string | null {
  const candidate = path.join(BGM_DIR, `${mood}.mp3`);
  if (existsSync(candidate)) return candidate;
  for (const m of ["peaceful", "uplifting", "solemn", "reflective"] as const) {
    const p = path.join(BGM_DIR, `${m}.mp3`);
    if (existsSync(p)) return p;
  }
  return null;
}

function generateASS(
  subtitlePath: string,
  startSec: number,
  endSec: number,
  keywords: string[],
  cardText: string,
  voiced: VoicedChunk[],
): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8")) as { events: Json3Event[] };
  const finalDuration = voiced.reduce((sum, v) => sum + (v.end - v.start), 0);
  let assDialogue = "";

  // 1) 상단 고정 카드 — 컷 후 클립 전체 동안 노출
  if (cardText.trim().length > 0 && finalDuration > 0) {
    assDialogue += `Dialogue: 0,${fmtASSTime(0)},${fmtASSTime(finalDuration)},Card,,0,0,0,,{\\fad(300,0)}${escapeASSText(cardText.trim())}\n`;
  }

  // 2) 본문 자막 — rolling caption 겹침 제거 후 voiced 기반 시간 시프트
  const subtitles: { start: number; end: number; text: string }[] = [];
  for (const e of raw.events) {
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

  // 레이아웃: y=0~350 카드(Alignment=8, MarginV=120), y=350~1430 영상(1:1), y=1430~1920 자막(Alignment=2, MarginV=240)
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Malgun Gothic,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,40,40,240,1
Style: Card,Malgun Gothic,80,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,8,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assDialogue}`;
}

// --- 메인 ---
async function main() {
  const videoPath = path.join(WORK_DIR, `${VIDEO_ID}.mp4`);
  const files = readdirSync(WORK_DIR);
  const subFile = files.find((f) => f.startsWith(VIDEO_ID) && f.endsWith(".json3"));

  if (!existsSync(videoPath) || !subFile) {
    console.error("영상 또는 자막 파일이 없습니다.");
    process.exit(1);
  }

  const subtitlePath = path.join(WORK_DIR, subFile);
  console.log(`영상: ${videoPath}`);
  console.log(`자막: ${subtitlePath}`);

  const highlights = await selectHighlights(subtitlePath);

  const { mkdirSync } = await import("fs");
  const outputDir = path.join(WORK_DIR, "output");
  mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const cutInfo = isFullClip(h.voiced, h.start_sec, h.end_sec) ? "컷 없음" : `${h.voiced.length}개 chunk`;
    const bgmPath = getBgmPath(h.mood);
    console.log(`\n[${i + 1}/${highlights.length}] "${h.title}" (${h.start_sec}s ~ ${h.end_sec}s)`);
    console.log(`  mood=${h.mood}, cut=${cutInfo}, bgm=${bgmPath ? path.basename(bgmPath) : "없음"}`);
    if (h.keywords.length > 0) console.log(`  강조 단어: ${h.keywords.join(", ")}`);
    console.log(`  카드: "${h.card_text}"`);

    const assContent = generateASS(subtitlePath, h.start_sec, h.end_sec, h.keywords, h.card_text, h.voiced);
    const assPath = path.join(outputDir, `clip_${i}.ass`);
    const outputPath = path.join(outputDir, `clip_${i}.mp4`);

    writeFileSync(assPath, assContent, "utf-8");

    const assPathEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const useCut = !isFullClip(h.voiced, h.start_sec, h.end_sec);

    // 비디오/오디오 필터 체인 구성
    const videoFilters: string[] = [];
    if (useCut) {
      videoFilters.push(`[0:v]select='${buildSelectExpr(h.voiced, h.start_sec)}',setpts=N/FRAME_RATE/TB[vcut]`);
    }
    const fgSource = useCut ? "[vcut]" : "[0:v]";
    videoFilters.push("color=c=black:s=1080x1920:d=1[bg]");
    videoFilters.push(`${fgSource}crop=ih:ih,scale=1080:1080,eq=contrast=1.05:saturation=1.1[fg]`);
    videoFilters.push("[bg][fg]overlay=0:350[merged]");
    videoFilters.push(`[merged]ass='${assPathEscaped}'[vout]`);

    const audioFilters: string[] = [];
    if (useCut) {
      audioFilters.push(`[0:a]aselect='${buildSelectExpr(h.voiced, h.start_sec)}',asetpts=N/SR/TB[acut]`);
    }
    const sermonAudio = useCut ? "[acut]" : "[0:a]";
    if (bgmPath) {
      audioFilters.push("[1:a]volume=0.08,afade=t=in:d=0.5[bgm]");
      audioFilters.push(`${sermonAudio}[bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    } else if (useCut) {
      audioFilters.push(`${sermonAudio}anull[aout]`);
    }

    const filterComplex = [...videoFilters, ...audioFilters].join(";");
    const audioMap = bgmPath || useCut ? '-map "[aout]"' : "-map 0:a";
    const inputs = bgmPath
      ? `-ss ${h.start_sec} -to ${h.end_sec} -i "${videoPath}" -i "${bgmPath}"`
      : `-ss ${h.start_sec} -to ${h.end_sec} -i "${videoPath}"`;

    try {
      execSync(
        [
          "ffmpeg -y",
          inputs,
          `-filter_complex "${filterComplex}"`,
          `-map "[vout]" ${audioMap}`,
          "-c:v libx264 -preset fast -crf 23",
          "-c:a aac -b:a 128k",
          "-movflags +faststart",
          `"${outputPath}"`,
        ].join(" "),
        { stdio: "inherit", timeout: 180_000 },
      );
      console.log(`  -> ${outputPath}`);
    } catch (err) {
      console.error(`  풀세트 실패, 자막 없는 단순 그래프로 재시도...`);
      execSync(
        [
          "ffmpeg -y",
          `-ss ${h.start_sec}`,
          `-to ${h.end_sec}`,
          `-i "${videoPath}"`,
          `-vf "crop=ih*9/16:ih,scale=1080:1920"`,
          "-c:v libx264 -preset fast -crf 23",
          "-c:a aac -b:a 128k",
          "-movflags +faststart",
          `"${outputPath}"`,
        ].join(" "),
        { stdio: "inherit", timeout: 120_000 },
      );
      console.log(`  -> ${outputPath} (폴백: 단순 컷)`);
    }
  }

  console.log(`\n완료! 결과물: ${outputDir}`);
  console.log("탐색기에서 열기:");
  console.log(`  explorer "${outputDir.replace(/\//g, "\\")}"`);
}

main();
