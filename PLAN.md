# 보안 개선 구현 계획

> 기반: research.md 보안 취약점 분석 보고서 (2026-04-13)
> 원칙: 모바일 앱 백엔드 재사용 가능하도록 범용 설계
> 의존성 추가: `zod` (런타임 스키마 검증)
> 변경 파일: 14개 수정 + 2개 신규
> **상태: ✅ 구현 완료 (2026-04-13)**

---

## Phase 1 — 즉시 (CRITICAL) ✅

### Step 1. 보안 헤더 추가 ✅

**파일**: `next.config.ts`

현재 `headers()`가 없다. CSP·클릭재킹·MIME 스니핑 방어를 한 번에 추가한다.

```typescript
// next.config.ts — 기존 코드 뒤에 headers() 추가
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' https://*.ytimg.com https://*.supabase.co data: blob:",
              "media-src 'self' https://*.supabase.co",
              "frame-src https://www.youtube.com https://www.google.com",
              "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // ... 기존 redirects 그대로 유지
    ];
  },
};

export default nextConfig;
```

**변경 범위**: `headers()` 함수 추가. `redirects()`는 그대로.

---

### Step 2. 입력 검증 유틸 + Zod 설치 ✅

**신규 파일**: `src/lib/validation.ts`

모든 API 라우트와 폼에서 재사용할 검증 상수·함수를 한 곳에 모은다.
모바일 앱도 같은 API를 호출하므로, 서버측 검증이 곧 범용 검증이다.

```bash
npm install zod
```

```typescript
// src/lib/validation.ts
import { z } from "zod";

// ──────────────────────────────────────────────
//  공통 상수
// ──────────────────────────────────────────────

/** API에서 limit 파라미터의 최대값 */
export const MAX_QUERY_LIMIT = 100;

/** 파일 업로드 */
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const;
export const ALLOWED_PDF_EXTENSIONS = ["pdf"] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
export const MAX_PDF_SIZE = 20 * 1024 * 1024;    // 20 MB
export const MAX_UPLOAD_FILES = 30;               // 한 번에 최대 30장

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
    return { ok: false, reason: `허용되지 않는 파일 형식입니다. (허용: ${allowedExtensions.join(", ")})` };
  }
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return { ok: false, reason: `파일 크기가 ${maxMB}MB를 초과합니다.` };
  }
  return { ok: true };
}

/** 안전한 파일 확장자 추출 (경로 조작 방어) */
export function safeExtension(filename: string, allowed: readonly string[]): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return allowed.includes(ext) ? ext : allowed[0];
}

// ──────────────────────────────────────────────
//  limit 파라미터 파싱 (gallery, shorts 등)
// ──────────────────────────────────────────────

export function parseLimit(raw: string | null, fallback: number = 20): number {
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
  paths: z.array(z.string().startsWith("/").max(500)).min(1).max(20),
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

/** 그룹 게시글 (클라이언트 검증용 — 동일한 규칙을 서버 RLS 이후에도 적용) */
export const GroupPostSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(100, "제목은 100자까지"),
  content: z.string().min(1, "내용을 입력하세요").max(5000, "내용은 5,000자까지"),
});

/** 공지사항 */
export const NoticeSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200, "제목은 200자까지"),
  slug: z.string().max(100).optional(),
  category: z.enum(["일반", "긴급", "행사"]),
  content: z.string().min(1, "내용을 입력하세요").max(50000, "내용은 50,000자까지"),
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
```

---

### Step 3. Revalidate API — 타이밍-세이프 비교 + Zod 검증 ✅

**파일**: `src/app/api/revalidate/route.ts`

현재 코드:
```typescript
if (body.secret !== process.env.REVALIDATE_SECRET) {      // 타이밍 공격 취약
  return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
}
for (const path of body.paths) {                            // 무제한 배열
  revalidatePath(path);
}
```

수정 후 전체:
```typescript
// src/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { RevalidateSchema } from "@/lib/validation";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const parsed = RevalidateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !safeCompare(parsed.data.secret, secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  for (const path of parsed.data.paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true });
}
```

**변경 요약**:
- `timingSafeEqual`로 비교 (타이밍 공격 차단)
- `RevalidateSchema`로 paths 배열 최대 20개 + 각 경로 `/`로 시작 검증
- 에러 시 일반적 메시지만 반환

---

### Step 4. 파일 업로드 검증 — 갤러리 ✅

**파일**: `src/app/admin/gallery/page.tsx`

`uploadImages` 함수만 수정. 현재 코드 (line 114-151):

