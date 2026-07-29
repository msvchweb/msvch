/**
 * R2 스토리지 공용 타입.
 *
 * 모바일(RN) 앱이 동일 엔드포인트를 백엔드 수정 0 으로 호출할 수 있도록,
 * 업로드 흐름의 요청/응답 shape 을 여기에 고정한다.
 *
 * 업로드 흐름:
 *   ① POST /api/storage/upload-url  → UploadUrlRequest / UploadUrlResponse
 *   ② PUT  response.uploadUrl       → 본문 = 파일, 헤더 = response.headers 그대로
 *   ③ 기존 저장 API 에 response.publicUrl 전달
 */

/**
 * 스토리지 prefix — 기존 Supabase 버킷명을 그대로 승계한다.
 * 단일 R2 버킷(`msvch-storage`) 안에서 이 값이 최상위 경로가 된다.
 */
export const STORAGE_PREFIXES = [
  "gallery",
  "weeklies",
  "blog-images",
  "board-images",
  "poster-images",
  "shorts",
] as const;

export type StoragePrefix = (typeof STORAGE_PREFIXES)[number];

export function isStoragePrefix(value: string): value is StoragePrefix {
  return (STORAGE_PREFIXES as readonly string[]).includes(value);
}

export interface UploadUrlRequest {
  prefix: StoragePrefix;
  /**
   * prefix 아래 하위 경로 세그먼트 (예: 앨범 id, 게시판 id).
   * 각 세그먼트는 서버에서 `^[A-Za-z0-9_-]{1,64}$` 로 검증한다 → 경로 조작 차단.
   */
  scope?: string[];
  /** 확장자 판별용 원본 파일명. 최종 key 에는 사용되지 않는다. */
  filename: string;
  contentType: string;
  /** 바이트. 서버가 prefix 별 상한과 대조한다. */
  size: number;
  /**
   * 파일명 본체를 호출자가 지정해야 할 때만 사용 (예: 포스터 버전 `v001`).
   * 미지정 시 서버가 타임스탬프 + 난수로 생성한다.
   */
  basename?: string;
}

export interface UploadUrlResponse {
  /** 버킷 내 객체 key (예: `gallery/{albumId}/1785290080-a1b2c3.jpg`) */
  key: string;
  /** presigned PUT URL. 만료 후 사용 불가. */
  uploadUrl: string;
  /** DB 에 저장할 공개 URL (`https://www.msvch.org/cdn/...`) */
  publicUrl: string;
  /**
   * PUT 요청에 **그대로** 실어야 하는 헤더.
   * 서명에 포함되어 있으므로 값이 하나라도 다르면 R2 가 403 을 돌려준다.
   */
  headers: Record<string, string>;
  expiresInSeconds: number;
}

/**
 * 삭제 요청. `keys` / `urls` 중 하나 이상을 채운다.
 *
 * 호출부 대부분이 DB 에 저장된 공개 URL 만 들고 있으므로 `urls` 도 받는다.
 * 서버가 우리 CDN base 로 시작하는 URL 만 key 로 변환하므로,
 * 외부 URL 을 넘겨 엉뚱한 객체를 지우게 만들 수는 없다.
 */
export interface DeleteObjectsRequest {
  keys?: string[];
  urls?: string[];
}

export interface DeleteObjectsResponse {
  /** 실제로 삭제 요청이 나간 key 목록. */
  deleted: string[];
}
