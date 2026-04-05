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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
