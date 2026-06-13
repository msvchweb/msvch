import { readFileSync } from "fs";

export type Mood = "solemn" | "uplifting" | "peaceful" | "reflective";
const MOODS: Mood[] = ["solemn", "uplifting", "peaceful", "reflective"];

/** 하이라이트 클립 길이 허용 범위 (초). 범위 밖/비정상 시간은 skip. */
const MIN_CLIP_SEC = 20;
const MAX_CLIP_SEC = 70;

/** 영상 앞뒤 배제 구간 (초). 인트로·광고·엔딩 크레딧 흡수. */
const EDGE_HEAD_SEC = 60;
const EDGE_TAIL_SEC = 90;

/** edge 배제 후 매칭 후보가 이 개수 미만이면 edge 배제를 건너뛴다 (짧은 영상 보호). */
const MIN_CANDIDATE = 30;

/** 채택 클립 간 시작 시각 최소 간격 (초). 서로 다른 구간 보장. */
const MIN_GAP_SEC = 30;

/** 자막 크레딧 라인 블랙리스트 (원문 매칭). 경계로 선택되지 않게 후보·Gemini 입력 양쪽에서 제외. */
const CREDIT_PATTERNS: RegExp[] = [
  /한글\s*자막/,
  /자막\s*by/i,
  /자막\s*제작/,
  /자막\s*감수/,
  /이\s*영상은\s*자막/,
  /자막을?\s*사용/,
  /by\s*[가-힣]{2,4}(?![가-힣])/i,
];

function isCreditLine(rawText: string): boolean {
  return CREDIT_PATTERNS.some((re) => re.test(rawText));
}

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

/** 인용 매칭용 — 각 SubSegment 의 정규화 텍스트 + 인덱스/시각 보존. */
interface NormalizedSegment {
  idx: number;
  startMs: number;
  endMs: number;
  rawText: string;
  normText: string;
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

/**
 * 비교용 정규화: 한글/영문/숫자만 남기고 전체 공백 제거 + 소문자.
 * 한국어 자막의 띄어쓰기·문장부호 불안정성을 흡수한다.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/gu, "");
}

/** 두 문자열의 최장 공통 substring 길이. */
function longestCommonSubstring(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    let diagPrev = 0; // dp[i-1][j-1]
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        const val = diagPrev + 1;
        prev[j] = val;
        if (val > best) best = val;
      } else {
        prev[j] = 0;
      }
      diagPrev = tmp;
    }
  }
  return best;
}

/**
 * 인용 문장을 매칭 후보(NormalizedSegment[])에서 찾아 SubSegment 인덱스를 반환.
 * 3단계 fallback: 정확 포함 → 다중 세그먼트 연결 → 최장 공통 substring 60% 임계.
 */
function findSegmentIndex(
  quote: string,
  candidates: NormalizedSegment[],
): number | null {
  const nQuote = normalize(quote);
  if (nQuote.length === 0 || candidates.length === 0) return null;

  // 1단계 — 정확 포함 (양방향: 자막은 짧게 쪼개짐).
  for (const c of candidates) {
    if (c.normText.includes(nQuote) || nQuote.includes(c.normText)) {
      if (c.normText.length > 0) return c.idx;
    }
  }

  // 2단계 — 인접 세그먼트 누적 연결 (window) 이 nQuote 를 포함하는 시작 c.
  for (let i = 0; i < candidates.length; i++) {
    let acc = "";
    for (let j = i; j < candidates.length && acc.length < nQuote.length + 40; j++) {
      acc += candidates[j].normText;
      if (acc.includes(nQuote)) {
        return candidates[i].idx;
      }
    }
  }

  // 3단계 — 최장 공통 substring 임계.
  const threshold = Math.max(8, Math.floor(nQuote.length * 0.6));
  let bestIdx: number | null = null;
  let bestLen = 0;
  for (const c of candidates) {
    const lcs = longestCommonSubstring(nQuote, c.normText);
    if (lcs > bestLen) {
      bestLen = lcs;
      bestIdx = c.idx;
    }
  }
  if (bestIdx !== null && bestLen >= threshold) return bestIdx;
  return null;
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/** Gemini 원시 응답 1건 (내부 전용 — HighlightSegment 와 분리). */
interface GeminiRawHighlight {
  quote_start: string;
  quote_end: string;
  title: string;
  hook: string;
  reason: string;
  keywords: string[];
  card_text: string;
  peak_sec?: number;
  mood: string;
}

interface GeminiRawResult {
  highlights: GeminiRawHighlight[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function toMood(s: string): Mood {
  return MOODS.find((m) => m === s) ?? "peaceful";
}

/** 단일 raw highlight 런타임 타입 가드 (수동 — zod 미사용). */
function isGeminiRawHighlight(v: unknown): v is GeminiRawHighlight {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.quote_start !== "string") return false;
  if (typeof o.quote_end !== "string") return false;
  if (typeof o.title !== "string") return false;
  if (typeof o.hook !== "string") return false;
  if (typeof o.reason !== "string") return false;
  if (!isStringArray(o.keywords)) return false;
  if (typeof o.card_text !== "string") return false;
  if (o.peak_sec !== undefined && typeof o.peak_sec !== "number") return false;
  if (typeof o.mood !== "string") return false;
  return true;
}

/** Gemini 응답 전체 런타임 타입 가드. highlights 배열만 검사, 항목 좁히기는 호출부에서 항목 단위로 수행. */
function isGeminiRawResult(v: unknown): v is { highlights: unknown[] } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.highlights);
}

