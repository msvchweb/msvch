import { z } from "zod";

// ──────────────────────────────────────────────
//  공통 상수
// ──────────────────────────────────────────────

/** API에서 limit 파라미터의 최대값 */
export const MAX_QUERY_LIMIT = 100;

/** 파일 업로드 */
export const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
] as const;
export const ALLOWED_PDF_EXTENSIONS = ["pdf"] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_FILES = 30;

// ──────────────────────────────────────────────
//  파일 검증
// ──────────────────────────────────────────────

export function validateFile(
  file: File,
  allowedExtensions: readonly string[],
  maxSize: number,
): { ok: true } | { ok: false; reason: string } {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      ok: false,
      reason: `허용되지 않는 파일 형식입니다. (허용: ${allowedExtensions.join(", ")})`,
    };
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return { ok: false, reason: `파일 크기가 ${maxMB}MB를 초과합니다.` };
  }
  return { ok: true };
}

/** 안전한 파일 확장자 추출 (경로 조작 방어) */
export function safeExtension(
  filename: string,
  allowed: readonly string[],
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return allowed.includes(ext) ? ext : allowed[0];
}

// ──────────────────────────────────────────────
//  limit 파라미터 파싱
// ──────────────────────────────────────────────

export function parseLimit(
  raw: string | null,
  fallback: number = 20,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return fallback;
  return Math.min(n, MAX_QUERY_LIMIT);
}

// ──────────────────────────────────────────────
//  API 스키마 (Zod)
// ──────────────────────────────────────────────

/** POST /api/revalidate */
export const RevalidateSchema = z.object({
  secret: z.string().min(1),
  paths: z
    .array(z.string().startsWith("/").max(500))
    .min(1)
    .max(20),
});

/** POST /api/sermon-summary */
export const SermonSummarySchema = z.object({
  sermon: z.object({
    videoId: z.string().min(1).max(50),
    title: z.string().min(1).max(300),
    description: z.string().max(10000).default(""),
    thumbnail: z.string().max(2000).default(""),
    publishedAt: z.string().min(1).max(50),
  }),
  saveAsNotice: z.boolean(),
});

/** POST /api/shorts/trigger */
export const ShortsTriggerSchema = z.object({
  videoId: z.string().min(1).max(50),
  videoTitle: z.string().min(1).max(300),
  videoPublishedAt: z.string().max(50).optional(),
  videoThumbnail: z.string().max(2000).optional(),
});

/** POST /api/shorts/[id]/reject */
export const ShortsRejectSchema = z.object({
  note: z.string().max(500).optional(),
});

/** 그룹 게시글 */
export const GroupPostSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(100, "제목은 100자까지"),
  content: z
    .string()
    .min(1, "내용을 입력하세요")
    .max(5000, "내용은 5,000자까지"),
});

/** 공지사항 */
export const NoticeSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  slug: z.string().max(100).optional(),
  category: z.enum(["일반", "긴급", "행사"]),
  content: z
    .string()
    .min(1, "내용을 입력하세요")
    .max(50000, "내용은 50,000자까지"),
  date: z.string().optional(),
});

/** 갤러리 앨범 */
export const GalleryAlbumSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  category: z.string().min(1),
  date: z.string().optional(),
});

/** 주보 */
export const WeeklySchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  date: z.string().optional(),
});

/** 캘린더 이벤트 생성 */
export const CalendarEventSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm").optional(),
});
