import { callGeminiWithFallback, GeminiUnavailableError } from "@/lib/gemini";
import {
  ExtractedEventSchema,
  ExtractEventsResponseSchema,
} from "@/lib/validation";
import type { NewsItem, MeetingRow } from "@/types/notice";
import type { ExtractedEvent } from "@/types/event-extraction";

export { GeminiUnavailableError };

const KOREAN_DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

interface ExtractInput {
  /** YYYY-MM-DD — weekly.date. 모든 상대 표현의 기준 */
  anchorDate: string;
  news: NewsItem[];
  meetings: MeetingRow[];
  northKoreaNote: string;
}

interface ExtractResult {
  candidates: ExtractedEvent[];
  skipped: { sourceNewsIndex: number; reason: string }[];
}

/** anchorDate 의 KST 요일 한글 (일/월/.../토) */
function dayOfWeekKo(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return KOREAN_DAYS[d.getDay()];
}

function flattenNews(news: NewsItem[]): string {
  if (news.length === 0) return "(없음)";
  return news
    .map((n, i) => {
      const items =
        n.items.length > 0
          ? "\n" + n.items.map((it) => `   - ${it}`).join("\n")
          : "";
      return `${i + 1}. ${n.title}${items}`;
    })
    .join("\n\n");
}

function flattenMeetings(meetings: MeetingRow[]): string {
  if (meetings.length === 0) return "(없음)";
  return meetings
    .map((m) => `- ${m.group}: ${m.when} @ ${m.place}`)
    .join("\n");
}

function buildPrompt(input: ExtractInput): string {
  const { anchorDate, news, meetings, northKoreaNote } = input;
  const dow = dayOfWeekKo(anchorDate);
  return `당신은 한국 개신교 교회 주보의 "교회소식" 섹션을 분석해 캘린더 일정으로 옮길 수 있는 항목을 뽑아내는 전문가입니다.

[기준 정보]
- 주보 발행일: ${anchorDate} (${dow}요일)
- "오늘", "이번 주", "주일", "다음 주" 등 상대 표현은 모두 위 발행일 기준으로 해석하세요.
- 시간대는 한국 표준시 (KST). 모든 출력 날짜는 절대 날짜 (YYYY-MM-DD).

[교회소식 원문]
${flattenNews(news)}

[모임 안내 원문]
${flattenMeetings(meetings)}
${northKoreaNote ? `\n[북한선교부 메모]\n${northKoreaNote}\n` : ""}
[추출 규칙]
1. 일자(또는 일자 후보)가 본문에 명시된 항목만 일정 후보로 추출.
   - "5/9(토) 오후 5시" → date=2026-05-09, startTime=17:00
   - "오늘 3부예배 직후" → date=발행일, startTime=null
   - "매주 화요일" → 발행일 이후 첫 화요일을 date 로, rruleHint="FREQ=WEEKLY;BYDAY=TU"
2. 일자 정보가 전혀 없는 안내(예: "교회 인터넷 홈페이지 개편 진행 중")는 절대 추출 금지 — skipped 에 사유 기록.
3. 한 항목 안에 여러 날짜가 있으면 각각 별개 후보로 분리.
4. 동일 행사의 부속 정보(준비물·문의처)는 description 에 합쳐서 작성.
5. 본문에 없는 정보를 만들어내지 마세요. 모르면 null.
6. confidence:
   - 절대 날짜 + 시간 + 장소 모두 명시 → 0.9 이상
   - 시간 또는 장소 누락 → 0.7
   - 일자 추정만 가능 → 0.5
   - 자신 없음 → 0.3 (그래도 추출은 함, UI 가 경고 표시)
7. sourceNewsIndex 는 [교회소식] 의 0-based 인덱스. 모임 안내·북한선교부 메모에서 뽑은 경우 null.
8. sourceQuote 에는 본문에서 그대로 따온 단편 (50자 이내 권장).

[출력 형식]
오직 다음 형태의 JSON 객체 하나만 출력. 마크다운 코드펜스 (\`\`\`) 절대 금지. 설명 문장 절대 금지.

{
  "candidates": [
    {
      "title": "string",
      "date": "YYYY-MM-DD or null",
      "startTime": "HH:mm or null",
      "endTime": "HH:mm or null",
      "location": "string or null",
      "description": "string or null",
      "sourceNewsIndex": 0,
      "sourceQuote": "원문 단편",
      "confidence": 0.9,
      "rruleHint": null
    }
  ],
  "skipped": [
    { "sourceNewsIndex": 4, "reason": "구체적 일자 없음" }
  ]
}`;
}

function stripCodeFence(s: string): string {
  let out = s.trim();
  out = out.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // 모델이 "Here is the JSON:" 같은 머리말을 붙이는 경우 — JSON 시작 직전까지 잘라냄
  // [^{[] 는 문자 클래스라 줄바꿈도 매칭하므로 s 플래그 불필요
  out = out.replace(/^[^{[]*?(?=[{[])/, "");
  return out.trim();
}

/**
 * 원문 sourceQuote 의 (요일) 표기와 추출된 date 의 실제 요일이 어긋나면
 * 모델이 연도를 잘못 추정한 신호 → confidence 강제 하향.
 */
function adjustConfidenceByDayOfWeek(c: ExtractedEvent): ExtractedEvent {
  if (!c.date || !c.sourceQuote) return c;
  const m = c.sourceQuote.match(/\(([일월화수목금토])\)/);
  if (!m) return c;
  const expected = m[1];
  const actual = dayOfWeekKo(c.date);
  if (expected !== actual) {
    return { ...c, confidence: Math.min(c.confidence, 0.5) };
  }
  return c;
}

/**
 * 후보 결과를 한 번 더 정합성 체크.
 * - date 가 anchor 보다 14일 이상 과거 → 의심스럽지만 거부하지 않고 confidence 만 하향.
 * - date 가 anchor + 365일 초과 → 동일하게 하향.
 */
function adjustConfidenceByDateRange(
  c: ExtractedEvent,
  anchorDate: string,
): ExtractedEvent {
  if (!c.date) return c;
  const anchor = new Date(anchorDate + "T00:00:00+09:00").getTime();
  const target = new Date(c.date + "T00:00:00+09:00").getTime();
  const days = (target - anchor) / 86400000;
  if (days < -14 || days > 365) {
    return { ...c, confidence: Math.min(c.confidence, 0.4) };
  }
  return c;
}

/**
 * 주보의 news/meetings 를 Gemini 에 보내 일정 후보를 추출.
 *
 * @throws GeminiUnavailableError  AI 서버 일시 장애 (라우트가 503 매핑)
 * @throws z.ZodError              Gemini 응답이 스키마를 위반
 * @throws Error                   JSON 파싱 실패
 */
export async function extractEventsFromNews(
  input: ExtractInput,
): Promise<ExtractResult> {
  const prompt = buildPrompt(input);
  const raw = await callGeminiWithFallback(prompt);
  const cleaned = stripCodeFence(raw);

  // JSON.parse → Zod 까지 inline 으로 처리해 unknown/any 변수 선언 회피
  const validated = (() => {
    try {
      return ExtractEventsResponseSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error("Gemini 응답이 JSON 형식이 아닙니다.");
      }
      throw e;
    }
  })();

  const candidates = validated.candidates
    .map((c) => ExtractedEventSchema.parse(c))
    .map((c) => adjustConfidenceByDayOfWeek(c))
    .map((c) => adjustConfidenceByDateRange(c, input.anchorDate));

  return {
    candidates,
    skipped: validated.skipped,
  };
}
