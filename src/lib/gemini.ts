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

  const prompt = `당신은 교회 설교 요약 전문가입니다. 아래 YouTube 설교 영상의 내용을 바탕으로 교인들이 읽기 좋은 설교 요약을 작성해주세요.

## 설교 정보
- 제목: ${sermon.title}
- 영상 URL: https://www.youtube.com/watch?v=${sermon.videoId}

## 요약 형식
1. **말씀 본문** (성경 구절)
2. **핵심 메시지** (2~3문장)
3. **주요 내용** (3~5개 항목으로 정리)
4. **삶에 적용** (1~2문장)

한국어로 작성하고, 경어체를 사용하세요.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                file_data: {
                  mime_type: "video/mp4",
                  file_uri: `https://www.youtube.com/watch?v=${sermon.videoId}`,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    // Fallback: try text-only with video description
    return await summarizeFromDescription(sermon, apiKey);
  }

  const data = (await res.json()) as GeminiResponse;
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return await summarizeFromDescription(sermon, apiKey);
  }

  return data.candidates[0].content.parts[0].text;
}

async function summarizeFromDescription(
  sermon: SermonVideo,
  apiKey: string
): Promise<string> {
  // Fallback: use video description (from RSS) for summary
  const prompt = `당신은 교회 설교 요약 전문가입니다. 아래 설교 정보를 바탕으로 교인들이 읽기 좋은 설교 요약을 작성해주세요.

## 설교 정보
- 제목: ${sermon.title}
- 날짜: ${sermon.publishedAt}
- 설교 설명:
${sermon.description}

## 요약 형식
1. **말씀 본문** (성경 구절)
2. **핵심 메시지** (2~3문장)
3. **주요 내용** (3~5개 항목으로 정리)
4. **삶에 적용** (1~2문장)

한국어로 작성하고, 경어체를 사용하세요. 설교 설명에 포함된 성경 구절과 제목을 활용하여 요약해주세요.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
