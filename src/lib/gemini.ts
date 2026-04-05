import type { SermonVideo } from "@/types/youtube";

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

export async function summarizeSermonFromVideo(
  sermon: SermonVideo
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const prompt = `당신은 교회 설교 요약 전문가입니다. 아래 설교 정보를 바탕으로 교인들이 읽기 좋은 설교 요약을 작성해주세요.

## 설교 정보
- 제목: ${sermon.title}
- 날짜: ${sermon.publishedAt.split("T")[0]}

## 설교 설명
${sermon.description}

## 요약 형식
1. **말씀 본문** (성경 구절 전문 포함)
2. **핵심 메시지** (2~3문장)
3. **주요 내용** (3~5개 항목으로 정리)
4. **삶에 적용** (1~2문장)

위 설교 제목과 설명에 포함된 성경 구절, 설교 주제를 활용하여 충실한 요약을 작성해주세요.
한국어로 작성하고, 경어체를 사용하세요.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as GeminiResponse;
  return data.candidates[0].content.parts[0].text;
}
