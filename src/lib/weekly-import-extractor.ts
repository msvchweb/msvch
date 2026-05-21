/**
 * HwpxRawDoc → WeeklyImportResult 변환기.
 *
 * 두 단계로 동작:
 *   1) 휴리스틱 표 매핑 (날짜·예배순서·헌금·새벽·안내위원·다음주기도) — 결정적, confidence ≥ 0.9
 *   2) Gemini 자유 텍스트 구조화 (교회소식·정기모임·새가족·설교제목·설교자) — 모델 응답 confidence
 *
 * 마스터(올해 표어 등)와 다른 값을 발견하면 warnings 에 추가만 한다 (Q3=B — DB 변경 X).
 */

import { z } from "zod";
import { callGeminiWithFallback, GeminiUnavailableError } from "@/lib/gemini";
import { loadBulletinMaster } from "@/lib/bulletin-master";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  emptyWorshipItems,
  emptyOfferings,
  emptyGuideCommittee,
  buildDawnReadings,
  OFFERING_CATEGORIES,
  WORSHIP_ITEMS_TEMPLATE,
  DAWN_WEEKDAY_LABELS,
  GUIDE_COMMITTEE_PARTS,
  NEXT_WEEK_PRAYER_PARTS,
} from "@/components/weekly/form/constants";
import type { HwpxRawDoc, HwpxTable } from "@/lib/hwpx-parser";
import type {
  WeeklyImportResult,
  ImportField,
} from "@/types/weekly-import";
import type {
  WorshipItemRow,
  OfferingCategoryRow,
  DawnReading,
  GuideCommitteeRow,
  NewsItem,
  MeetingRow,
  NewMemberRow,
} from "@/types/notice";

export { GeminiUnavailableError };

/** 최종 응답 — 자유 텍스트 Gemini 단계 결과 스키마 */
const FreeFormSchema = z.object({
  news: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        items: z.array(z.string().min(1).max(500)).max(10),
      }),
    )
    .max(20)
    .optional(),
  meetings: z
    .array(
      z.object({
        group: z.string().min(1).max(100),
        when: z.string().min(1).max(100),
        place: z.string().max(100),
      }),
    )
    .max(20)
    .optional(),
  newFamily: z
    .array(
      z.object({
        no: z.string().max(20),
        regNo: z.string().max(20),
        name: z.string().min(1).max(50),
        inviter: z.string().max(50),
        dept: z.string().max(50),
      }),
    )
    .max(30)
    .optional(),
  sermonTitle: z.string().max(200).optional(),
  sermonPastor: z.string().max(50).optional(),
  /** 모델의 자기평가 신뢰도 (0~1) — 결정적 표 매핑과 별개 */
  confidence: z.number().min(0).max(1),
});

type FreeFormResult = z.infer<typeof FreeFormSchema>;

// ─────────────────────────────────────────────────────────────
// 1. 휴리스틱 표 매핑
// ─────────────────────────────────────────────────────────────

