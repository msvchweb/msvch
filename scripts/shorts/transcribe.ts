import { execSync } from "child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { z } from "zod";
import { WORK_DIR } from "./lib/paths";

// ── 상수 (turbo 전환은 이 한 줄 교체) ─────────────────────
export const GROQ_STT_MODEL = "whisper-large-v3";
//   대안: "whisper-large-v3-turbo" (속도 우선 시)
const GROQ_STT_ENDPOINT =
  "https://api.groq.com/openai/v1/audio/transcriptions";

// 25MB Groq 한도에 대한 보수적 가드 (인코딩 오버헤드 여유 1MB)
const GROQ_MAX_BYTES = 24 * 1024 * 1024; // 24MB → 초과 시 청크 분할
const CHUNK_DURATION_SEC = 600; // 청크 1개 = 10분

// ── Groq verbose_json 응답 타입 (any/unknown 금지, zod 검증) ──
export interface GroqSegment {
  id: number;
  start: number; // 초 (소수)
  end: number; // 초 (소수)
  text: string;
}
export interface GroqVerboseJson {
  text: string;
  segments: GroqSegment[];
  language?: string;
  duration?: number;
}

const groqSegmentSchema = z.object({
  id: z.number(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

const groqVerboseJsonSchema = z.object({
  text: z.string(),
  segments: z.array(groqSegmentSchema),
  language: z.string().optional(),
  duration: z.number().optional(),
});

// json3 형태 (highlight.ts / edit.ts 의 parseJson3 가 기대하는 구조와 정확히 일치)
export interface Json3Seg {
  utf8: string;
}
export interface Json3Event {
  tStartMs: number;
  dDurationMs: number;
  segs: Json3Seg[];
}
export interface Json3Subtitle {
  events: Json3Event[];
}

/** Groq STT 호출. verbose_json 응답을 zod 로 검증해 반환. */
async function callGroq(audioFilePath: string): Promise<GroqVerboseJson> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY 미설정");

  const buffer = readFileSync(audioFilePath);
  // Node 20 내장 undici fetch + FormData + Blob 으로 multipart 구성.
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const form = new FormData();
  form.append("file", blob, "audio.mp3");
  form.append("model", GROQ_STT_MODEL);
  form.append("response_format", "verbose_json");
  form.append("language", "ko");
  form.append("temperature", "0");

  const res = await fetch(GROQ_STT_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Groq STT 실패: ${res.status} ${await res.text()}`);
  }

  const json: unknown = await res.json();
  const parsed = groqVerboseJsonSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Groq 응답 검증 실패: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Groq segment 배열 → json3 (1 segment = 1 event). 빈 텍스트 segment 제외. */
function serializeToJson3(segments: GroqSegment[]): Json3Subtitle {
  const events: Json3Event[] = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    if (text === "") continue;
    events.push({
      tStartMs: Math.round(seg.start * 1000),
      dDurationMs: Math.max(0, Math.round((seg.end - seg.start) * 1000)),
      segs: [{ utf8: text }],
    });
  }
  return { events };
}

/** 24MB 초과 오디오를 10분 단위로 분할. 각 청크의 offsetSec 동봉. */
function chunkAudio(audioPath: string): { path: string; offsetSec: number }[] {
  // 방어적: 단독 실행/테스트 내성. 정상 파이프라인에선 download 가 선행 생성.
  mkdirSync(WORK_DIR, { recursive: true });
  const base = path.basename(audioPath, path.extname(audioPath));
  const pattern = path.join(WORK_DIR, `${base}_chunk_%03d.mp3`);

  execSync(
    [
      "ffmpeg -y",
      `-i "${audioPath}"`,
      "-f segment",
      `-segment_time ${CHUNK_DURATION_SEC}`,
      "-c copy",
      `"${pattern}"`,
    ].join(" "),
    { stdio: "inherit", timeout: 300_000 },
  );

  const prefix = `${base}_chunk_`;
  const files = readdirSync(WORK_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".mp3"))
    .sort();

  return files.map((f, index) => ({
    path: path.join(WORK_DIR, f),
    offsetSec: index * CHUNK_DURATION_SEC,
  }));
}

/** 각 청크 segment 의 start/end 에 offsetSec 를 더해 절대 시간으로 보정 후 병합. */
function mergeSegments(
  parts: { segs: GroqSegment[]; offsetSec: number }[],
): GroqSegment[] {
  const merged: GroqSegment[] = [];
  let nextId = 0;
  for (const part of parts) {
    for (const seg of part.segs) {
      merged.push({
        id: nextId++,
        start: seg.start + part.offsetSec,
        end: seg.end + part.offsetSec,
        text: seg.text,
      });
    }
  }
  return merged;
}

/**
 * 추출된 16kHz mono 오디오 파일을 Groq Whisper 로 전사하고,
 * 기존 parseJson3 가 읽을 수 있는 json3 파일로 직렬화해 그 경로를 반환.
 * 24MB 초과 시 내부에서 청크 분할→병합(타임스탬프 offset 보정).
 * @param audioPath 16kHz mono 오디오 (mp3) 절대 경로
 * @param outPath   직렬화한 json3 파일을 쓸 절대 경로
 * @returns outPath (= json3 파일 경로)
 */
export async function transcribeWithGroq(
  audioPath: string,
  outPath: string,
): Promise<string> {
  const sizeBytes = statSync(audioPath).size;

  let segments: GroqSegment[];
  if (sizeBytes <= GROQ_MAX_BYTES) {
    const result = await callGroq(audioPath);
    segments = result.segments;
  } else {
    const chunks = chunkAudio(audioPath);
    const parts: { segs: GroqSegment[]; offsetSec: number }[] = [];
    for (const chunk of chunks) {
      const result = await callGroq(chunk.path);
      parts.push({ segs: result.segments, offsetSec: chunk.offsetSec });
    }
    segments = mergeSegments(parts);
  }

  const json3 = serializeToJson3(segments);
  writeFileSync(outPath, JSON.stringify(json3), "utf-8");
  return outPath;
}