```typescript
async function uploadImages(albumId: string, files: FileList) {
  setUploading(true);
  const album = albums.find((a) => a.id === albumId);
  const existingCount = album?.images.length ?? 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split(".").pop();           // ← 검증 없음
    const path = `${albumId}/${Date.now()}-${i}.${ext}`;
    // ...
  }
}
```

수정 후:
```typescript
import {
  validateFile,
  safeExtension,
  ALLOWED_IMAGE_EXTENSIONS,
  MAX_IMAGE_SIZE,
  MAX_UPLOAD_FILES,
} from "@/lib/validation";

async function uploadImages(albumId: string, files: FileList) {
  if (files.length > MAX_UPLOAD_FILES) {
    alert(`한 번에 최대 ${MAX_UPLOAD_FILES}장까지 업로드할 수 있습니다.`);
    return;
  }

  // 전체 파일 사전 검증
  for (let i = 0; i < files.length; i++) {
    const check = validateFile(files[i], ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE);
    if (!check.ok) {
      alert(`${files[i].name}: ${check.reason}`);
      return;
    }
  }

  setUploading(true);
  const album = albums.find((a) => a.id === albumId);
  const existingCount = album?.images.length ?? 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = safeExtension(file.name, ALLOWED_IMAGE_EXTENSIONS);
    const path = `${albumId}/${Date.now()}-${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(path, file);

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(path);

      await supabase.from("gallery_images").insert({
        album_id: albumId,
        image_url: urlData.publicUrl,
        sort_order: existingCount + i,
      });

      if (existingCount === 0 && i === 0) {
        await supabase
          .from("gallery_albums")
          .update({ thumbnail_url: urlData.publicUrl })
          .eq("id", albumId);
      }
    }
  }

  setUploading(false);
  loadAlbums();
}
```

`createAlbum`에도 길이 검증 추가 (line 66-85):
```typescript
import { GalleryAlbumSchema } from "@/lib/validation";

async function createAlbum(e: React.FormEvent) {
  e.preventDefault();
  const check = GalleryAlbumSchema.safeParse({ title, category, date: date || undefined });
  if (!check.success) {
    alert(check.error.issues[0].message);
    return;
  }

  const tags: string[] = [category];
  if (subCategory) tags.push(subCategory);

  const { error } = await supabase.from("gallery_albums").insert({
    title: check.data.title,
    category: check.data.category,
    tags,
    date: check.data.date || null,
    is_public: false,
  });
  if (!error) {
    setTitle("");
    setSubCategory("");
    setDate(new Date().toISOString().split("T")[0]);
    setShowForm(false);
    loadAlbums();
  }
}
```

**input 요소에도 `accept` 강화** (line 337-340):
```html
<!-- 현재 -->
<input accept="image/*" ... />

<!-- 수정 -->
<input accept=".jpg,.jpeg,.png,.gif,.webp" ... />
```

---

### Step 5. 파일 업로드 검증 — 주보 PDF ✅

**파일**: `src/app/admin/weeklies/page.tsx`

`uploadPdf` 함수 수정 (line 42-67):

```typescript
import {
  validateFile,
  safeExtension,
  ALLOWED_PDF_EXTENSIONS,
  MAX_PDF_SIZE,
  WeeklySchema,
} from "@/lib/validation";

async function uploadPdf(weeklyId: string, file: File) {
  const check = validateFile(file, ALLOWED_PDF_EXTENSIONS, MAX_PDF_SIZE);
  if (!check.ok) {
    alert(check.reason);
    return;
  }

  setUploading(true);
  const ext = safeExtension(file.name, ALLOWED_PDF_EXTENSIONS); // 항상 "pdf"
  const path = `${weeklyId}.${ext}`;

  await supabase.storage.from("weeklies").remove([path]);

  const { error: uploadError } = await supabase.storage
    .from("weeklies")
    .upload(path, file);

  if (!uploadError) {
    const { data: urlData } = supabase.storage
      .from("weeklies")
      .getPublicUrl(path);

    await supabase
      .from("weeklies")
      .update({ pdf_url: urlData.publicUrl })
      .eq("id", weeklyId);
  }

  setUploading(false);
  loadWeeklies();
}
```

`createWeekly`에도 검증 추가:
```typescript
async function createWeekly(e: React.FormEvent) {
  e.preventDefault();
  const check = WeeklySchema.safeParse({ title, date: date || undefined });
  if (!check.success) {
    alert(check.error.issues[0].message);
    return;
  }
  const { error } = await supabase.from("weeklies").insert({
    title: check.data.title,
    date: check.data.date || null,
  });
  if (!error) {
    setTitle(""); setDate(""); setShowForm(false);
    loadWeeklies();
  }
}
```

---

## Phase 2 — 이번 주 내 (HIGH) ✅

### Step 6. API 입력 검증 — sermon-summary ✅

**파일**: `src/app/api/sermon-summary/route.ts`

수정: line 42의 `as` 타입 캐스팅을 Zod 검증으로 교체.

```typescript
import { SermonSummarySchema } from "@/lib/validation";

