/**
 * R2 객체 key 생성 및 공개 URL 조립.
 *
 * key 는 **항상 서버가 만든다.** 클라이언트가 준 문자열을 그대로 경로에 쓰면
 * `../` 로 다른 prefix 를 덮어쓸 수 있기 때문에, 모든 세그먼트를 화이트리스트
 * 정규식으로 검증한 뒤에만 조립한다.
 *
 * 공개 URL 은 `https://www.msvch.org/cdn/<key>` 형태다.
 * R2 origin(`https://pub-xxx.r2.dev`)은 next.config.ts 의 rewrite 뒤에 숨어 있으므로
 * DB 에는 교회 도메인만 저장된다 → 이후 스토리지 백엔드를 바꿔도 DB 재작성이 없다.
 */

import {
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_BLOG_IMAGE_SIZE,
  MAX_IMAGE_SIZE,
  safeExtension,
} from "@/lib/validation";
import { isStoragePrefix, type StoragePrefix } from "@/types/storage";

/** 경로 세그먼트 화이트리스트 — 점·슬래시를 허용하지 않아 traversal 이 불가능하다. */
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const POSTER_MAX_SIZE = 10 * 1024 * 1024;
const SHORTS_MAX_SIZE = 200 * 1024 * 1024;

interface PrefixRule {
  maxSize: number;
  extensions: readonly string[];
  contentTypes: readonly string[];
}

const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * prefix 별 제약 — 기존 Supabase 버킷 설정과 1:1로 맞춘다.
 * (마이그레이션 009 / 025 / 026 의 file_size_limit, allowed_mime_types)
 */
export const PREFIX_RULES: Record<StoragePrefix, PrefixRule> = {
  gallery: {
    maxSize: MAX_IMAGE_SIZE,
    extensions: ALLOWED_IMAGE_EXTENSIONS,
    contentTypes: IMAGE_CONTENT_TYPES,
  },
  weeklies: {
    maxSize: MAX_IMAGE_SIZE,
    extensions: ALLOWED_IMAGE_EXTENSIONS,
    contentTypes: IMAGE_CONTENT_TYPES,
  },
  "blog-images": {
    maxSize: MAX_BLOG_IMAGE_SIZE,
    extensions: ALLOWED_IMAGE_EXTENSIONS,
    contentTypes: IMAGE_CONTENT_TYPES,
  },
  "board-images": {
    maxSize: MAX_BLOG_IMAGE_SIZE,
    extensions: ALLOWED_IMAGE_EXTENSIONS,
    contentTypes: IMAGE_CONTENT_TYPES,
  },
  "poster-images": {
    maxSize: POSTER_MAX_SIZE,
    extensions: ["png", "jpg", "jpeg", "webp"],
    contentTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  shorts: {
    maxSize: SHORTS_MAX_SIZE,
    extensions: ["mp4"],
    contentTypes: ["video/mp4"],
  },
};

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageKeyError";
  }
}

function assertSegments(segments: readonly string[]): void {
  for (const segment of segments) {
    if (!SEGMENT_PATTERN.test(segment)) {
      throw new StorageKeyError(`허용되지 않은 경로 세그먼트입니다: ${segment}`);
    }
  }
}

/** 충돌 가능성이 사실상 없는 짧은 파일명 본체. */
function generateBasename(): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${Date.now()}-${random}`;
}

export interface BuildKeyInput {
  prefix: StoragePrefix;
  scope?: string[];
  filename: string;
  contentType: string;
  size: number;
  basename?: string;
}

/**
 * 검증 + key 조립. 실패 시 StorageKeyError 를 던진다.
 *
 * 클라이언트가 이미 `validateFile()` 로 걸렀더라도 서버에서 다시 본다.
 * 클라 검증은 우회 가능하므로 신뢰하지 않는다.
 */
export function buildObjectKey(input: BuildKeyInput): string {
  const rule = PREFIX_RULES[input.prefix];
  if (!rule) throw new StorageKeyError("알 수 없는 prefix 입니다.");

  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new StorageKeyError("파일 크기가 올바르지 않습니다.");
  }
  if (input.size > rule.maxSize) {
    const maxMb = Math.round(rule.maxSize / 1024 / 1024);
    throw new StorageKeyError(`파일 크기가 ${maxMb}MB를 초과합니다.`);
  }
  if (!rule.contentTypes.includes(input.contentType)) {
    throw new StorageKeyError(
      `허용되지 않는 파일 형식입니다. (허용: ${rule.contentTypes.join(", ")})`,
    );
  }

  const scope = input.scope ?? [];
  assertSegments(scope);

  if (input.basename !== undefined) assertSegments([input.basename]);
  const basename = input.basename ?? generateBasename();

  const extension = safeExtension(input.filename, rule.extensions);

  return [input.prefix, ...scope, `${basename}.${extension}`].join("/");
}

/**
 * 주보 import 원본(.hwp / .hwpx)의 key.
 *
 * 업로드(import-hwp/hwpx), 변환 결과 회수(import-hwp-finalize),
 * 7일 정리(cleanup-weekly-imports), GitHub Actions 워크플로가 모두 이 규칙을
 * 공유하므로 한 곳에서만 만든다. `weekly_imports.file_path` 에도 이 값을 그대로 저장한다.
 */
export function weeklyImportKey(
  importId: string,
  extension: "hwp" | "hwpx",
): string {
  return `weeklies/imports/${importId}.${extension}`;
}

/**
 * 업로드 원본은 7일 후 cron 이 지운다. CDN 이 1년짜리로 붙들고 있으면 안 되고,
 * 애초에 서버만 내려받으므로 캐시하지 않는다.
 */
export const NO_STORE_CACHE_CONTROL = "private, max-age=0, no-store";

/** key 의 최상위 세그먼트에서 prefix 를 뽑는다. 알 수 없으면 null. */
export function prefixFromKey(key: string): StoragePrefix | null {
  const head = key.split("/")[0] ?? "";
  return isStoragePrefix(head) ? head : null;
}

/** key → DB 에 저장할 공개 URL. */
export function publicUrlForKey(key: string): string {
  const base = process.env.NEXT_PUBLIC_CDN_BASE_URL;
  if (!base) {
    throw new StorageKeyError("NEXT_PUBLIC_CDN_BASE_URL 환경변수가 누락되었습니다.");
  }
  return `${base.replace(/\/$/, "")}/${key}`;
}

/**
 * 공개 URL → key 역변환. 삭제 라우트에서 기존 DB URL 을 다룰 때 사용.
 * 우리 CDN base 로 시작하지 않으면 null (외부 URL 을 지우려는 시도 차단).
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = process.env.NEXT_PUBLIC_CDN_BASE_URL;
  if (!base) return null;
  const normalized = `${base.replace(/\/$/, "")}/`;
  if (!url.startsWith(normalized)) return null;
  const key = url.slice(normalized.length);
  return key.length > 0 && !key.includes("..") ? key : null;
}
