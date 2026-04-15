import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const STATIC_KNOWLEDGE = `
[교회 기본 정보]
이름: 명성비전교회
주소: 서울시 동작구 사당로 16바길 9 (사당4동 주민센터 옆)
전화: 02-534-0691
이메일: info@msvch.org
웹사이트: https://msvch.vercel.app
인스타그램: @msvch_main

[오시는 길]
지하철: 4호선 사당역 또는 7호선 남성역
버스: 사당4동 주민센터 정류장 하차

[예배 시간]
새벽예배: 월~금 오전 6시, 토 오전 6시 30분 (본당)
주일예배 1부: 매주 일요일 오전 8시 (본당)
주일예배 2부: 매주 일요일 오전 10시 (본당)
주일예배 3부: 매주 일요일 낮 12시 (본당)
수요예배: 매주 수요일 오후 7시 30분 (본당)
금요기도회: 매주 금요일 오후 8시 30분 (본당)

[교회학교 예배]
영유치부: 매주 일요일 낮 12시 (본관 1층)
아동부: 매주 일요일 오전 10시 (교육관 2층)
청소년부: 매주 일요일 낮 12시 (교육관 3층 갈릴리홀)
청년부: 매월 첫째 주일 오후 2시 30분 (본관 2층)

[섬기는 분들]
담임목사: 이양재
목사 (목장/소그룹): 우 영
전도사 (기획/청년): 이준영
전도사 (행정/미디어/청소년): 최희성
전도사 (아동부): 임한나
교육사 (영유치부): 박가람
`.trim();

async function fetchRecentNotices(): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("notices")
      .select("title, content, date, category")
      .eq("is_public", true)
      .order("date", { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return "";

    const lines = data.map(
      (n) => `- [${n.date}] (${n.category}) ${n.title}: ${(n.content as string)?.slice(0, 100) ?? ""}${(n.content as string)?.length > 100 ? "..." : ""}`
    );
    return "\n[최근 공지사항]\n" + lines.join("\n");
  } catch {
    return "";
  }
}

function buildSystemPrompt(notices: string): string {
  return `당신은 명성비전교회 안내 챗봇입니다. 교회를 방문하려는 분들과 교인들의 질문에 친절하고 따뜻하게 답변해주세요.

아래는 교회의 실제 정보입니다. 이 내용을 바탕으로 정확하게 안내해주세요.

${STATIC_KNOWLEDGE}${notices}

[안내 지침]
- 위에 없는 정보는 솔직하게 모른다고 하고, 직접 전화(02-534-0691) 또는 "문의 남기기"를 권유하세요
- 따뜻하고 친근한 말투로 답변하세요
- 답변은 간결하게 2~4문장 이내로 해주세요
- 마크다운 문법(**, ##, - 등) 사용 금지`;
}

async function callGeminiChat(
  messages: ChatMessage[],
  systemPrompt: string
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
            systemInstruction: { parts: [{ text: systemPrompt }] },
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

  const notices = await fetchRecentNotices();
  const systemPrompt = buildSystemPrompt(notices);

  try {
    const reply = await callGeminiChat(messages, systemPrompt);
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