// line 42 교체
const parsed = SermonSummarySchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(
    { error: "잘못된 요청 형식입니다." },
    { status: 400 },
  );
}
const { sermon, saveAsNotice } = parsed.data;

// 이하 body.sermon → sermon, body.saveAsNotice → saveAsNotice로 교체
```

에러 메시지도 정리 (line 74-78):
```typescript
} catch (err) {
  console.error("Sermon summary error:", err);
  const status = err instanceof GeminiUnavailableError ? 503 : 500;
  return NextResponse.json(
    { error: status === 503 ? "AI 서버가 일시적으로 혼잡합니다." : "요약 생성에 실패했습니다." },
    { status },
  );
}
```

---

### Step 7. API 입력 검증 — shorts/trigger ✅

**파일**: `src/app/api/shorts/trigger/route.ts`

수정: line 15의 `as TriggerBody`를 Zod 검증으로 교체.

```typescript
import { ShortsTriggerSchema } from "@/lib/validation";

// line 15-22 교체
const parsed = ShortsTriggerSchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(
    { error: "videoId와 videoTitle은 필수이며, 각 필드의 길이 제한을 확인하세요." },
    { status: 400 },
  );
}
const body = parsed.data;
```

에러 메시지 정리 (line 95):
```typescript
// 현재: error: `Actions 트리거 실패: ${errText.slice(0, 500)}`
// 수정: 로그에만 상세 기록, 응답은 일반적 메시지
console.error("GitHub Actions dispatch failed:", errText);
await supabase
  .from("shorts_jobs")
  .update({
    status: "failed",
    error: "GitHub Actions 트리거 실패",
    updated_at: new Date().toISOString(),
  })
  .eq("id", job.id);
```

---

### Step 8. API 입력 검증 — shorts/[id]/reject ✅

**파일**: `src/app/api/shorts/[id]/reject/route.ts`

수정: line 18의 `as RejectBody`를 Zod 검증으로 교체.

```typescript
import { ShortsRejectSchema } from "@/lib/validation";

// line 18 교체
const parsed = ShortsRejectSchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json({ error: "반려 사유는 500자까지입니다." }, { status: 400 });
}

const { error } = await supabase
  .from("shorts_clips")
  .update({
    review_status: "rejected",
    reviewer_note: parsed.data.note?.trim() || null,
  })
  .eq("id", id);
```

---

### Step 9. API 입력 검증 — gallery, shorts 목록 (limit 상한) ✅

**파일**: `src/app/api/gallery/route.ts`

```typescript
import { parseLimit } from "@/lib/validation";

// line 10 교체
// 현재: limit: limitParam ? parseInt(limitParam, 10) : undefined,
// 수정:
const limit = limitParam ? parseLimit(limitParam) : undefined;
```

**파일**: `src/app/api/shorts/route.ts`

```typescript
import { parseLimit } from "@/lib/validation";

// line 13 교체
// 현재: const limit = parseInt(searchParams.get("limit") ?? "20", 10);
// 수정:
const limit = parseLimit(searchParams.get("limit"), 20);
```

---

### Step 10. 공지사항 폼 검증 ✅

**파일**: `src/app/admin/notices/page.tsx`

`handleSubmit` 함수 (line 58-79)에 검증 추가:

```typescript
import { NoticeSchema } from "@/lib/validation";

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const check = NoticeSchema.safeParse({
    title,
    slug: slug || undefined,
    category,
    content,
    date: date || undefined,
  });
  if (!check.success) {
    alert(check.error.issues[0].message);
    return;
  }

  const finalSlug = check.data.slug || generateSlug(title);

  if (editing) {
    await supabase
      .from("notices")
      .update({
        title: check.data.title,
        slug: finalSlug,
        category: check.data.category,
        content: check.data.content,
        date: check.data.date || null,
      })
      .eq("id", editing.id);
  } else {
    await supabase.from("notices").insert({
      title: check.data.title,
      slug: finalSlug,
      category: check.data.category,
      content: check.data.content,
      date: check.data.date || null,
      is_public: false,
    });
  }
  resetForm();
  loadNotices();
}
```

`<textarea>`에 `maxLength` 추가:
```html
<textarea maxLength={50000} ... />
```

---

### Step 11. 그룹 게시글 폼 검증 ✅

**파일**: `src/components/groups/DiscussionList.tsx`

`handleSubmit` 함수 (line 22-55)에 검증 추가:

```typescript
import { GroupPostSchema } from "@/lib/validation";

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const check = GroupPostSchema.safeParse({ title, content });
  if (!check.success) {
    alert(check.error.issues[0].message);
    return;
  }

  setSubmitting(true);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    setSubmitting(false);
    return;
  }

  const { error } = await supabase.from("group_posts").insert({
    group_id: groupId,
    author_id: user.id,
    title: check.data.title,
    content: check.data.content,
  });

  // ... 이하 동일
}
```

`<input>`과 `<textarea>`에 `maxLength` 추가:
```html
<input maxLength={100} ... />
<textarea maxLength={5000} ... />
```

---

### Step 12. 쇼츠 반려 사유 검증 (클라이언트) ✅

**파일**: `src/app/admin/shorts/page.tsx`

`handleReject` 함수 (line 194-203):

```typescript
// 현재
async function handleReject(clipId: string) {
  const note = prompt("반려 사유를 입력하세요:");
  if (note === null) return;
  // ... 바로 전송
}

