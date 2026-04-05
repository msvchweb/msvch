import type { SermonVideo } from "@/types/youtube";

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

interface CaptionEvent {
  segs?: { utf8: string }[];
}

export async function getYouTubeCaptions(videoId: string): Promise<string> {
  // Fetch video page to extract caption URL
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await pageRes.text();

  // Extract auto-caption URL
  const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"(.*?)"/);
  if (!captionMatch) {
    throw new Error("자막을 찾을 수 없습니다. 이 영상에 자막이 없을 수 있습니다.");
  }

  const captionUrl = captionMatch[1]
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"');

  // Fetch caption as JSON
  const captionRes = await fetch(`${captionUrl}&fmt=json3`);
  if (!captionRes.ok) {
    throw new Error("자막을 가져올 수 없습니다.");
  }

  const captionData = await captionRes.json() as { events: CaptionEvent[] };

  // Extract text from caption events
  const text = captionData.events
    .filter((e) => e.segs)
    .map((e) => e.segs!.map((s) => s.utf8).join(""))
    .join("")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export async function summarizeSermon(
  sermon: SermonVideo,
  captions: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const prompt = `당신은 교회 설교 요약 전문가입니다. 아래 설교 영상의 자막 내용을 바탕으로 교인들이 읽기 좋은 설교 요약을 작성해주세요.

## 설교 정보
- 제목: ${sermon.title}
- 날짜: ${sermon.publishedAt}

## 요약 형식
1. **말씀 본문** (성경 구절)
2. **핵심 메시지** (2~3문장)
3. **주요 내용** (3~5개 항목으로 정리)
4. **삶에 적용** (1~2문장)

## 자막 내용
${captions.slice(0, 15000)}

위 내용을 바탕으로 설교 요약을 작성해주세요. 한국어로 작성하고, 경어체를 사용하세요.`;

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
