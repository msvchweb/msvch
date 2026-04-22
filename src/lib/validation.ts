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

/** 주보 기본 */
export const WeeklySchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  date: z.string().optional(),
});

const SpecialPraisePartSchema = z.object({
  song: z.string().max(200).default(""),
  choir: z.string().max(100).default(""),
});

/** 주보 콘텐츠 (폼 입력 전체) */
export const WeeklyContentSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200),
  date: z.string().optional(),
  volume: z.number().int().positive().nullable().default(null),
  issue: z.number().int().positive().nullable().default(null),
  hymn_number: z.string().max(10).default(""),
  scripture: z.string().max(100).default(""),
  special_praise: z.object({
    part1: SpecialPraisePartSchema,
    part2: SpecialPraisePartSchema,
  }).default({ part1: { song: "", choir: "" }, part2: { song: "", choir: "" } }),
  sermon_title: z.string().max(200).default(""),
  sermon_pastor: z.string().max(50).default(""),
  closing_hymn: z.string().max(10).default(""),
  weekly_verse: z.string().max(500).default(""),
  afternoon_service: z.object({
    scripture: z.string().max(100).default(""),
    title: z.string().max(200).default(""),
    pastor: z.string().max(50).default(""),
  }).default({ scripture: "", title: "", pastor: "" }),
  wednesday_service: z.object({
    scripture: z.string().max(100).default(""),
    title: z.string().max(200).default(""),
  }).default({ scripture: "", title: "" }),
  dawn_readings: z.array(z.object({
    date: z.string().max(20),
    passage: z.string().max(100),
  })).default([]),
  offering_members: z.object({
    p1: z.string().max(50).default(""),
    p2: z.string().max(50).default(""),
    p3: z.string().max(50).default(""),
  }).default({ p1: "", p2: "", p3: "" }),
  prayer_items: z.array(z.object({ text: z.string().max(500) })).default([]),
  announcements: z.array(z.object({ text: z.string().max(500) })).default([]),
  servants_text: z.string().max(2000).default(""),
  offering_list_text: z.string().max(5000).default(""),
  is_published: z.boolean().default(false),
  publish_channels: z.object({
    website: z.boolean().default(false),
    alimtalk: z.boolean().default(false),
    instagram: z.boolean().default(false),
  }).default({ website: false, alimtalk: false, instagram: false }),
  // ── migration 011 필드 — 레이아웃 고정을 위한 상한(max)은 컴포넌트의 slice 와 동일해야 함
  news: z.array(z.object({
    title: z.string().max(120).default(""),
    items: z.array(z.string().max(500)).max(10).default([]),
  })).max(9).default([]),
  meetings: z.array(z.object({
    group: z.string().max(40).default(""),
    when: z.string().max(60).default(""),
    place: z.string().max(80).default(""),
  })).max(6).default([]),
  north_korea_note: z.string().max(300).default(""),
  bible_reading: z.string().max(300).default(""),
  new_members: z.array(z.object({
    no: z.string().max(10).default(""),
    regNo: z.string().max(20).default(""),
    name: z.string().max(40).default(""),
    inviter: z.string().max(60).default(""),
    dept: z.string().max(40).default(""),
  })).max(4).default([]),
  meal_duty_note: z.string().max(300).default(""),
  volunteer_note: z.string().max(300).default(""),
  worship_leader: z.string().max(120).default(""),
  worship_items: z.array(z.object({
    marker: z.string().max(4).default(""),
    label: z.string().max(40).default(""),
    content: z.string().max(300).default(""),
    assignees: z.array(z.string().max(80)).max(5).default([]),
    subRows: z.array(z.object({
      content: z.string().max(200).default(""),
      assignee: z.string().max(80).default(""),
    })).max(4).default([]),
    emphasize: z.boolean().default(false),
  })).max(24).default([]),
  memorize_verse: z.object({
    ref: z.string().max(40).default(""),
    text: z.string().max(500).default(""),
  }).default({ ref: "", text: "" }),
  next_week_prayer: z.array(z.string().max(80)).max(3).default([]),
  guide_committee: z.array(z.object({
    part: z.string().max(10).default(""),
    indoor: z.string().max(80).default(""),
    outdoor: z.string().max(80).default(""),
  })).max(3).default([]),
  offerings: z.array(z.object({
    label: z.string().max(30).default(""),
    names: z.string().max(500).default(""),
  })).max(11).default([]),
  week_total: z.string().max(40).default(""),
  cumulative_total: z.string().max(40).default(""),
});

// ── 마스터 데이터 스키마 (admin/masters CRUD 에서 사용) ───────────────

export const ChurchSettingTopicSchema = z.object({
  text: z.string().min(1).max(80),
  year: z.number().int().min(2000).max(2200),
});
export type ChurchSettingTopicInput = z.infer<typeof ChurchSettingTopicSchema>;

export const MokjangEntrySchema = z.object({
  id: z.number().int().min(1).max(200),
  name: z.string().max(40).default(""),
  sub: z.string().max(40).default(""),
  year: z.number().int().min(2000).max(2200).nullable().default(null),
  active: z.boolean().default(true),
});
export type MokjangEntryInput = z.infer<typeof MokjangEntrySchema>;

export const ServantSchema = z.object({
  seq: z.number().int().min(1).max(20),
  role: z.string().min(1).max(40),
  names: z.string().max(200).default(""),
});
export type ServantInput = z.infer<typeof ServantSchema>;

export const SupportSectionSchema = z.object({
  seq: z.number().int().min(1).max(10),
  heading: z.string().min(1).max(40),
  lines: z.array(z.string().max(200)).max(20).default([]),
});
export type SupportSectionInput = z.infer<typeof SupportSectionSchema>;

export const CommunityPrayerSchema = z.object({
  seq: z.number().int().min(1).max(20),
  text: z.string().min(1).max(500),
});
export type CommunityPrayerInput = z.infer<typeof CommunityPrayerSchema>;

export type WeeklyContentInput = z.infer<typeof WeeklyContentSchema>;

/** 완전히 빈 WeeklyContentInput 을 생성. new 폼 / test-front mock 등에서 사용 */
export function createEmptyWeeklyInput(): WeeklyContentInput {
  return {
    title: "",
    date: undefined,
    volume: null,
    issue: null,
    hymn_number: "",
    scripture: "",
    special_praise: {
      part1: { song: "", choir: "" },
      part2: { song: "", choir: "" },
    },
    sermon_title: "",
    sermon_pastor: "",
    closing_hymn: "",
    weekly_verse: "",
    afternoon_service: { scripture: "", title: "", pastor: "" },
    wednesday_service: { scripture: "", title: "" },
    dawn_readings: [],
    offering_members: { p1: "", p2: "", p3: "" },
    prayer_items: [],
    announcements: [],
    servants_text: "",
    offering_list_text: "",
    is_published: false,
    publish_channels: { website: false, alimtalk: false, instagram: false },
    news: [],
    meetings: [],
    north_korea_note: "",
    bible_reading: "",
    new_members: [],
    meal_duty_note: "",
    volunteer_note: "",
    worship_leader: "",
    worship_items: [],
    memorize_verse: { ref: "", text: "" },
    next_week_prayer: [],
    guide_committee: [],
    offerings: [],
    week_total: "",
    cumulative_total: "",
  };
}

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
