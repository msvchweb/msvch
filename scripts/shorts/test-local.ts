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
const VIDEO_ID = "bxsT4UdE2qE";

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

// --- Gemini 호출 ---
interface HighlightSegment {
  start_sec: number;
  end_sec: number;
  title: string;
  hook: string;
  reason: string;
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

반드시 아래 JSON 형식으로만 응답하세요.

{"highlights":[{"start_sec":330,"end_sec":375,"title":"20자 이내","hook":"첫 3초 훅 한 줄","reason":"선정 이유 1문장"}]}

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

  // segment 경계 스냅 + 유효성 검증
  const snapped = parsed.highlights.map((h) => {
    const startSeg = segments.reduce((best, s) =>
      Math.abs(s.startMs / 1000 - h.start_sec) < Math.abs(best.startMs / 1000 - h.start_sec) ? s : best
    );
    const endSeg = segments.reduce((best, s) =>
      Math.abs(s.endMs / 1000 - h.end_sec) < Math.abs(best.endMs / 1000 - h.end_sec) ? s : best
    );
    return { ...h, start_sec: startSeg.startMs / 1000, end_sec: endSeg.endMs / 1000 };
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

function generateASS(subtitlePath: string, startSec: number, endSec: number): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8")) as { events: Json3Event[] };
  let assDialogue = "";

  for (const e of raw.events) {
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
Style: Default,Malgun Gothic,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,20,20,80,1

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

  // 1. 하이라이트 선정 (3개만 — 테스트용)
  const highlights = await selectHighlights(subtitlePath);

  // 2. 첫 번째 클립만 FFmpeg으로 편집
  const { mkdirSync } = await import("fs");
  const outputDir = path.join(WORK_DIR, "output");
  mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    console.log(`\n[${i + 1}/${highlights.length}] "${h.title}" 편집 중 (${h.start_sec}s ~ ${h.end_sec}s)...`);

    const assContent = generateASS(subtitlePath, h.start_sec, h.end_sec);
    const assPath = path.join(outputDir, `clip_${i}.ass`);
    const outputPath = path.join(outputDir, `clip_${i}.mp4`);

    writeFileSync(assPath, assContent, "utf-8");

    // Windows에서 ffmpeg 필터에 경로 넣을 때 백슬래시 이스케이프
    const assPathEscaped = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    try {
      execSync(
        [
          "ffmpeg -y",
          `-ss ${h.start_sec}`,
          `-to ${h.end_sec}`,
          `-i "${videoPath}"`,
          `-vf "crop=ih*9/16:ih,scale=1080:1920,ass='${assPathEscaped}'"`,
          "-c:v libx264 -preset fast -crf 23",
          "-c:a aac -b:a 128k",
          "-movflags +faststart",
          `"${outputPath}"`,
        ].join(" "),
        { stdio: "inherit", timeout: 120_000 },
      );
      console.log(`  -> ${outputPath}`);
    } catch (err) {
      console.error(`  FFmpeg 실패, 자막 없이 재시도...`);
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
      console.log(`  -> ${outputPath} (자막 없음)`);
    }
  }

  console.log(`\n완료! 결과물: ${outputDir}`);
  console.log("탐색기에서 열기:");
  console.log(`  explorer "${outputDir.replace(/\//g, "\\")}"`);
}

main();
