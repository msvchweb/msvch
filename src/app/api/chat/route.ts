import { NextRequest, NextResponse } from "next/server";
import { GeminiUnavailableError } from "@/lib/gemini";

export const maxDuration = 30;

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

const SYSTEM_PROMPT = `당신은 명성비전교회 안내 챗봇입니다. 교회를 방문하려는 분들과 교인들의 질문에 친절하고 따뜻하게 답변해주세요.

교회 기본 정보:
- 이름: 명성비전교회
- 웹사이트: https://msvch.vercel.app
- 주일예배: 오전 11시
- 수요예배: 오후 7시 30분
- 교육부서: 영아부, 유치부, 초등부, 중등부, 고등부, 청년부

안내 지침:
- 모르는 정보는 솔직하게 모른다고 하고, 직접 문의를 권유하세요
- 전화나 방문 문의는 챗봇 하단의 "문의 남기기" 버튼을 안내하세요
- 따뜻하고 친근한 말투로 답변하세요
- 답변은 간결하게, 2~4문장 이내로 해주세요
- 마크다운 문법(**, ##, - 등) 사용 금지`;

async function callGeminiChat(
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
          }),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }

      const status = res.status;
      if (![429, 500, 502, 503, 504].includes(status)) {
        throw new Error(`Gemini API 오류: ${status}`);
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw new GeminiUnavailableError("AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.");
}

export async function POST(request: NextRequest) {
  let body: { messages: ChatMessage[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "메시지가 없습니다." }, { status: 400 });
  }

  try {
    const reply = await callGeminiChat(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat API error:", err);
    const status = err instanceof GeminiUnavailableError ? 503 : 500;
    const message =
      status === 503
        ? "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요."
        : "답변을 생성하는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status });
  }
}
