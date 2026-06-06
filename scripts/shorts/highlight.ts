import { readFileSync } from "fs";

export type Mood = "solemn" | "uplifting" | "peaceful" | "reflective";
const MOODS: Mood[] = ["solemn", "uplifting", "peaceful", "reflective"];

/** 하이라이트 클립 길이 허용 범위 (초). 범위 밖/비정상 시간은 skip. */
const MIN_CLIP_SEC = 20;
const MAX_CLIP_SEC = 70;

/** 침묵 컷 후 남는 음성 chunk (절대 시간, 초). */
export interface VoicedChunk {
  start: number;
  end: number;
}

/** Gemini 하이라이트 선정 결과 + 후처리 (voiced chunks). */
export interface HighlightSegment {
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

interface Json3Seg {
  utf8: string;
  tOffsetMs?: number;
}

interface Json3Event {
  tStartMs: number;
  dDurationMs: number;
  segs?: Json3Seg[];
}

interface Json3Subtitle {
  events: Json3Event[];
}

interface SubSegment {
  startMs: number;
  endMs: number;
  text: string;
}

function parseJson3(filePath: string): SubSegment[] {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Json3Subtitle;
  return raw.events
    .filter((e) => e.segs && e.segs.some((s) => s.utf8.trim()))
    .map((e) => ({
      startMs: e.tStartMs,
      endMs: e.tStartMs + e.dDurationMs,
      text: (e.segs ?? []).map((s) => s.utf8).join(""),
    }));
}

function segmentsToTranscript(segments: SubSegment[]): string {
  return segments
    .map((s) => {
      const sec = Math.floor(s.startMs / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${s.text.trim()}`;
    })
    .filter((line) => line.length > 8)
    .join("\n");
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

interface GeminiHighlightResult {
  highlights: HighlightSegment[];
}

/**
 * 자막 segments 기반 음성 chunks 산출. silence > silenceThreshold (초) 이면 컷.
 * 안전장치:
 *   - chunks 가 6개 이상이면 임계값을 1.5초로 올려 재계산 (너무 잘게 잘리는 것 방지)
 *   - voiced 합계 < 클립 길이의 70% 또는 < 20초 → 자막 누락 의심 → 단일 chunk 반환 (컷 skip)
 */
export function computeVoicedChunks(
  segments: SubSegment[],
  startSec: number,
  endSec: number,
): VoicedChunk[] {
  const compute = (threshold: number): VoicedChunk[] => {
    const inClip = segments
      .filter((s) => s.endMs / 1000 > startSec && s.startMs / 1000 < endSec)
      .map((s) => ({
        start: Math.max(startSec, s.startMs / 1000),
        end: Math.min(endSec, s.endMs / 1000),
      }))
      .sort((a, b) => a.start - b.start);

    // 인접 segment 겹침 정리 (rolling caption 대응)
    for (let i = 0; i < inClip.length - 1; i++) {
      if (inClip[i].end > inClip[i + 1].start) {
        inClip[i].end = inClip[i + 1].start;
      }
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

export async function selectHighlights(
  subtitlePath: string,
): Promise<HighlightSegment[]> {
  const segments = parseJson3(subtitlePath);
  if (segments.length === 0) {
    throw new Error("자막이 비어 있습니다.");
  }

  const transcript = segmentsToTranscript(segments);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const prompt = `당신은 교회 설교 편집자입니다.
아래는 한국어 설교 트랜스크립트입니다 (타임스탬프 포함).

다음 조건을 만족하는 30~55초 구간 5개를 골라주세요:
- 한 가지 완결된 메시지를 담고 있을 것
- 문장이 자연스럽게 시작하고 끝날 것
- 감정적 호소, 핵심 적용, 인상 깊은 비유, 도전적 권면 중 하나에 해당
- 비신자에게도 이해 가능할 것 (내부 용어/상황 의존 X)
- 5개는 서로 주제가 겹치지 않을 것

각 클립에 대해 추가로 아래 항목을 함께 산출하세요:
- keywords: 본문에서 시각적으로 강조할 핵심 단어 3~5개. 한국어 명사·동사 위주. 조사·접속사 제외. 본문에 실제로 등장하는 표기 그대로.
- card_text: 화면 상단에 큰 글씨로 띄울 15자 이내 한 줄. 제목과 다른 각도에서 호기심을 유발하는 문장이나 핵심 단어.
- peak_sec: 구간 내 가장 임팩트 있는 한 시점(초).
- mood: 이 클립의 정서. 다음 중 정확히 하나로만 답하세요.
  · solemn — 엄숙·회개·죄·십자가·심판
  · uplifting — 희망·은혜·약속·찬양
  · peaceful — 평온·위로·안식·사랑
  · reflective — 사색·결단·적용·말씀 묵상

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{"highlights":[{"start_sec":0,"end_sec":0,"title":"20자 이내","hook":"첫 3초 훅 한 줄","reason":"선정 이유 1문장","keywords":["단어1","단어2","단어3"],"card_text":"15자 이내","peak_sec":0,"mood":"peaceful"}]}

트랜스크립트:
${transcript}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini API 실패: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");

  const parsed = JSON.parse(text) as GeminiHighlightResult;

  // 타임스탬프 스냅 + keywords/card_text/mood 안전 기본값 + voiced chunks 산출
  const snapped = parsed.highlights.map((h) => {
    const startSeg = segments.reduce((best, s) =>
      Math.abs(s.startMs / 1000 - h.start_sec) <
      Math.abs(best.startMs / 1000 - h.start_sec)
        ? s
        : best,
    );
    const endSeg = segments.reduce((best, s) =>
      Math.abs(s.endMs / 1000 - h.end_sec) <
      Math.abs(best.endMs / 1000 - h.end_sec)
        ? s
        : best,
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

  // 비정상 시간 하이라이트 검증/필터 (end_sec ≤ start_sec, 길이 범위 밖, 음수/비유한 → skip)
  const valid = snapped.filter((h) => {
    const dur = h.end_sec - h.start_sec;
    const bad =
      !Number.isFinite(h.start_sec) ||
      !Number.isFinite(h.end_sec) ||
      h.start_sec < 0 ||
      dur < MIN_CLIP_SEC ||
      dur > MAX_CLIP_SEC;
    if (bad) {
      console.warn(
        `[shorts] 하이라이트 버림: "${h.title}" start=${h.start_sec} end=${h.end_sec} dur=${dur}`,
      );
    }
    return !bad;
  });

  if (valid.length === 0) {
    throw new Error(
      "유효한 하이라이트가 없습니다 (모두 시간 비정상). Gemini 응답 확인 필요.",
    );
  }

  console.log(
    `[shorts] 유효 하이라이트 ${valid.length}/${parsed.highlights.length}개`,
  );

  return valid;
}
