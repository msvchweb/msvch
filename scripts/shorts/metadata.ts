import type { HighlightSegment } from "./highlight";

export interface ClipMetadata {
  title_yt: string;
  caption_yt: string;
  caption_ig: string;
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

export async function generateMetadata(
  highlights: HighlightSegment[],
): Promise<ClipMetadata[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const clipList = highlights
    .map(
      (h, i) =>
        `${i + 1}. "${h.title}" (${Math.round(h.end_sec - h.start_sec)}초) - 훅: ${h.hook}`,
    )
    .join("\n");

  const prompt = `당신은 교회 SNS 콘텐츠 편집자입니다.
아래 5개 설교 하이라이트 클립에 대해 각각 메타데이터를 생성해주세요.

클립 목록:
${clipList}

각 클립에 대해:
- title_yt: YouTube 제목 (50자 이내, 끝에 #Shorts 포함)
- caption_yt: YouTube 설명 (해시태그 5개 포함, 200자 이내)
- caption_ig: Instagram 캡션 (해시태그 15개 포함, 500자 이내)

반드시 JSON 배열로만 응답하세요:
[{"title_yt":"...","caption_yt":"...","caption_ig":"..."}]`;

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
    throw new Error(`Gemini 메타데이터 실패: ${res.status}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 메타데이터 응답이 비어 있습니다.");

  return JSON.parse(text) as ClipMetadata[];
}