function segmentsToTranscript(candidates: NormalizedSegment[]): string {
  return candidates
    .map((c) => {
      const sec = Math.floor(c.startMs / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${c.rawText.trim()}`;
    })
    .filter((line) => line.length > 8)
    .join("\n");
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
  count: number = 5,
): Promise<HighlightSegment[]> {
  const segments = parseJson3(subtitlePath);
  if (segments.length === 0) {
    throw new Error("자막이 비어 있습니다.");
  }

  // 매칭 후보 산출: 크레딧 라인 제외 + (조건부) edge 구간 제외.
  const totalSec = segments[segments.length - 1].endMs / 1000;

  const nonCredit: NormalizedSegment[] = segments
    .map((s, idx) => ({
      idx,
      startMs: s.startMs,
      endMs: s.endMs,
      rawText: s.text,
      normText: normalize(s.text),
    }))
    .filter((c) => c.normText.length > 0 && !isCreditLine(c.rawText));

  const edgeFiltered = nonCredit.filter(
    (c) =>
      c.startMs / 1000 >= EDGE_HEAD_SEC &&
      c.endMs / 1000 <= totalSec - EDGE_TAIL_SEC,
  );
  // edge 배제 후 후보가 너무 적으면 (짧은 영상) edge 배제를 건너뛴다.
  const candidates =
    edgeFiltered.length >= MIN_CANDIDATE ? edgeFiltered : nonCredit;

  const transcript = segmentsToTranscript(candidates);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const prompt = `당신은 교회 설교 편집자입니다.
아래는 한국어 설교 트랜스크립트입니다 (타임스탬프 포함).

다음 조건을 만족하는 30~55초 구간 ${count}개를 골라주세요:
- 한 가지 완결된 메시지를 담고 있을 것
- 문장이 자연스럽게 시작하고 끝날 것
- 감정적 호소, 핵심 적용, 인상 깊은 비유, 도전적 권면 중 하나에 해당
- 비신자에게도 이해 가능할 것 (내부 용어/상황 의존 X)
- ${count}개는 서로 주제가 겹치지 않을 것

각 클립에 대해 추가로 아래 항목을 함께 산출하세요:
- quote_start: 구간이 시작하는 문장 전체를 트랜스크립트에 나온 그대로(앞의 타임스탬프 [mm:ss] 제외) 정확히 복사하세요.
- quote_end: 구간이 끝나는 문장 전체를 트랜스크립트에 나온 그대로(앞의 타임스탬프 [mm:ss] 제외) 정확히 복사하세요.
- 시간 숫자(start_sec/end_sec)는 절대 반환하지 마세요. 오직 문장만 정확히 인용하세요.
- keywords: 본문에서 시각적으로 강조할 핵심 단어 3~5개. 한국어 명사·동사 위주. 조사·접속사 제외. 본문에 실제로 등장하는 표기 그대로.
- card_text: 화면 상단에 큰 글씨로 띄울 15자 이내 한 줄. 제목과 다른 각도에서 호기심을 유발하는 문장이나 핵심 단어.
- peak_sec: 구간 내 가장 임팩트 있는 한 시점(초).
- mood: 이 클립의 정서. 다음 중 정확히 하나로만 답하세요.
  · solemn — 엄숙·회개·죄·십자가·심판
  · uplifting — 희망·은혜·약속·찬양
  · peaceful — 평온·위로·안식·사랑
  · reflective — 사색·결단·적용·말씀 묵상

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{"highlights":[{"quote_start":"트랜스크립트에 나온 시작 문장 그대로","quote_end":"트랜스크립트에 나온 끝 문장 그대로","title":"20자 이내","hook":"첫 3초 훅 한 줄","reason":"선정 이유 1문장","keywords":["단어1","단어2","단어3"],"card_text":"15자 이내","peak_sec":0,"mood":"peaceful"}]}

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

  const parsedUnknown: unknown = JSON.parse(text);
  if (!isGeminiRawResult(parsedUnknown)) {
    throw new Error("Gemini 응답 형식이 올바르지 않습니다 (highlights 배열 없음).");
  }
  // 항목 단위 가드 통과분만 채택.
  const raw: GeminiRawHighlight[] = parsedUnknown.highlights.filter(
    (h): h is GeminiRawHighlight => isGeminiRawHighlight(h),
  );

  // 파이프라인: 인용 매칭 → 길이(MIN/MAX) 검증 → 중복/분산 가드 → mood → voiced.
  const accepted: HighlightSegment[] = [];

  for (const h of raw) {
    // 인용 기반 타임스탬프 매핑.
    let startIdx = findSegmentIndex(h.quote_start, candidates);
    let endIdx = findSegmentIndex(h.quote_end, candidates);

    if (startIdx === null || endIdx === null) {
      console.warn(
        `[shorts] 인용 매칭 실패 (skip): "${h.title}" qs="${h.quote_start.slice(0, 20)}" qe="${h.quote_end.slice(0, 20)}"`,
      );
      continue;
    }

    if (endIdx < startIdx) {
      // 시작/끝 순서가 뒤집힌 경우 swap 으로 구제.
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      startIdx = lo;
      endIdx = hi;
    }
    if (endIdx < startIdx) {
      console.warn(
        `[shorts] 인용 순서 비정상 (skip): "${h.title}" startIdx=${startIdx} endIdx=${endIdx}`,
      );
      continue;
    }

    const startSeg = segments[startIdx];
    const endSeg = segments[endIdx];
    const start_sec = startSeg.startMs / 1000;
    const end_sec = endSeg.endMs / 1000;

    // 길이 검증.
    const dur = end_sec - start_sec;
    const bad =
      !Number.isFinite(start_sec) ||
      !Number.isFinite(end_sec) ||
      start_sec < 0 ||
      dur < MIN_CLIP_SEC ||
      dur > MAX_CLIP_SEC;
    if (bad) {
      console.warn(
        `[shorts] 하이라이트 버림: "${h.title}" start=${start_sec} end=${end_sec} dur=${dur}`,
      );
      continue;
    }

    // 중복/분산 가드 (겹침 거부 + 시작 간격 30초).
    const conflict = accepted.some(
      (a) =>
        (start_sec < a.end_sec && a.start_sec < end_sec) ||
        Math.abs(start_sec - a.start_sec) < MIN_GAP_SEC,
    );
    if (conflict) {
      console.warn(
        `[shorts] 중복/근접 하이라이트 버림: "${h.title}" start=${start_sec}`,
      );
      continue;
    }

    const mood: Mood = toMood(h.mood);

    accepted.push({
      start_sec,
      end_sec,
      title: h.title,
      hook: h.hook,
      reason: h.reason,
      keywords: h.keywords.filter((k) => k.trim().length > 0),
      card_text:
        h.card_text.trim().length > 0 ? h.card_text.trim() : h.title,
      peak_sec: h.peak_sec,
      mood,
      voiced: computeVoicedChunks(segments, start_sec, end_sec),
    });
  }

  if (accepted.length === 0) {
    throw new Error(
      "유효한 하이라이트가 없습니다 (모두 인용 매칭/시간 비정상). Gemini 응답 확인 필요.",
    );
  }

  console.log(`[shorts] 유효 하이라이트 ${accepted.length}/${raw.length}개`);

  return accepted;
}
