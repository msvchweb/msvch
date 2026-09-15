import type { SermonVideo } from "@/types/youtube";

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

/** Gemini API 의 contents[].parts[] 항목. text 또는 inlineData(이미지) 만 사용. */
export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

// 503/429/500/502/504는 일시적 장애로 보고 재시도/폴백 대상
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// 1차 → 폴백 순서. 앞에서부터 순차적으로 시도한다.
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];

export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiInner(
  model: string,
  apiKey: string,
  parts: GeminiPart[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, status: 500, body: "Gemini 응답에 텍스트가 없습니다." };
  }
  return { ok: true, text };
}

/** 폴백 체인 + 지수 백오프 재시도 공용 본체. */
async function callWithRetryAndFallback(parts: GeminiPart[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  let lastTransientStatus = 0;
  let lastErrorBody = "";

  for (const model of MODEL_FALLBACK_CHAIN) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await callGeminiInner(model, apiKey, parts);
      if (result.ok) return result.text;

      if (!RETRYABLE_STATUS.has(result.status)) {
        throw new Error(`Gemini API 오류: ${result.status} ${result.body}`);
      }

      lastTransientStatus = result.status;
      lastErrorBody = result.body;

      if (attempt < maxAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  throw new GeminiUnavailableError(
    `AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요. (마지막 상태: ${lastTransientStatus} ${lastErrorBody.slice(0, 200)})`
  );
}

/**
 * 폴백 체인 + 지수 백오프 재시도를 포함한 범용 Gemini 텍스트 호출.
 * scripts/shorts/ 및 API 라우트에서 재사용 가능.
 */
export async function callGeminiWithFallback(prompt: string): Promise<string> {
  return callWithRetryAndFallback([{ text: prompt }]);
}

/**
 * 멀티모달 호출 — 텍스트 + (선택) 이미지 1장.
 * image 가 undefined 면 텍스트 전용 경로와 동일하게 동작.
 * Gemini 2.5 Flash 무료티어가 image input 도 지원.
 */
export async function callGeminiWithFallbackMultimodal(
  prompt: string,
  image?: { base64: string; mimeType: string } | { base64: string; mimeType: string }[],
): Promise<string> {
  const images = image ? (Array.isArray(image) ? image : [image]) : [];
  const parts: GeminiPart[] = [
    { text: prompt },
    ...images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    })),
  ];
  return callWithRetryAndFallback(parts);
}

/** callGeminiSingleModel 이 HTTP 오류 응답을 받았을 때. status 로 일시 장애와 설정 오류를 구분한다. */
export class GeminiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiHttpError";
    this.status = status;
  }
}

/** callGeminiSingleModel 이 timeoutMs 안에 응답을 끝까지 받지 못했을 때. */
export class GeminiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiTimeoutError";
  }
}

interface GeminiSingleModelResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/**
 * 모델 1개를 1회만 호출 — 내부 재시도·모델 폴백 없음.
 * 재시도는 호출자(작업 단위, 예: 주보 사진 → 일정 주간 동기화)가 담당한다.
 *
 * - 응답 텍스트는 candidates[0] 의 text 파트를 이어 붙인 값 (없으면 빈 문자열).
 * - API 키는 요청 URL 이 아니라 `x-goog-api-key` 헤더로 보낸다 (URL 은 로그·오류 원인에 남기 쉽다).
 *
 * @throws Error               GEMINI_API_KEY 미설정
 * @throws GeminiHttpError     HTTP 오류 응답
 * @throws GeminiTimeoutError  timeoutMs 초과 (응답 본문 읽기 포함)
 * @throws TypeError           네트워크 오류 (fetch 실패)
 */
export async function callGeminiSingleModel(input: {
  model: string;
  parts: GeminiPart[];
  timeoutMs: number;
  responseMimeType?: "application/json";
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: input.parts }],
          ...(input.responseMimeType
            ? { generationConfig: { responseMimeType: input.responseMimeType } }
            : {}),
        }),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new GeminiHttpError(
        res.status,
        `Gemini API 오류 (${input.model}): ${res.status} ${body.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as GeminiSingleModelResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("");
  } catch (err) {
    if (controller.signal.aborted) {
      throw new GeminiTimeoutError(
        `Gemini 응답 시간 초과 (${input.model}, ${input.timeoutMs}ms)`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function summarizeSermonFromVideo(
  sermon: SermonVideo
): Promise<string> {
  const prompt = `당신은 교회 설교 요약 전문가입니다. 아래 설교 정보를 바탕으로 교인들이 읽기 좋은 설교 요약을 작성해주세요.

설교 제목: ${sermon.title}
날짜: ${sermon.publishedAt.split("T")[0]}

설교 설명:
${sermon.description}

아래 형식에 맞춰 요약을 작성해주세요.
절대로 마크다운 문법(**, ##, - 등)을 사용하지 마세요.
일반 텍스트로만 작성하고, 줄바꿈과 띄어쓰기로 구분해주세요.
교회에 다니는 일반 교인들이 편하게 읽을 수 있는 따뜻하고 자연스러운 문체로 써주세요.

[말씀 본문]
성경 구절 (예: 사도행전 3장 14~16절)
해당 구절 본문을 그대로 적어주세요.

[핵심 메시지]
이번 설교의 핵심을 2~3문장으로 요약해주세요.

[주요 내용]
설교에서 전한 중요한 내용을 3~5가지로 정리해주세요.
각 항목은 번호(1. 2. 3.)를 붙여주세요.

[삶에 적용]
이 말씀을 삶에서 어떻게 적용할 수 있는지 1~2문장으로 적어주세요.

한국어로, 경어체로 작성해주세요.`;

  return callGeminiWithFallback(prompt);
}
