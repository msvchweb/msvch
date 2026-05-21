/**
 * HWPX(.hwpx) 파서 — 한컴 2010+ 의 OWPML 표준(ZIP + XML).
 *
 * 외부 의존성 2개:
 *   - adm-zip       : ZIP 해제 (스트리밍 + path traversal 방어)
 *   - fast-xml-parser : section XML 트리화
 *
 * 결과는 두 종류:
 *   - tables[]     : 표 노드 (행렬 셀 텍스트). worship_items / offerings / dawn 등 추출의 기반.
 *   - paragraphs[] : 평문 문단 (순서 보존). 교회소식 / 정기모임 등 자유 텍스트의 기반.
 *
 * 본 모듈은 HWPX 의 텍스트만 다룬다. 이미지·도형·BinData 는 무시.
 */

import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";

/** 표 한 셀의 평문 텍스트 */
export interface HwpxCell {
  text: string;
}

/** 표 노드 — 행렬 평탄화 */
export interface HwpxTable {
  /** 어느 section 에서 나왔는지 (0-based) */
  sectionIndex: number;
  /** 행 수 */
  rowCount: number;
  /** 열 수 (최대) */
  colCount: number;
  /** rows[r][c] = 셀 평문 */
  rows: HwpxCell[][];
}

/** 평문 문단 노드 */
export interface HwpxParagraph {
  sectionIndex: number;
  /** 0-based — 같은 section 내 순서 */
  order: number;
  text: string;
}

export interface HwpxRawDoc {
  /** 표 노드 (등장 순서) */
  tables: HwpxTable[];
  /** 평문 문단 (등장 순서) */
  paragraphs: HwpxParagraph[];
  /** 디버깅용 — 전체 텍스트(표 포함 평탄화)의 처음 10K 자 */
  rawTextExcerpt: string;
}

/** XML 파싱 결과 트리 — fast-xml-parser 가 반환하는 구조 */
interface XmlNode {
  [key: string]: XmlValue;
}
type XmlValue = string | number | boolean | XmlNode | XmlValue[];

/** ZIP 매직 바이트 — Phase 1 가드 */
export function isZipMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/** zip 안의 path traversal 방어 — entryName 에 ".." 가 있으면 거부 */
function isSafeEntryName(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.includes("..")) return false;
  if (normalized.startsWith("/")) return false;
  return true;
}

/**
 * fast-xml-parser 결과에서 임의 깊이 노드를 평탄히 순회하며 콜백 호출.
 * - 객체이면서 callback 이 false 를 반환하면 자식 순회 중단.
 */
function walkXml(
  node: XmlValue,
  visit: (tagName: string, node: XmlNode) => boolean | void,
): void {
  if (node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walkXml(child, visit);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    // 속성 노드는 ":@" 키로 묶임 (fast-xml-parser 의 preserveOrder=false 옵션 기본). 건너뜀.
    if (key === ":@" || key === "#text") continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const cont = visit(key, value);
      if (cont !== false) walkXml(value, visit);
    } else if (Array.isArray(value)) {
      for (const child of value) {
        if (typeof child === "object" && child !== null && !Array.isArray(child)) {
          const cont = visit(key, child);
          if (cont !== false) walkXml(child, visit);
        } else if (Array.isArray(child)) {
          walkXml(child, visit);
        }
      }
    }
  }
}

/** 어떤 노드의 모든 텍스트(#text)를 깊이 우선으로 모아 한 문자열로 */
function collectText(node: XmlValue): string {
  if (node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) {
    return node.map((c) => collectText(c)).join("");
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === ":@") continue;
    if (key === "#text") {
      if (typeof value === "string") parts.push(value);
      else if (typeof value === "number") parts.push(String(value));
      else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === "string") parts.push(v);
          else if (typeof v === "number") parts.push(String(v));
        }
      }
      continue;
    }
    parts.push(collectText(value));
  }
  return parts.join("");
}

/**
 * HWPX section XML 한 개에서 표/문단을 추출.
 *
 * OWPML 의 표 마크업은 namespace 가 붙는다(`hp:tbl`, `hp:tr`, `hp:tc`, `hp:cell` 등).
 * fast-xml-parser 가 namespace 를 키에 그대로 포함하므로 endsWith(":tbl") 형태로 매칭.
 */
