/**
 * 미디어선교부 회의록 import DTO.
 * camelCase 만 사용 (snake_case 누출 금지). platform-neutral — 웹/모바일 동일 소비.
 *
 * 회의록 .hwpx → 추출/AI 정리 결과. 저장은 하지 않고 검수 모달이 받는다.
 * 사용자가 확정하면 기존 POST /api/boards/[id]/posts 로 { title, content, images } 전송.
 */

export interface MediaImportResult {
  /** AI 가 제안한 회의록 제목 (사용자 수정 가능) */
  suggestedTitle: string;
  /** 본문 마크다운 (표=GFM 표, 이미지=[IMG:url] 마커, 위치 보존) */
  markdown: string;
  /** 본문에 삽입된 이미지 public URL (등장 순서) — board_posts.images 후보 */
  imageUrls: string[];
  /** 파서가 건진 블록 개수 (디버그/표시용) */
  stats: { paragraphs: number; tables: number; images: number };
  /** AI 미적용(혼잡) 시 원문 폴백 여부 */
  aiApplied: boolean;
  /** 사용자 경고 (이미지 누락·표 비정형 등) */
  warnings: string[];
}

export interface MediaImportResponse {
  result: MediaImportResult;
}

export interface MediaImportApiError {
  error: string;
  hint?: string;
}
