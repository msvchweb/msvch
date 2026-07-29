import Image from "next/image";
import type { ReactNode } from "react";
import { isAllowedBoardImageUrl } from "@/lib/validation";

/**
 * 미디어선교부 회의록 전용 마크다운 렌더러 (Layer 3(c)).
 *
 * 적용 범위: 미디어선교부 전용 상세에서만 사용 (O3 확정). 일반 /boards 상세는 plain text 유지.
 *
 * 처리하는 제한된 부분집합:
 *   1. [IMG:url] 마커 → next/image (board-images 버킷 URL 화이트리스트만)
 *   2. GFM 표 (| ... | 연속 줄 + 구분선) → <table>
 *   3. ## 제목 / - 목록 / **굵게** 인라인
 *   4. 그 외 평문 → whitespace-pre-wrap (평문 글 하위 호환)
 *
 * XSS: dangerouslySetInnerHTML 절대 사용 안 함. 원문은 항상 텍스트 노드로 렌더(React escape).
 *      이미지 src 는 board-images 버킷 URL 만 허용 — 외부/javascript: URL 차단.
 */

// 화이트리스트는 validation.ts 한 곳에서만 관리한다 — 여기에 사본을 두면
// 마이그레이션 종료 시 한쪽만 정리되어 정책이 어긋날 수 있다.
const isAllowedImageUrl = isAllowedBoardImageUrl;

/** **굵게** 인라인만 처리 — 나머지는 텍스트 노드. (XSS 안전) */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-gray-900">
          {bold[1]}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>;
  });
}

/** GFM 표 구분선인지 (| --- | --- |) */
function isTableSeparator(line: string): boolean {
  // 1개 이상의 컬럼 지원 (| --- | 또는 | --- | --- |)
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/** 표 행 한 줄을 셀 배열로 (앞뒤 파이프 제거, \| 언이스케이프) */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!trimmed.includes("|")) return [trimmed.replace(/\\\|/g, "|").trim()];
  return trimmed
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
}

interface Block {
  type: "image" | "table" | "heading" | "list" | "paragraph";
  key: string;
  content: string;
  rows?: string[][];
  items?: string[];
}

/** 본문 문자열 → 블록 배열 (라인 단위 스캔) */
function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = (): void => {
    if (paraBuf.length > 0) {
      blocks.push({
        type: "paragraph",
        key: `p-${blocks.length}`,
        content: paraBuf.join("\n").trim(),
      });
      paraBuf = [];
    }
  };
  const flushList = (): void => {
    if (listBuf.length > 0) {
      blocks.push({
        type: "list",
        key: `l-${blocks.length}`,
        content: "",
        items: listBuf.slice(),
      });
      listBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 이미지 마커 (한 줄 전체가 마커)
    const imgMatch = trimmed.match(/^\[IMG:(.+)\]$/);
    if (imgMatch) {
      flushPara();
      flushList();
      blocks.push({
        type: "image",
        key: `i-${blocks.length}`,
        content: imgMatch[1],
      });
      i += 1;
      continue;
    }

    // GFM 표 — 현재 줄에 | 가 있고 다음 줄이 구분선
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      flushPara();
      flushList();
      const rows: string[][] = [splitTableRow(trimmed)];
      i += 2; // header + separator 소비
      while (i < lines.length && (lines[i].trim().startsWith("|") || lines[i].trim().includes("|"))) {
        const rowTrimmed = lines[i].trim();
        if (rowTrimmed.length === 0) break;
        rows.push(splitTableRow(rowTrimmed));
        i += 1;
      }
      blocks.push({
        type: "table",
        key: `tb-${blocks.length}`,
        content: "",
        rows,
      });
      continue;
    }

    // 제목 (## / ### ...)
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flushPara();
      flushList();
      blocks.push({
        type: "heading",
        key: `h-${blocks.length}`,
        content: headingMatch[1],
      });
      i += 1;
      continue;
    }

    // 목록 (- / *)
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushPara();
      listBuf.push(listMatch[1]);
      i += 1;
      continue;
    }

    // 빈 줄 → 문단/목록 종료
    if (trimmed.length === 0) {
      flushPara();
      flushList();
      i += 1;
      continue;
    }

    flushList();
    paraBuf.push(line);
    i += 1;
  }
  flushPara();
  flushList();
  return blocks;
}

export function MeetingNoteContent({
  content,
  title = "",
}: {
  content: string;
  title?: string;
}) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-gray-700">
      {blocks.map((block) => {
        if (block.type === "image") {
          if (!isAllowedImageUrl(block.content)) {
            // 화이트리스트 미통과 → 이미지로 렌더하지 않고 안내 텍스트만 (URL 로드 차단)
            return (
              <p key={block.key} className="text-xs text-gray-400">
                (허용되지 않은 이미지)
              </p>
            );
          }
          return (
            <div
              key={block.key}
              className="relative w-full overflow-hidden rounded-xl"
            >
              <Image
                src={block.content}
                alt={`${title} 이미지`}
                width={800}
                height={600}
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, 800px"
                unoptimized
              />
            </div>
          );
        }

        if (block.type === "table" && block.rows && block.rows.length > 0) {
          const [header, ...body] = block.rows;
          return (
            <div key={block.key} className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {header.map((cell, ci) => (
                      <th
                        key={ci}
                        className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-left font-semibold text-gray-700"
                      >
                        {renderInline(cell, `${block.key}-th-${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="border border-gray-200 px-2 py-1.5 align-top text-gray-700"
                        >
                          {renderInline(cell, `${block.key}-td-${ri}-${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "heading") {
          return (
            <h3
              key={block.key}
              className="pt-2 text-base font-bold text-gray-900"
            >
              {renderInline(block.content, block.key)}
            </h3>
          );
        }

        if (block.type === "list" && block.items) {
          return (
            <ul key={block.key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `${block.key}-li-${ii}`)}</li>
              ))}
            </ul>
          );
        }

        // paragraph (평문 하위 호환 — whitespace-pre-wrap)
        return (
          <p key={block.key} className="whitespace-pre-wrap">
            {renderInline(block.content, block.key)}
          </p>
        );
      })}
    </div>
  );
}
