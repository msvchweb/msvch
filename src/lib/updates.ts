import { readFile } from "node:fs/promises";
import path from "node:path";

export interface UpdateEntry {
  /** ISO date (YYYY-MM-DD) — KST 의미 */
  date: string;
  title: string;
  /** 마크다운 본문(헤더 제외, 메타 주석 제거 안 함) */
  body: string;
  /** <!-- highlight --> 주석 존재 시 true */
  highlight: boolean;
  /** <!-- staff-only --> 주석 존재 시 true. 공개 API에서 제외 대상. */
  staffOnly: boolean;
}

/** "## YYYY-MM-DD — 제목" 헤더 (em-dash, en-dash, hyphen 모두 허용) */
const HEADER_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+?)\s*$/gm;

/**
 * 코드 펜스(```...```) 내부 글자를 공백으로 치환해 인덱스를 보존한 채 마스킹한다.
 * 템플릿/예시 안의 "## YYYY-MM-DD" 헤더가 진짜 항목으로 잡히지 않도록 막는 용도.
 */
function maskFencedCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
}

export function parseUpdates(markdown: string): UpdateEntry[] {
  const masked = maskFencedCode(markdown);
  const entries: UpdateEntry[] = [];
  const matches: Array<RegExpMatchArray> = [];
  for (const m of masked.matchAll(HEADER_RE)) matches.push(m);

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.index === undefined) continue;
    const start = m.index + m[0].length;
    const nextIdx = matches[i + 1]?.index;
    const end = nextIdx ?? markdown.length;
    // 본문은 마스킹 전 원본에서 자른다 — 코드블록 내용도 그대로 보존.
    const body = markdown.slice(start, end).trim();
    // 메타 주석 검출은 마스킹된 본문에서 — 템플릿 안의 예시 주석이 잘못 잡히지 않게.
    const bodyMasked = masked.slice(start, end);

    entries.push({
      date: m[1],
      title: m[2],
      body,
      highlight: /<!--\s*highlight\s*-->/i.test(bodyMasked),
      staffOnly: /<!--\s*staff-only\s*-->/i.test(bodyMasked),
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

const UPDATES_PATH = path.join(process.cwd(), "UPDATES.md");

/** RSC / Route Handler 에서 호출. 호출 측에서 revalidate 로 캐시 제어. */
export async function loadUpdates(): Promise<UpdateEntry[]> {
  try {
    const raw = await readFile(UPDATES_PATH, "utf-8");
    return parseUpdates(raw);
  } catch {
    return [];
  }
}

/** 본문에서 메타 주석(<!-- highlight -->, <!-- staff-only -->)을 제거한 표시용 텍스트 */
export function stripMetaComments(body: string): string {
  return body
    .replace(/<!--\s*highlight\s*-->/gi, "")
    .replace(/<!--\s*staff-only\s*-->/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
