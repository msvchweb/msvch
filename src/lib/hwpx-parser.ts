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

// ─────────────────────────────────────────────────────────────
//  블록 시퀀스 추출 (미디어선교부 회의록 변환 — Layer 1)
//
//  기존 parseHwpxBuffer / HwpxRawDoc 와 완전히 독립.
//  형제 순서(문단·표·그림 혼합)를 보존하기 위해 별도 XMLParser 인스턴스를
//  preserveOrder:true 로 생성한다 (주보 경로는 기존 인스턴스 그대로 → 영향 0).
// ─────────────────────────────────────────────────────────────

/**
 * 본문 등장 순서를 보존한 블록.
 * - paragraph : 표 밖 평문 문단
 * - table     : 표 (셀 평문 행렬)
 * - image     : 그림 참조 (binItemId = OWPML binaryItemIDRef 등, BinData 매칭용)
 */
export type HwpxBlock =
  | { kind: "paragraph"; sectionIndex: number; order: number; text: string }
  | {
      kind: "table";
      sectionIndex: number;
      order: number;
      rowCount: number;
      colCount: number;
      rows: HwpxCell[][];
    }
  | { kind: "image"; sectionIndex: number; order: number; binItemId: string };

export interface HwpxBlockDoc {
  /** 등장 순서 보존 (paragraph | table | image 혼합) */
  blocks: HwpxBlock[];
  /** binItemId → 이미지 바이너리 (Layer 2 가 소비). BinData/ 폴더 엔트리. */
  binEntries: Map<string, Buffer>;
}

/** preserveOrder:true 모드의 노드 — { tag: child[] } 단일 키 객체 또는 텍스트 노드 */
interface OrderedNode {
  [key: string]: OrderedValue;
}
type OrderedValue = string | number | boolean | OrderedNode[] | OrderedAttrs;
/** 속성 묶음 — preserveOrder + ignoreAttributes:false 일 때 ":@" 키에 들어옴 */
interface OrderedAttrs {
  [attr: string]: string | number | boolean;
}

/** 태그 로컬명 (namespace 제거) — "hp:tbl" → "tbl" */
function localName(tag: string): string {
  const idx = tag.indexOf(":");
  return idx >= 0 ? tag.slice(idx + 1) : tag;
}

/** preserveOrder 노드 1개에서 태그명과 자식 배열을 뽑는다 (":@" 제외) */
function orderedTagOf(node: OrderedNode): { tag: string; children: OrderedNode[] } | null {
  for (const key of Object.keys(node)) {
    if (key === ":@" || key === "#text") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      return { tag: key, children: value as OrderedNode[] };
    }
  }
  return null;
}

/** preserveOrder 노드의 속성 묶음 (":@") 을 평탄 객체로 */
function orderedAttrsOf(node: OrderedNode): OrderedAttrs {
  const raw = node[":@"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as OrderedAttrs;
  }
  return {};
}

/** preserveOrder 트리 깊이 우선 텍스트 수집 (#text 노드) */
function collectOrderedText(nodes: OrderedNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    const t = node["#text"];
    if (typeof t === "string") parts.push(t);
    else if (typeof t === "number") parts.push(String(t));
    const tc = orderedTagOf(node);
    if (tc) parts.push(collectOrderedText(tc.children));
  }
  return parts.join("");
}

/** 표(tbl) 노드 → HwpxCell[][] (셀 텍스트 행렬) */
function extractOrderedTableRows(tblChildren: OrderedNode[]): HwpxCell[][] {
  const rows: HwpxCell[][] = [];
  function walkRows(nodes: OrderedNode[]): void {
    for (const node of nodes) {
      const tc = orderedTagOf(node);
      if (!tc) continue;
      if (localName(tc.tag) === "tr") {
        const cells: HwpxCell[] = [];
        function walkCells(cellNodes: OrderedNode[]): void {
          for (const cn of cellNodes) {
            const ctc = orderedTagOf(cn);
            if (!ctc) continue;
            if (localName(ctc.tag) === "tc") {
              cells.push({ text: collectOrderedText(ctc.children).trim() });
            } else {
              walkCells(ctc.children);
            }
          }
        }
        walkCells(tc.children);
        if (cells.length > 0) rows.push(cells);
      } else {
        walkRows(tc.children);
      }
    }
  }
  walkRows(tblChildren);
  return rows;
}

/**
 * 노드(보통 문단 p) 안에서 그림 참조(binaryItemIDRef)를 찾는다.
 * OWPML 의 그림은 hp:pic / hp:img 등 안에 binaryItemIDRef(혹은 binItem) 속성으로 BinData id 를 가리킨다.
 * best-effort — 속성 키에 "binaryitemidref" 또는 "binitem" 이 포함되면 그 값을 채택.
 */
function findBinItemRefs(nodes: OrderedNode[]): string[] {
  const refs: string[] = [];
  function walk(ns: OrderedNode[]): void {
    for (const node of ns) {
      const attrs = orderedAttrsOf(node);
      for (const [k, v] of Object.entries(attrs)) {
        const key = k.replace(/^@_/, "").toLowerCase();
        if (
          (key.includes("binaryitemidref") ||
            key === "binitem" ||
            key === "binitemref" ||
            key === "item") &&
          typeof v === "string" &&
          v.length > 0
        ) {
          refs.push(v);
        }
      }
      const tc = orderedTagOf(node);
      if (tc) walk(tc.children);
    }
  }
  walk(nodes);
  return refs;
}