function parseSectionXml(
  xml: string,
  sectionIndex: number,
): { tables: HwpxTable[]; paragraphs: HwpxParagraph[] } {
  const parser = new XMLParser({
    ignoreAttributes: true,
    preserveOrder: false,
    trimValues: true,
    parseTagValue: false,
    isArray: () => false,
  });
  const tree = parser.parse(xml) as XmlNode;

  const tables: HwpxTable[] = [];
  const paragraphs: HwpxParagraph[] = [];
  let paragraphOrder = 0;
  /** 현재 표 내부 깊이 — 표 안에서 발견되는 p 노드는 외부 paragraphs 에 넣지 않는다. */
  let tableDepth = 0;

  function visitTable(node: XmlNode): void {
    tableDepth += 1;
    // tr 들을 수집
    const rows: HwpxCell[][] = [];
    walkXml(node, (tagName, child) => {
      if (tagName.endsWith(":tr") || tagName === "tr") {
        const cells: HwpxCell[] = [];
        walkXml(child, (cellTag, cellNode) => {
          if (cellTag.endsWith(":tc") || cellTag === "tc") {
            const text = collectText(cellNode).trim();
            cells.push({ text });
            return false; // 셀 내부는 더 파고들지 않음
          }
          return true;
        });
        if (cells.length > 0) rows.push(cells);
        return false; // 행 내부 탐색을 walkXml 자식 루프로 더 진행하지 않음
      }
      return true;
    });

    if (rows.length > 0) {
      const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
      tables.push({
        sectionIndex,
        rowCount: rows.length,
        colCount,
        rows,
      });
    }
    tableDepth -= 1;
  }

  walkXml(tree, (tagName, node) => {
    if (tagName.endsWith(":tbl") || tagName === "tbl") {
      visitTable(node);
      return false; // 표 내부는 visitTable 가 직접 처리
    }
    if (tableDepth === 0 && (tagName.endsWith(":p") || tagName === "p")) {
      const text = collectText(node).trim();
      if (text.length > 0) {
        paragraphs.push({
          sectionIndex,
          order: paragraphOrder++,
          text,
        });
      }
      return false; // p 내부 텍스트는 이미 모음
    }
    return true;
  });

  return { tables, paragraphs };
}

/**
 * 입력 버퍼가 유효한 HWPX 인지 검사하고, 본문(section*.xml) 들을 추출해 표/문단으로 변환한다.
 * 본문 없음/매직 불일치/zip bomb 의심 시 throw.
 */
export function parseHwpxBuffer(buffer: Buffer): HwpxRawDoc {
  if (!isZipMagic(buffer)) {
    throw new Error("HWPX 형식이 아닙니다 (ZIP 매직 불일치).");
  }
  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error("파일이 너무 큽니다 (25MB 초과).");
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // HWPX 본문은 "Contents/section0.xml", "Contents/section1.xml" ... 형태
  const sectionEntries = entries
    .filter((e) => {
      const name = e.entryName.replace(/\\/g, "/");
      return (
        isSafeEntryName(name) &&
        /^Contents\/section\d+\.xml$/i.test(name)
      );
    })
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  if (sectionEntries.length === 0) {
    throw new Error("HWPX 본문(section*.xml)을 찾지 못했습니다.");
  }

  const allTables: HwpxTable[] = [];
  const allParagraphs: HwpxParagraph[] = [];
  let combinedText = "";

  sectionEntries.forEach((entry, idx) => {
    const xml = entry.getData().toString("utf8");
    const { tables, paragraphs } = parseSectionXml(xml, idx);
    allTables.push(...tables);
    allParagraphs.push(...paragraphs);

    if (combinedText.length < 10_000) {
      combinedText +=
        paragraphs.map((p) => p.text).join("\n") +
        "\n" +
        tables
          .map((t) => t.rows.map((r) => r.map((c) => c.text).join(" | ")).join("\n"))
          .join("\n\n") +
        "\n\n";
    }
  });

  return {
    tables: allTables,
    paragraphs: allParagraphs,
    rawTextExcerpt: combinedText.slice(0, 10_000),
  };
}