/** "2026년 5월 24일 (주일)" 등에서 YYYY-MM-DD 추출 */
function extractDateFromText(text: string): string | null {
  const m = text.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tryDate(doc: HwpxRawDoc): ImportField<string> | undefined {
  // 표 셀에서 먼저, 없으면 문단에서
  for (const tbl of doc.tables) {
    for (const row of tbl.rows) {
      for (const cell of row) {
        const d = extractDateFromText(cell.text);
        if (d) return { value: d, confidence: 0.95 };
      }
    }
  }
  for (const p of doc.paragraphs) {
    const d = extractDateFromText(p.text);
    if (d) return { value: d, confidence: 0.9 };
  }
  return undefined;
}

/**
 * 16행 표 후보 → worship_items 매핑.
 * 한 행이 `[marker, label, content, ...assignees]` 형태라고 가정 (가장 흔한 한컴 템플릿).
 * 정확히 일치 안 해도 label 매칭으로 보정.
 */
function tryWorshipItems(doc: HwpxRawDoc): ImportField<WorshipItemRow[]> | undefined {
  const labelHits = (tbl: HwpxTable): number => {
    let hit = 0;
    for (const row of tbl.rows) {
      const cells = row.map((c) => c.text.replace(/\s+/g, ""));
      for (const tpl of WORSHIP_ITEMS_TEMPLATE) {
        const target = tpl.label.replace(/\s+/g, "");
        if (cells.some((c) => c === target)) {
          hit += 1;
          break;
        }
      }
    }
    return hit;
  };

  // worship_items 라벨 매칭 수가 가장 많은 표 선택
  let best: { tbl: HwpxTable; hits: number } | null = null;
  for (const tbl of doc.tables) {
    if (tbl.rowCount < 8 || tbl.rowCount > 30) continue;
    const hits = labelHits(tbl);
    if (hits >= 8 && (!best || hits > best.hits)) {
      best = { tbl, hits };
    }
  }
  if (!best) return undefined;

  const result = emptyWorshipItems();
  let filled = 0;
  for (const row of best.tbl.rows) {
    const cells = row.map((c) => c.text.trim());
    // 행에서 라벨 셀 위치 찾기
    const idxByLabel = WORSHIP_ITEMS_TEMPLATE.findIndex((tpl) => {
      const target = tpl.label.replace(/\s+/g, "");
      return cells.some((c) => c.replace(/\s+/g, "") === target);
    });
    if (idxByLabel < 0) continue;

    const labelCellIdx = cells.findIndex(
      (c) => c.replace(/\s+/g, "") === WORSHIP_ITEMS_TEMPLATE[idxByLabel].label.replace(/\s+/g, ""),
    );
    // 라벨 오른쪽 셀들 = content + assignees
    const right = cells.slice(labelCellIdx + 1).filter((c) => c.length > 0);
    if (right.length === 0) continue;

    const slot = result[idxByLabel];
    // 첫 비-빈 셀 = content (단, 기존 템플릿 기본값이 비어있을 때만 덮어쓰지 말고, 항상 덮어쓰기 — HWP 가 진실)
    slot.content = right[0] ?? slot.content;
    // 나머지 = assignees (템플릿 슬롯 수만큼)
    const restAssignees = right.slice(1);
    for (let i = 0; i < slot.assignees.length && i < restAssignees.length; i++) {
      slot.assignees[i] = restAssignees[i];
    }
    filled += 1;
  }

  if (filled < 8) return undefined;
  const confidence = Math.min(0.95, 0.6 + (filled / WORSHIP_ITEMS_TEMPLATE.length) * 0.35);
  return { value: result, confidence };
}

/** 헌금 명세 10항목 표 → offerings */
function tryOfferings(doc: HwpxRawDoc): ImportField<OfferingCategoryRow[]> | undefined {
  let best: { tbl: HwpxTable; hits: number } | null = null;
  for (const tbl of doc.tables) {
    if (tbl.rowCount < 6) continue;
    let hits = 0;
    for (const row of tbl.rows) {
      const flat = row.map((c) => c.text.replace(/\s+/g, "")).join("|");
      for (const label of OFFERING_CATEGORIES) {
        if (flat.includes(label)) {
          hits += 1;
          break;
        }
      }
    }
    if (hits >= 6 && (!best || hits > best.hits)) best = { tbl, hits };
  }
  if (!best) return undefined;

  const result = emptyOfferings();
  let filled = 0;
  for (const row of best.tbl.rows) {
    const cells = row.map((c) => c.text.trim());
    const labelIdx = cells.findIndex((c) =>
      (OFFERING_CATEGORIES as readonly string[]).includes(c),
    );
    if (labelIdx < 0) continue;
    const slot = result.findIndex((o) => o.label === cells[labelIdx]);
    if (slot < 0) continue;
    const right = cells.slice(labelIdx + 1).filter((c) => c.length > 0);
    if (right.length === 0) continue;
    result[slot].names = right.join(" ");
    filled += 1;
  }
  if (filled < 5) return undefined;
  return { value: result, confidence: Math.min(0.95, 0.6 + (filled / 10) * 0.35) };
}

/** 새벽예배 6행 표 → dawn_readings */
function tryDawnReadings(
  doc: HwpxRawDoc,
  weeklyDate: string | undefined,
): ImportField<DawnReading[]> | undefined {
  for (const tbl of doc.tables) {
    if (tbl.rowCount < 6) continue;
    // 행 라벨에 월·화·수·목·금·토 가 보이는지
    let dayHits = 0;
    for (const row of tbl.rows) {
      const flat = row.map((c) => c.text).join(" ");
      for (const day of DAWN_WEEKDAY_LABELS) {
        if (flat.includes(day)) {
          dayHits += 1;
          break;
        }
      }
    }
    if (dayHits < 5) continue;

    const result = buildDawnReadings(weeklyDate, undefined);
    let filled = 0;
    for (const row of tbl.rows) {
      const cells = row.map((c) => c.text.trim());
      const dayIdx = DAWN_WEEKDAY_LABELS.findIndex((day) =>
        cells.some((c) => c.includes(day)),
      );
      if (dayIdx < 0) continue;
      // 같은 행의 다른 셀 중 가장 긴 것 = passage
      const sorted = cells.filter((c) => c.length > 0).sort((a, b) => b.length - a.length);
      const passage = sorted[0] && sorted[0].includes(DAWN_WEEKDAY_LABELS[dayIdx])
        ? sorted[1] ?? ""
        : sorted[0] ?? "";
      if (passage && !passage.includes(DAWN_WEEKDAY_LABELS[dayIdx])) {
        result[dayIdx].passage = passage;
        filled += 1;
      }
    }
    if (filled >= 4) {
      return { value: result, confidence: Math.min(0.95, 0.6 + (filled / 6) * 0.35) };
    }
  }
  return undefined;
}

/** 안내위원 3행 표 → guide_committee */
function tryGuideCommittee(doc: HwpxRawDoc): ImportField<GuideCommitteeRow[]> | undefined {
  for (const tbl of doc.tables) {
    if (tbl.rowCount < 3) continue;
    let partHits = 0;
    for (const row of tbl.rows) {
      const flat = row.map((c) => c.text).join(" ");
      for (const part of GUIDE_COMMITTEE_PARTS) {
        if (flat.includes(part)) partHits += 1;
      }
    }
    if (partHits < 3) continue;

    const result = emptyGuideCommittee();
    let filled = 0;
    for (const row of tbl.rows) {
      const cells = row.map((c) => c.text.trim());
      const partIdx = GUIDE_COMMITTEE_PARTS.findIndex((p) =>
        cells.some((c) => c.includes(p) && c.length <= 6),
      );
      if (partIdx < 0) continue;
      const others = cells.filter(
        (c) => c.length > 0 && !GUIDE_COMMITTEE_PARTS.some((p) => c.includes(p) && c.length <= 6),
      );
      result[partIdx].indoor = others[0] ?? "";
      result[partIdx].outdoor = others[1] ?? "";
      filled += 1;
    }
    if (filled === GUIDE_COMMITTEE_PARTS.length) {
      return { value: result, confidence: 0.9 };
    }
  }
  return undefined;
}

/** 다음주 기도 3칸 → next_week_prayer */
function tryNextWeekPrayer(doc: HwpxRawDoc): ImportField<string[]> | undefined {
  // 표 안에서 "다음주 기도" 또는 "다음 주 기도" 헤더가 있는 인접 셀들
  for (const tbl of doc.tables) {
    for (const row of tbl.rows) {
      const flat = row.map((c) => c.text).join(" ");
      if (
        !flat.includes("다음주 기도") &&
        !flat.includes("다음 주 기도") &&
        !flat.includes("다음주기도제목")
      ) {
        continue;
      }
      const others = row
        .map((c) => c.text.trim())
        .filter((c) => c.length > 0 && !c.includes("기도"));
      if (others.length >= 3) {
        return {
          value: [others[0], others[1], others[2]],
          confidence: 0.75,
        };
      }
    }
  }
  // 문단 기반 — "1부 ... 2부 ... 3부 ..." 같은 줄
  for (const p of doc.paragraphs) {
    if (!p.text.includes("1부") || !p.text.includes("2부")) continue;
    const parts = NEXT_WEEK_PRAYER_PARTS.map((label) => {
      const re = new RegExp(`${label}\\s*[:：]?\\s*([^\\n0-9부]+)`);
      const m = p.text.match(re);
      return m ? m[1].trim() : "";
    });
    if (parts.filter(Boolean).length >= 2) {
      return { value: parts, confidence: 0.7 };
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// 2. 자유 텍스트 — Gemini 구조화
// ─────────────────────────────────────────────────────────────

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function buildFreeFormPrompt(doc: HwpxRawDoc, anchorDate: string | undefined): string {
  const corpus = [
    ...doc.paragraphs.map((p) => p.text),
    ...doc.tables.flatMap((t) =>
      t.rows.map((r) => r.map((c) => c.text).join(" | ")),
    ),
  ]
    .filter((line) => line && line.length > 0)
    .join("\n")
    .slice(0, 12_000);

  return `당신은 한국 개신교 교회 주보의 본문에서 자유 텍스트 영역을 구조화 데이터로 변환하는 전문가입니다.

[주보 본문 일부]
${corpus}

[기준일]
${anchorDate ?? "(미상)"}

[추출 규칙]
1. "교회소식" 영역의 각 항목 → news. title 은 짧은 헤드라인, items 는 세부 안내 줄들.
2. "정기모임" / "주중 모임" 영역의 각 모임 → meetings. when 은 시간 표현 원문, place 는 장소.
3. "새가족" 박스의 명단 → newFamily. 표 형식이면 그대로, 자유 텍스트면 추측 X.
4. "설교 제목" 과 "설교자" → sermonTitle / sermonPastor. 불분명하면 비워두세요.
5. 본문에 없는 정보는 만들지 마세요. 모르면 항목 자체를 생략.
6. confidence: 본문에서 명확히 읽혔으면 0.9 이상, 추측 섞였으면 0.5~0.7, 거의 추측이면 < 0.5.

JSON 만 응답하세요. 추가 설명 X.

{
  "news": [{ "title": "...", "items": ["..."] }],
  "meetings": [{ "group": "...", "when": "...", "place": "..." }],
  "newFamily": [{ "no": "", "regNo": "", "name": "...", "inviter": "...", "dept": "..." }],
  "sermonTitle": "...",
  "sermonPastor": "...",
  "confidence": 0.0
}`;
}

async function extractFreeForm(
  doc: HwpxRawDoc,
  anchorDate: string | undefined,
): Promise<FreeFormResult | null> {
  const prompt = buildFreeFormPrompt(doc, anchorDate);
  let raw: string;
  try {
    raw = await callGeminiWithFallback(prompt);
  } catch (err) {
    if (err instanceof GeminiUnavailableError) return null;
    throw err;
  }

  const stripped = stripCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  const result = FreeFormSchema.safeParse(parsed);
  if (!result.success) return null;
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// 3. 마스터 불일치 검사 (Q3=B)
// ─────────────────────────────────────────────────────────────

async function checkAgainstMaster(doc: HwpxRawDoc): Promise<string[]> {
  const warnings: string[] = [];
  try {
    const supabase = await createServerSupabase();
    const master = await loadBulletinMaster(supabase);
    const topic = master.topicOfYear ?? "";

    if (topic) {
      const corpus = [
        ...doc.paragraphs.map((p) => p.text),
        ...doc.tables.flatMap((t) =>
          t.rows.flatMap((r) => r.map((c) => c.text)),
        ),
      ].join(" ");
      // HWPX 본문 안에 "표어:" 또는 "올해의 표어" 다음 텍스트와 DB 마스터를 단순 substring 비교
      const m = corpus.match(/(?:올해의?\s*표어|표어)\s*[:：]?\s*([^\n]{3,80})/);
      if (m) {
        const hwpTopic = m[1].trim().replace(/\s+/g, " ");
        const dbTopic = topic.trim().replace(/\s+/g, " ");
        if (hwpTopic && dbTopic && !hwpTopic.includes(dbTopic) && !dbTopic.includes(hwpTopic)) {
          warnings.push(
            `주보의 "올해의 표어"가 시스템 마스터와 다릅니다. DB: "${dbTopic}" / HWPX: "${hwpTopic}" (시스템 값은 유지됩니다)`,
          );
        }
      }
    }
  } catch {
    // 마스터 로드 실패는 무시 — 본 추출 흐름을 막지 않는다
  }
  return warnings;
}

// ─────────────────────────────────────────────────────────────
// 4. 최종 결합
// ─────────────────────────────────────────────────────────────

export async function extractWeeklyFromHwpx(
  doc: HwpxRawDoc,
): Promise<WeeklyImportResult> {
  const dateField = tryDate(doc);
  const warnings: string[] = [];
  const result: WeeklyImportResult = { warnings };

  if (dateField) result.date = dateField;

  const worship = tryWorshipItems(doc);
  if (worship) result.worshipItems = worship;
  else warnings.push("예배순서(16행)를 자동으로 매핑하지 못했습니다.");

  const offerings = tryOfferings(doc);
  if (offerings) result.offerings = offerings;
  else warnings.push("헌금 명세(10항목)를 자동으로 매핑하지 못했습니다.");

  const dawn = tryDawnReadings(doc, dateField?.value);
  if (dawn) result.dawnReadings = dawn;

  const guide = tryGuideCommittee(doc);
  if (guide) result.guideCommittee = guide;

  const nextPrayer = tryNextWeekPrayer(doc);
  if (nextPrayer) result.nextWeekPrayer = nextPrayer;

  // 자유 텍스트 — Gemini
  const freeForm = await extractFreeForm(doc, dateField?.value);
  if (freeForm) {
    const conf = freeForm.confidence;
    if (freeForm.news && freeForm.news.length > 0) {
      const value: NewsItem[] = freeForm.news.map((n) => ({
        title: n.title,
        items: n.items,
      }));
      result.news = { value, confidence: conf };
    }
    if (freeForm.meetings && freeForm.meetings.length > 0) {
      const value: MeetingRow[] = freeForm.meetings.map((m) => ({
        group: m.group,
        when: m.when,
        place: m.place,
      }));
      result.meetings = { value, confidence: conf };
    }
    if (freeForm.newFamily && freeForm.newFamily.length > 0) {
      const value: NewMemberRow[] = freeForm.newFamily.map((n) => ({
        no: n.no,
        regNo: n.regNo,
        name: n.name,
        inviter: n.inviter,
        dept: n.dept,
      }));
      result.newFamily = { value, confidence: conf };
    }
    if (freeForm.sermonTitle) {
      result.sermonTitle = { value: freeForm.sermonTitle, confidence: conf };
    }
    if (freeForm.sermonPastor) {
      result.sermonPastor = { value: freeForm.sermonPastor, confidence: conf };
    }
  } else {
    warnings.push("자유 텍스트(교회소식·정기모임)를 AI가 구조화하지 못했습니다.");
  }

  // 마스터 불일치 검사
  warnings.push(...(await checkAgainstMaster(doc)));

  return result;
}
