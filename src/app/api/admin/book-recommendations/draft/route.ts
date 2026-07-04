import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { callGeminiWithFallback, GeminiUnavailableError } from "@/lib/gemini";
import type {
  BookRecommendationDraft,
  BookSourceData,
} from "@/types/book-recommendation";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const BookSchema = z.object({
  sourceUrl: z.string().trim().url(),
  provider: z.literal("yes24"),
  productId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  publisher: z.string().trim().min(1),
  publishedDate: z.string().trim().optional(),
  isbn13: z.string().trim().optional(),
  isbn10: z.string().trim().optional(),
  pageInfo: z.string().trim().optional(),
  categoryPath: z.array(z.string()).default([]),
  coverImageUrl: z.string().trim().url().optional(),
  description: z.string().trim().optional(),
  tableOfContents: z.string().trim().optional(),
  authorBio: z.string().trim().optional(),
  publisherReview: z.string().trim().optional(),
  quotes: z.array(z.string()).optional(),
});

const RequestSchema = z.object({
  book: BookSchema,
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "도서 정보가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const book = parsed.data.book;
    const prompt = buildDraftPrompt(book);
    const resultText = await callGeminiWithFallback(prompt);
    const draft = normalizeDraft(parseJson(resultText), book);

    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("book-recommendations/draft error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "추천도서 초안을 만들지 못했습니다." },
      { status: 500 },
    );
  }
}

function buildDraftPrompt(book: BookSourceData): string {
  return `당신은 한국 교회 공지와 독서 추천문을 작성하는 편집자입니다.
아래 도서 정보를 바탕으로 성도들이 읽기 좋은 추천도서 공지 초안과 포스터 제작 정보를 만드세요.

[도서 정보]
- 제목: ${book.title}
- 저자: ${book.author}
- 출판사: ${book.publisher}
- 출간일: ${book.publishedDate || "미상"}
- 쪽수/크기: ${book.pageInfo || "미상"}
- 분류: ${book.categoryPath.join(" > ") || "미상"}
- 원문 링크: ${book.sourceUrl}

[책소개]
${book.description || "없음"}

[목차]
${book.tableOfContents || "없음"}

[저자 소개]
${book.authorBio || "없음"}

[출판사 리뷰]
${book.publisherReview || "없음"}

[작성 기준]
1. YES24/출판사 원문을 길게 복사하지 말고, 교회 성도 대상의 자연스러운 요약으로 다시 쓰세요.
2. 책 구매를 강요하지 말고 "함께 읽어 보기를 권합니다" 정도의 부드러운 문체를 사용하세요.
3. 공지 본문은 Markdown으로 작성하세요.
4. 포스터 제목은 짧고 명확해야 합니다.
5. 추천 포인트 3개와 묵상/나눔 질문 3개를 만드세요.
6. 이미지 콘셉트는 실제 책 표지를 복제하지 않는 상징적 배경 설명이어야 합니다.
7. 포스터 제목, 부제, 이미지 콘셉트에는 ISBN 또는 ISBN 번호를 절대 포함하지 마세요.
8. 출력은 아래 JSON 형식만 사용하세요. 마크다운 코드블록으로 감싸지 마세요.

{
  "noticeTitle": "공지사항 제목",
  "noticeContent": "Markdown 본문",
  "posterTitle": "포스터 제목",
  "posterSubtitle": "포스터 부제",
  "recommendationPoints": ["추천 포인트 1", "추천 포인트 2", "추천 포인트 3"],
  "discussionQuestions": ["질문 1", "질문 2", "질문 3"],
  "imageConcept": "AI 배경 이미지 생성 콘셉트"
}`;
}

function parseJson(raw: string): Record<string, unknown> {
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    text = text.slice(first, last + 1);
  }

  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI 응답 JSON 형식이 올바르지 않습니다.");
  }
  return parsed as Record<string, unknown>;
}

function normalizeDraft(data: Record<string, unknown>, book: BookSourceData): BookRecommendationDraft {
  const recommendationPoints = stringArray(data.recommendationPoints).slice(0, 5);
  const discussionQuestions = stringArray(data.discussionQuestions).slice(0, 5);
  const posterTitle = stripIsbnText(stringValue(data.posterTitle)) || `추천도서: ${book.title}`;
  const posterSubtitle =
    stripIsbnText(stringValue(data.posterSubtitle)) || `${book.author} 저 · ${book.publisher}`;

  return {
    noticeTitle: stringValue(data.noticeTitle) || `추천도서 | ${book.title}`,
    noticeContent: stringValue(data.noticeContent) || fallbackNotice(book),
    posterTitle,
    posterSubtitle,
    recommendationPoints:
      recommendationPoints.length > 0
        ? recommendationPoints
        : ["하나님의 신실하심을 깊이 묵상하게 합니다."],
    discussionQuestions:
      discussionQuestions.length > 0
        ? discussionQuestions
        : ["지금 내가 붙들고 기다리는 하나님의 약속은 무엇인가요?"],
    imageConcept:
      stringValue(data.imageConcept) ||
      "A warm Korean church book recommendation poster background with an open Bible, soft morning light, calm ivory and deep navy tones, no people, no text.",
    posterPromptInput: {
      category: "notice",
      title: posterTitle,
      schedules: [],
      location: undefined,
      audience: "명성비전교회 추천도서",
      extraLines: [
        `${book.author} 저`,
        book.publisher,
      ].filter(Boolean),
      colorPalette: "navyIvory",
      artStyle: "paperCut",
      mood: "sereneReverent",
      motifs: ["openBible", "raysOfLight"],
      peopleHandling: "none",
      peopleCount: undefined,
      moodKeywords: stringValue(data.imageConcept) || undefined,
      ratio: "a4",
      includeText: false,
    },
  };
}

function stripIsbnText(text: string): string {
  return text
    .replace(/\s*[·,|/-]?\s*ISBN(?:10|13)?\s*[:：]?\s*[0-9Xx-]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fallbackNotice(book: BookSourceData): string {
  return `## 추천도서: ${book.title}

이번 추천도서는 ${book.author}의 『${book.title}』입니다.

${book.description || "함께 읽으며 믿음의 여정을 돌아볼 수 있는 책입니다."}

도서 정보: ${book.author} 저, ${book.publisher}${book.isbn13 ? `, ISBN ${book.isbn13}` : ""}
도서 링크: ${book.sourceUrl}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}
