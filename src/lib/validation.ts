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
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB (gallery)
export const MAX_BLOG_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB (blog-images 버킷 제한과 일치)
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

/** 갤러리 앨범 — 생성 */
export const GalleryAlbumSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  category: z.string().min(1),
  date: z.string().optional(),
});

/**
 * 갤러리 앨범 — 수정 (모든 필드 옵셔널, 최소 1개 변경)
 * 카테고리 변경 시 admin/gallery 페이지가 tags 배열을 재구성한 뒤 함께 전송한다.
 */
export const GalleryAlbumUpdateSchema = z
  .object({
    title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지").optional(),
    category: z.string().min(1).optional(),
    subCategory: z.string().max(50).optional().nullable(),
    date: z.string().optional().nullable(),
    isPublic: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.category !== undefined ||
      v.subCategory !== undefined ||
      v.date !== undefined ||
      v.isPublic !== undefined,
    { message: "변경할 항목이 없습니다." },
  );

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
  afternoon_mokjang_mode: z.boolean().default(false),
  wednesday_service: z.object({
    leader: z.string().max(50).default(""),
    scripture: z.string().max(100).default(""),
    title: z.string().max(200).default(""),
    pastor: z.string().max(50).default(""),
    hymn: z.string().max(20).default(""),
    benediction: z.string().max(50).default(""),
  }).default({ leader: "", scripture: "", title: "", pastor: "", hymn: "", benediction: "" }),
  dawn_readings: z.array(z.object({
    date: z.string().max(20),
    passage: z.string().max(100),
  })).default([]),
  offering_members: z.object({
    p1: z.string().max(50).default(""),
    p2: z.string().max(50).default(""),
    p3: z.string().max(50).default(""),
  }).default({ p1: "", p2: "", p3: "" }),
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
  })).max(20).default([]),
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
  special_offering: z.object({
    enabled: z.boolean().default(false),
    label: z.string().max(30).default("부활감사"),
  }).default({ enabled: false, label: "부활감사" }),
  front_toggles: z.object({
    meetings: z.boolean().default(true),
    bibleReading: z.boolean().default(true),
    newMembers: z.boolean().default(true),
    mealDuty: z.boolean().default(true),
    volunteerNote: z.boolean().default(true),
  }).default({
    meetings: true,
    bibleReading: true,
    newMembers: true,
    mealDuty: true,
    volunteerNote: true,
  }),
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
    special_praise: {
      part1: { song: "", choir: "" },
      part2: { song: "", choir: "" },
    },
    sermon_title: "",
    sermon_pastor: "",
    closing_hymn: "",
    weekly_verse: "",
    afternoon_service: { scripture: "", title: "", pastor: "" },
    afternoon_mokjang_mode: false,
    wednesday_service: {
      leader: "",
      scripture: "",
      title: "",
      pastor: "",
      hymn: "",
      benediction: "",
    },
    dawn_readings: [],
    offering_members: { p1: "", p2: "", p3: "" },
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
    special_offering: { enabled: false, label: "부활감사" },
    front_toggles: {
      meetings: true,
      bibleReading: true,
      newMembers: true,
      mealDuty: true,
      volunteerNote: true,
    },
    week_total: "",
    cumulative_total: "",
  };
}

/** 캘린더 이벤트 base schema — partial 등 변형용 */
export const CalendarEventBaseSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm")
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm")
    .optional(),
  notify: z.boolean().optional(),
});

/** 캘린더 이벤트 생성/수정 (자체 DB 캘린더 v1 — 단일 날짜) */
export const CalendarEventSchema = CalendarEventBaseSchema
  .refine((d) => !d.endTime || d.startTime, {
    message: "종료 시간만 단독 입력은 불가합니다 (시작 시간이 필요).",
    path: ["endTime"],
  })
  .refine(
    (d) => !d.startTime || !d.endTime || d.endTime > d.startTime,
    {
      message: "종료 시간은 시작 시간 이후여야 합니다.",
      path: ["endTime"],
    },
  );

/** PATCH 용 — 모든 필드 옵셔널, 시간 일관성 검증은 그대로 */
export const CalendarEventPatchSchema = CalendarEventBaseSchema.partial()
  .refine((d) => !d.endTime || d.startTime, {
    message: "종료 시간만 단독 입력은 불가합니다 (시작 시간이 필요).",
    path: ["endTime"],
  })
  .refine(
    (d) => !d.startTime || !d.endTime || d.endTime > d.startTime,
    {
      message: "종료 시간은 시작 시간 이후여야 합니다.",
      path: ["endTime"],
    },
  );

/**
 * 한국 휴대폰 번호 정규화: 10~11자리 숫자만 추출 → 010-XXXX-XXXX 형태로 변환.
 * 입력 예: "01012345678", "010-1234-5678", "+82 10 1234 5678" → "010-1234-5678"
 */
export function normalizeKoreanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // +82 로 시작하면 0 으로 치환
  const local = digits.startsWith("82")
    ? "0" + digits.slice(2)
    : digits;
  // 010 + 8자리 (총 11자리) 만 허용
  if (!/^010\d{8}$/.test(local)) return null;
  return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
}

