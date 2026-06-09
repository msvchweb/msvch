import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // DALL-E 3 can take some time

const RequestSchema = z.object({
  prompt: z.string().min(1),
  ratio: z.enum(["1:1", "9:16", "a4"]),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const { prompt, ratio } = parsed.data;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // DALL-E 3 사이즈 매핑
    // a4 (≈1:1.41) 는 9:16 (0.56) 보다 2:3 (0.66) 에 가깝지만, DALL-E 3는 1024x1792 (9:16) 를 지원함.
    const size = ratio === "1:1" ? "1024x1024" : "1024x1792";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        quality: "hd", // 고화질
        style: "vivid", // 선명함 (natural 도 가능)
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);
      return NextResponse.json(
        { error: data.error?.message || "이미지 생성 중 오류가 발생했습니다." },
        { status: response.status }
      );
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "이미지 URL을 받지 못했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("posters/generate-image error", err);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