// 수정
async function handleReject(clipId: string) {
  const note = prompt("반려 사유를 입력하세요 (최대 500자):");
  if (note === null) return;
  if (note.length > 500) {
    alert("반려 사유는 500자까지입니다.");
    return;
  }
  await fetch(`/api/shorts/${clipId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note.trim() || undefined }),
  });
  await loadJobs();
}
```

---

### Step 13. 에러 메시지 정리 ✅

이미 Step 6, 7에서 대부분 처리. 추가로:

**파일**: `src/app/api/shorts/[id]/approve/route.ts` (line 19)

```typescript
// 현재: return NextResponse.json({ error: error.message }, { status: 500 });
// 수정:
console.error("Approve clip error:", error);
return NextResponse.json({ error: "승인 처리에 실패했습니다." }, { status: 500 });
```

**파일**: `src/app/api/shorts/[id]/reject/route.ts` (line 29)

```typescript
// 현재: return NextResponse.json({ error: error.message }, { status: 500 });
// 수정:
console.error("Reject clip error:", error);
return NextResponse.json({ error: "반려 처리에 실패했습니다." }, { status: 500 });
```

---

### Step 14. 로그아웃 기능 ✅

**파일**: `src/app/(member)/profile/page.tsx`

프로필 페이지에 로그아웃 버튼을 추가한다. 이 페이지는 현재 서버 컴포넌트이므로,
로그아웃 버튼만 클라이언트 컴포넌트로 분리한다.

**신규 파일**: `src/components/LogoutButton.tsx`

```typescript
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600"
    >
      <LogOut size={16} />
      로그아웃
    </button>
  );
}
```

**파일**: `src/app/(member)/profile/page.tsx` — `<LogoutButton />` 추가:

```typescript
import { LogoutButton } from "@/components/LogoutButton";

// return 내부, 카드 닫는 </div> 바로 앞에 추가:
export default async function ProfilePage() {
  // ... 기존 코드 ...

  return (
    <>
      <PageHeader title="내 프로필" />
      <Container>
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8">
          <div className="space-y-4">
            {/* ... 기존 name, email, created_at ... */}
          </div>
          <div className="mt-8">
            <LogoutButton />
          </div>
        </div>
      </Container>
    </>
  );
}
```

---

### Step 15. 쇼츠 공개 API 필터링 ✅

**파일**: `src/app/api/shorts/route.ts`

인증되지 않은 요청에는 published 상태만 반환하도록 수정.
모바일 앱도 동일 API를 사용하므로, 인증 여부로 분기한다.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseLimit } from "@/lib/validation";
import type { ShortsJob, ShortsClip, ShortsJobWithClips } from "@/types/shorts";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = req.nextUrl;

  // 인증 확인 — 비인증 사용자는 published만 조회 가능
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  const status = searchParams.get("status");
  const published = searchParams.get("published");
  const limit = parseLimit(searchParams.get("limit"), 20);

  let jobQuery = supabase
    .from("shorts_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!isAdmin) {
    // 비관리자: published만 조회
    jobQuery = jobQuery.eq("status", "published");
  } else {
    if (status) jobQuery = jobQuery.eq("status", status);
    if (published === "true") jobQuery = jobQuery.eq("status", "published");
  }

  const { data: jobs } = await jobQuery;
  if (!jobs || jobs.length === 0) return NextResponse.json([]);

  const jobIds = jobs.map((j) => j.id as string);
  const { data: clips } = await supabase
    .from("shorts_clips")
    .select("*")
    .in("job_id", jobIds)
    .order("clip_index", { ascending: true });

  const clipsByJob: Record<string, ShortsClip[]> = {};
  for (const clip of (clips ?? []) as ShortsClip[]) {
    if (!clipsByJob[clip.job_id]) clipsByJob[clip.job_id] = [];
    clipsByJob[clip.job_id].push(clip);
  }

  const result: ShortsJobWithClips[] = (jobs as ShortsJob[]).map((job) => ({
    ...job,
    clips: clipsByJob[job.id] ?? [],
  }));

  return NextResponse.json(result);
}
```

---

## Phase 3 — 이번 달 내 (MEDIUM) ✅

### Step 16. OG 이미지 title 검증 ✅

**파일**: `src/app/api/og/route.tsx`

```typescript
export async function GET(request: NextRequest) {
  const rawTitle = request.nextUrl.searchParams.get("title") ?? "명성비전교회";
  // 길이 제한 + 제어문자 제거
  const title = rawTitle.slice(0, 100).replace(/[\x00-\x1f]/g, "");

  return new ImageResponse(
    // ... 기존 JSX 그대로
  );
}
```

---

### Step 17. REVALIDATE_SECRET 교체 (수동)

**.env.local** 에서 시크릿을 무작위 값으로 교체.

```bash
# 터미널에서 생성
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```env
# .env.local
REVALIDATE_SECRET=<위에서 생성된 64자 랜덤 문자열>
```