/** 새가족 등록 폼 (공개 페이지 → POST /api/new-family) */
export const NewFamilyRegistrationSchema = z.object({
  visitPaths: z
    .array(
      z.enum([
        "website",
        "youtube",
        "recommendation",
        "visited_first",
        "etc",
      ]),
    )
    .max(5),
  visitPathsEtc: z.string().max(200).optional(),
  faithStatus: z.enum(["accepted", "not_yet", "unsure"]),
  name: z
    .string()
    .min(1, "이름을 입력하세요")
    .max(50, "이름은 50자까지"),
  gender: z.enum(["male", "female"]),
  birth: z
    .string()
    .min(1, "생년월일을 입력하세요")
    .max(40, "생년월일은 40자까지"),
  phone: z
    .string()
    .min(1, "연락처를 입력하세요")
    .max(20, "연락처 형식 오류"),
  region: z.string().max(100).optional(),
  churchHistory: z.enum([
    "never",
    "attended_no_baptism",
    "baptized_inactive",
    "baptized_active",
    "etc",
  ]),
  churchHistoryEtc: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  privacyConsent: z.literal(true, {
    message: "개인정보 수집 및 이용에 동의해야 합니다.",
  }),
});

/** PATCH /api/admin/new-families/[id] — 처리 상태/메모 수정 */
export const NewFamilyUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "assigned", "done"]).optional(),
  adminNote: z.string().max(2000).optional(),
});

/** 일정 알림 수신자 등록/수정 */
export const EventSubscriberSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100, "이름은 100자까지"),
  phone: z
    .string()
    .min(1, "전화번호를 입력하세요")
    .max(20, "전화번호 형식 오류")
    .refine(
      (v) => normalizeKoreanPhone(v) !== null,
      "휴대폰 번호 형식: 010-XXXX-XXXX",
    ),
  isActive: z.boolean().optional(),
  notifyD1: z.boolean().optional(),
  notifyDDay: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

// ──────────────────────────────────────────────
//  소모임 게시판 (마이그레이션 025)
// ──────────────────────────────────────────────

export const BoardCreateSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(100, "제목은 100자까지"),
  description: z.string().max(500).optional(),
  initialMemberIds: z.array(z.string().uuid()).max(500).optional(),
});

export const BoardUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isVisible: z.boolean().optional(),
});

export const BoardMembersReplaceSchema = z.object({
  profileIds: z.array(z.string().uuid()).max(500),
});

/** board-images Storage public URL 만 허용 — 외부 URL 끼워넣기 차단 */
const BOARD_IMAGE_URL_FRAGMENT =
  "/storage/v1/object/public/board-images/";

export const BoardPostSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(150, "제목은 150자까지"),
  content: z
    .string()
    .min(1, "내용을 입력하세요")
    .max(10000, "내용은 10,000자까지"),
  images: z
    .array(
      z
        .string()
        .url()
        .refine(
          (u) => u.includes(BOARD_IMAGE_URL_FRAGMENT),
          "허용되지 않은 이미지 URL",
        ),
    )
    .max(10, "이미지는 최대 10장")
    .default([]),
});

export const BoardPostPatchSchema = BoardPostSchema.partial();

export const BoardCommentSchema = z.object({
  content: z.string().min(1, "댓글을 입력하세요").max(1000, "댓글은 1,000자까지"),
});

/** cursor 파싱 — `${ISO_DATETIME}|${id}` 형태 */
export function parseBoardCursor(
  raw: string | null,
): { createdAt: string; id: string } | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf("|");
  if (idx < 0) return null;
  const createdAt = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

export function buildBoardCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

// ──────────────────────────────────────────────
//  주보 "교회소식" → 일정 AI 추출 (PLAN.md 2026-05-09)
// ──────────────────────────────────────────────

/** Gemini 응답 1건 — 검수 모달이 받는 후보 */
export const ExtractedEventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식: YYYY-MM-DD")
    .nullable(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm")
    .nullable(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "시간 형식: HH:mm")
    .nullable(),
  location: z.string().max(200).nullable(),
  description: z.string().max(1000).nullable(),
  sourceNewsIndex: z.number().int().min(-1).max(49).nullable(),
  sourceQuote: z.string().max(300).nullable(),
  confidence: z.number().min(0).max(1),
  rruleHint: z.string().max(200).nullable(),
});

/** Gemini 응답 전체 형태 — JSON.parse 후 검증 */
export const ExtractEventsResponseSchema = z.object({
  candidates: z.array(ExtractedEventSchema).max(30),
  skipped: z
    .array(
      z.object({
        sourceNewsIndex: z.number().int(),
        reason: z.string().max(200),
      }),
    )
    .default([]),
});

/** POST /api/admin/calendar/batch — 클라이언트가 검수·편집 후 보내는 페이로드 1건 */
export const EventBatchInsertItemSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    notify: z.boolean().optional(),
    /** 추적용 — 어느 주보에서 추출됐는지 */
    sourceWeeklyId: z.string().uuid().nullable().optional(),
    sourceNewsIndex: z.number().int().min(0).max(49).nullable().optional(),
  })
  .refine((d) => !d.endTime || d.startTime, {
    message: "종료 시간만 단독 입력은 불가합니다 (시작 시간이 필요).",
    path: ["endTime"],
  })
  .refine(
    (d) => !d.startTime || !d.endTime || d.endTime > d.startTime,
    {
      message: "종료 시간은 시작 시간 이후여야 합니다.",
      path: ["endTime"],
    },
  );

export const EventBatchInsertSchema = z.object({
  events: z.array(EventBatchInsertItemSchema).min(1).max(30),
});
