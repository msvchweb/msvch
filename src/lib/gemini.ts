import type { SermonVideo } from "@/types/youtube";

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

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

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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

export async function summarizeSermonFromVideo(
  sermon: SermonVideo
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

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

  let lastTransientStatus = 0;
  let lastErrorBody = "";

  // 모델별로 지수 백오프 재시도. 일시적 오류면 다음 모델로 폴백.
  for (const model of MODEL_FALLBACK_CHAIN) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await callGemini(model, apiKey, prompt);

      if (result.ok) return result.text;

      // 일시적 오류가 아니면 즉시 throw (재시도/폴백 의미 없음)
      if (!RETRYABLE_STATUS.has(result.status)) {
        throw new Error(`Gemini API 오류: ${result.status} ${result.body}`);
      }

      lastTransientStatus = result.status;
      lastErrorBody = result.body;

      // 다음 시도 전 지수 백오프 (1s → 2s → 4s)
      if (attempt < maxAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
    // 이 모델에서 재시도 다 소진 → 다음 폴백 모델로
  }

  throw new GeminiUnavailableError(
    `AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요. (마지막 상태: ${lastTransientStatus} ${lastErrorBody.slice(0, 200)})`
  );
}