GitHub Actions 등에서 이 값을 참조하는 곳도 함께 변경.

---

## 변경 파일 요약

| # | 파일 | 작업 | Phase |
|---|------|------|-------|
| 1 | `package.json` | `zod` 의존성 추가 | 1 |
| 2 | `next.config.ts` | `headers()` 보안 헤더 추가 | 1 |
| 3 | `src/lib/validation.ts` | **신규** — 검증 상수·함수·Zod 스키마 | 1 |
| 4 | `src/app/api/revalidate/route.ts` | 타이밍-세이프 비교 + Zod | 1 |
| 5 | `src/app/admin/gallery/page.tsx` | 파일 업로드 검증 + 앨범 제목 검증 | 1 |
| 6 | `src/app/admin/weeklies/page.tsx` | PDF 업로드 검증 + 주보 제목 검증 | 1 |
| 7 | `src/app/api/sermon-summary/route.ts` | Zod 검증 + 에러 메시지 정리 | 2 |
| 8 | `src/app/api/shorts/trigger/route.ts` | Zod 검증 + 에러 메시지 정리 | 2 |
| 9 | `src/app/api/shorts/[id]/reject/route.ts` | Zod 검증 + 에러 메시지 정리 | 2 |
| 10 | `src/app/api/shorts/[id]/approve/route.ts` | 에러 메시지 정리 | 2 |
| 11 | `src/app/api/gallery/route.ts` | `parseLimit()` 적용 | 2 |
| 12 | `src/app/api/shorts/route.ts` | `parseLimit()` + 비인증 필터링 | 2 |
| 13 | `src/app/admin/notices/page.tsx` | 폼 검증 + maxLength | 2 |
| 14 | `src/components/groups/DiscussionList.tsx` | 폼 검증 + maxLength | 2 |
| 15 | `src/app/admin/shorts/page.tsx` | 반려 사유 길이 제한 | 2 |
| 16 | `src/components/LogoutButton.tsx` | **신규** — 로그아웃 버튼 | 2 |
| 17 | `src/app/(member)/profile/page.tsx` | LogoutButton 삽입 | 2 |
| 18 | `src/app/api/og/route.tsx` | title 길이 제한 | 3 |
| 19 | `.env.local` | REVALIDATE_SECRET 교체 | 3 |

---

## 모바일 호환성 메모

- 모든 검증 로직이 **서버측 API + `src/lib/validation.ts`**에 집중되므로, 모바일 앱은 동일 API를 호출하면 동일한 보안 검증을 받는다.
- Zod 스키마는 에러 메시지를 한국어로 설정했으므로, 모바일 앱에서도 `error.issues[0].message`를 그대로 사용자에게 표시 가능.
- 파일 업로드 검증(`validateFile`, `safeExtension`)은 클라이언트 유틸이지만, Supabase Storage의 RLS 정책이 서버측 방어선 역할을 한다. 모바일에서도 동일한 Supabase Storage SDK를 사용하므로 동일 보호 적용.
- 인증 체계(Supabase Auth JWT)는 웹과 모바일 모두 동일 토큰 사용. 미들웨어는 웹 전용이지만, API 라우트의 `requireAdmin()`은 모바일에서도 작동한다.