/** 노드 서브트리에 그림 노드(pic/image/img) 가 있는지 */
function hasPictureNode(nodes: OrderedNode[]): boolean {
  for (const node of nodes) {
    const tc = orderedTagOf(node);
    if (!tc) continue;
    const ln = localName(tc.tag).toLowerCase();
    if (ln === "pic" || ln === "image" || ln === "img") return true;
    if (hasPictureNode(tc.children)) return true;
  }
  return false;
}

/** section XML(preserveOrder) 한 개에서 순서 보존 블록 추출 */
function parseSectionBlocks(
  xml: string,
  sectionIndex: number,
  startOrder: number,
  fallbackImageCounter: { value: number },
): HwpxBlock[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    trimValues: true,
    parseTagValue: false,
    isArray: () => false,
  });
  const tree = parser.parse(xml) as OrderedNode[];
  const blocks: HwpxBlock[] = [];
  let order = startOrder;

  function walk(nodes: OrderedNode[], insideTable: boolean): void {
    for (const node of nodes) {
      const tc = orderedTagOf(node);
      if (!tc) continue;
      const ln = localName(tc.tag);

      if (ln === "tbl") {
        const rows = extractOrderedTableRows(tc.children);
        if (rows.length > 0) {
          const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
          blocks.push({
            kind: "table",
            sectionIndex,
            order: order++,
            rowCount: rows.length,
            colCount,
            rows,
          });
        }
        // 표 내부 문단은 셀 텍스트로 이미 흡수 — 더 내려가지 않는다.
        continue;
      }

      if (!insideTable && ln === "p") {
        // 그림 참조 먼저 (문단 안에 그림이 박혀 있을 수 있음)
        const refs = findBinItemRefs(tc.children);
        const text = collectOrderedText(tc.children).trim();
        if (text.length > 0) {
          blocks.push({
            kind: "paragraph",
            sectionIndex,
            order: order++,
            text,
          });
        }
        if (refs.length > 0) {
          for (const ref of refs) {
            blocks.push({
              kind: "image",
              sectionIndex,
              order: order++,
              binItemId: ref,
            });
          }
        } else if (text.length === 0 && hasPictureNode(tc.children)) {
          // 그림은 있는데 참조 id 를 못 잡음 → 등장 순서 fallback id
          blocks.push({
            kind: "image",
            sectionIndex,
            order: order++,
            binItemId: `__fallback_${fallbackImageCounter.value++}`,
          });
        }
        continue;
      }

      walk(tc.children, insideTable);
    }
  }

  walk(tree, false);
  return blocks;
}

/**
 * 입력 버퍼에서 본문 블록 시퀀스(문단·표·그림) + BinData 이미지 바이너리를 추출한다.
 * 등장 순서를 보존하므로 회의록 마크다운 직렬화에 사용한다.
 * 본문 없음/매직 불일치/zip bomb 의심 시 throw (parseHwpxBuffer 와 동일 가드).
 */
export function parseHwpxBlocks(buffer: Buffer): HwpxBlockDoc {
  if (!isZipMagic(buffer)) {
    throw new Error("HWPX 형식이 아닙니다 (ZIP 매직 불일치).");
  }
  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error("파일이 너무 큽니다 (25MB 초과).");
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const sectionEntries = entries
    .filter((e) => {
      const name = e.entryName.replace(/\\/g, "/");
      return isSafeEntryName(name) && /^Contents\/section\d+\.xml$/i.test(name);
    })
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  if (sectionEntries.length === 0) {
    throw new Error("HWPX 본문(section*.xml)을 찾지 못했습니다.");
  }

  // BinData/ 폴더의 이미지 바이너리 수집 (path traversal 방어 + 개수 상한 30)
  const binEntries = new Map<string, Buffer>();
  const MAX_BIN_IMAGES = 30;
  const binList = entries
    .filter((e) => {
      const name = e.entryName.replace(/\\/g, "/");
      return isSafeEntryName(name) && /^BinData\/.+/i.test(name) && !e.isDirectory;
    })
    .sort((a, b) => a.entryName.localeCompare(b.entryName));

  for (const e of binList.slice(0, MAX_BIN_IMAGES)) {
    const name = e.entryName.replace(/\\/g, "/");
    // 키 후보: 전체 경로, 파일명(확장자 포함), 확장자 제거 파일명 (best-effort 매칭용)
    const fileName = name.slice(name.lastIndexOf("/") + 1);
    const stem = fileName.includes(".")
      ? fileName.slice(0, fileName.lastIndexOf("."))
      : fileName;
    const data = e.getData();
    binEntries.set(name, data);
    binEntries.set(fileName, data);
    if (stem) binEntries.set(stem, data);
  }

  const blocks: HwpxBlock[] = [];
  const fallbackImageCounter = { value: 0 };
  sectionEntries.forEach((entry, idx) => {
    const xml = entry.getData().toString("utf8");
    const sectionBlocks = parseSectionBlocks(
      xml,
      idx,
      blocks.length,
      fallbackImageCounter,
    );
    blocks.push(...sectionBlocks);
  });

  return { blocks, binEntries };
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
