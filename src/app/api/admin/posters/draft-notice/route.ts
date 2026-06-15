import { NextResponse } from "next/server";
import { callGeminiWithFallback } from "@/lib/gemini";
import { POSTER_CATEGORY_LABEL, type PromptBuilderInput } from "@/lib/poster-prompts";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as PromptBuilderInput;

    const categoryLabel = POSTER_CATEGORY_LABEL[input.category];
    const prompt = `당신은 교회 행정 및 홍보 전문가입니다. 아래 제공된 [포스터 정보]를 바탕으로 교인들이 읽기 좋은 친절하고 따뜻한 공지사항 게시글 초안을 작성해주세요.

[포스터 정보]
- 종류: ${categoryLabel}
- 제목: ${input.title}
- 일시: ${input.schedules.filter(s => s.trim()).join(", ")}
- 장소: ${input.location || "미정"}
- 대상/주관: ${input.audience || ""}
- 기타 정보: ${input.extraLines?.filter(l => l.trim()).join(", ") || ""}

[작성 요구사항]
1. 제목: 공지사항 목록에 노출될 클릭하고 싶은 매력적인 제목을 한 줄로 작성하세요. (포스터 제목 포함)
2. 본문: 
   - 첫 인사는 정중하고 따뜻하게 작성하세요.
   - 행사 내용을 풍부하게 설명하되, 가독성을 위해 항목별로 구분(불렛 포인트 등)하여 명확하게 작성하세요.
   - 마지막은 교인들의 참여를 독려하는 따뜻한 멘트로 마무리하세요.
3. 카테고리: '일반', '긴급', '행사' 중 가장 적절한 하나를 선택하세요 (대부분 '행사'일 것입니다).
4. 출력 형식: 반드시 아래의 JSON 형식으로만 답변하세요. 마크다운 코드 블록(json)으로 감싸지 마세요.

{
  "title": "공지사항 제목",
  "content": "마크다운 형식이 포함된 공지사항 본문",
  "category": "행사"
}

이제 JSON 결과만 출력하세요.`;

    const resultText = await callGeminiWithFallback(prompt);
    
    // JSON 파싱 시도 (AI가 간혹 마크다운 블록으로 감싸는 경우 대비)
    let jsonStr = resultText.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/```json|```/g, "").trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```/g, "").trim();
    }

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Draft Notice Error:", error);
    return NextResponse.json(
      { error: "공지사항 초안 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
