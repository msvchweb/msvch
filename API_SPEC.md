# API 명세

## 개요

Next.js App Router 기반 API 라우트. 모든 엔드포인트는 `/api/` 하위에 위치.

---

## 엔드포인트

### GET `/api/sermons`

설교 영상 목록을 YouTube RSS 피드에서 가져온다.

- **인증**: 불필요
- **응답**: `SermonVideo[]`

```ts
interface SermonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string; // ISO 8601
}
```

- **캐시**: ISR 30분 (`revalidate: 1800`)
- **최대 결과**: 15개

---

### POST `/api/sermon-summary`

Gemini AI로 설교 요약을 생성한다. 선택적으로 공지사항으로 저장.

- **인증**: admin 역할 필수
- **최대 실행 시간**: 60초
- **요청 본문** (Zod 검증: `SermonSummarySchema`):

```ts
{
  sermon: {
    videoId: string;       // max 50
    title: string;         // max 300
    description: string;   // max 10000
    thumbnail: string;     // max 2000
    publishedAt: string;   // max 50
  };
  saveAsNotice: boolean;
}
```

- **응답 (200)**:

```ts
{ summary: string }
```

- **에러 응답**:
  - `400` — `{ error: "잘못된 요청 형식입니다." }`
  - `401` — `{ error: "로그인이 필요합니다." }`
  - `403` — `{ error: "관리자 권한이 필요합니다." }`
  - `500` — `{ error: "요약 생성에 실패했습니다." }`
  - `503` — `{ error: "AI 서버가 일시적으로 혼잡합니다." }`

- **부작용**: `saveAsNotice: true`이면 `notices` 테이블에 upsert (`slug: sermon-{videoId}`)

---

### POST `/api/revalidate`

온디맨드 ISR 캐시 무효화.

- **인증**: 시크릿 토큰 (`REVALIDATE_SECRET`, 타이밍-세이프 비교)
- **요청 본문** (Zod 검증: `RevalidateSchema`):

```ts
{
  secret: string;
  paths: string[]; // max 20개, 각 `'/'`로 시작, max 500자. e.g. ["/", "/sermons"]
}
```

- **응답 (200)**: `{ revalidated: true }`
- **에러**:
  - `400` — 잘못된 요청 형식
  - `401` — 잘못된 시크릿

---

### GET `/api/og?title={title}`

동적 OpenGraph 이미지 생성.

- **런타임**: Edge
- **인증**: 불필요
- **쿼리 파라미터**: `title` (선택, 기본값: "명성비전교회", 최대 100자, 제어문자 제거)
- **응답**: `ImageResponse` (1200x630 PNG)

---

### GET `/api/gallery`

갤러리 앨범 목록. 태그 기반 필터링 지원 (모바일 앱 호환).

- **인증**: 불필요
- **캐시**: ISR 1시간 (`revalidate: 3600`)
- **쿼리 파라미터**:
  - `tag` (반복 가능) — AND 필터. 모든 태그를 포함하는 앨범만 반환
  - `anyTag` (반복 가능) — OR 필터. 하나라도 포함하면 반환
  - `limit` — 최대 결과 수 (상한 100, `parseLimit()`)
- **응답**: `GalleryAlbum[]`

```
GET /api/gallery                                → 전체
GET /api/gallery?tag=교회학교&tag=영유치부       → AND 필터
GET /api/gallery?anyTag=예배&anyTag=교회행사      → OR 필터
GET /api/gallery?tag=봉사센터&limit=5             → 제한
```

---

### GET `/api/shorts`

쇼츠 작업 목록 조회. 각 job에 clips 배열 포함.

- **인증**: 선택. admin이면 모든 상태 조회 가능, 비인증/비admin이면 `published`만.
- **캐시**: 없음 (`revalidate: 0`)
- **쿼리 파라미터**:
  - `status` — 특정 상태 필터, admin 전용 (예: `ready_for_review`)
  - `published` — `true`이면 발행 완료 건만, admin 전용
  - `limit` — 최대 결과 수 (기본 20, 상한 100, `parseLimit()`)
- **응답**: `ShortsJobWithClips[]`

```
GET /api/shorts                           → 전체 (최신 20개)
GET /api/shorts?published=true&limit=10   → 발행된 쇼츠 (모바일용)
GET /api/shorts?status=ready_for_review   → 검수 대기 (Admin용)
```

---

### POST `/api/shorts/trigger`

GitHub Actions 워크플로우를 트리거하여 쇼츠 생성 파이프라인을 시작한다.

- **인증**: admin 역할 필수 (`requireAdmin()`)
- **요청 본문** (Zod 검증: `ShortsTriggerSchema`):

```ts
{
  videoId: string;         // max 50
  videoTitle: string;      // max 300
  videoPublishedAt?: string; // max 50
  videoThumbnail?: string; // max 2000
}
```

- **응답 (200)**: `{ jobId: string; status: "pending" }`
- **에러 응답**:
  - `400` — 필수 필드 누락 또는 형식 오류
  - `401` — 미인증
  - `403` — 비admin
  - `409` — 이미 해당 videoId로 작업 존재 (`{ error, jobId }`)
  - `500` — Job 생성 실패
  - `502` — GitHub Actions 트리거 실패

---

### POST `/api/shorts/[id]/approve`

쇼츠 클립을 승인한다.

- **인증**: admin 역할 필수
- **요청 본문**: 없음
- **응답 (200)**: `{ ok: true }`

---

### POST `/api/shorts/[id]/reject`

쇼츠 클립을 반려한다.

- **인증**: admin 역할 필수 (`requireAdmin()`)
- **요청 본문** (Zod 검증: `ShortsRejectSchema`): `{ note?: string }` (max 500자)
- **응답 (200)**: `{ ok: true }`
- **에러**: `400` — 반려 사유 500자 초과

---

### POST `/api/weeklies/generate-pdf`

주보 데이터를 기반으로 PDF를 자동 생성하고 Supabase Storage에 업로드한다.

- **인증**: admin 역할 필수
- **런타임**: `nodejs`
- **최대 실행 시간**: 60초 (`maxDuration = 60`)
- **요청 본문**:

```ts
{ weeklyId: string }
```

- **응답 (200)**:

```ts
{ pdfUrl: string }
```

- **에러 응답**:
  - `400` — `weeklyId` 누락
  - `401` — 미인증
  - `403` — 비admin
  - `404` — 해당 주보 없음
  - `500` — PDF 생성 실패 또는 Storage 업로드 실패

- **내부 동작**:
  1. `weeklyId`로 `weeklies` 테이블 조회
  2. `buildWeeklyHtml(weekly)` 호출 → A4 HTML 문자열 생성
  3. Puppeteer + `@sparticuz/chromium` → `page.pdf()` 호출
  4. 생성된 PDF Buffer → Supabase Storage `weeklies/{id}-generated.pdf` 업로드
  5. `weeklies` 테이블 `pdf_url` 컬럼 업데이트

- **환경변수**: `CHROME_EXECUTABLE_PATH` (개발 환경, 로컬 Chrome 경로)

---

### GET `/api/home/hero-slides`

홈페이지 히어로 슬라이더용 데이터. `notices` 테이블에서 이미지가 있는 공개 공지를 최신순으로 반환.
웹과 모바일 앱이 동일한 DTO를 소비하도록 설계됨 — 클라이언트는 이 엔드포인트만 호출하면 슬라이더를 렌더할 수 있다.

- **인증**: 불필요
- **캐시**: ISR 1시간 (`revalidate: 3600`)
- **쿼리 파라미터**:
  - `limit` — 최대 결과 수 (기본 5, 상한 100, `parseLimit()`)
- **응답**: `HeroSlide[]`

```ts
interface HeroSlide {
  id: string;        // notices.slug (React key + 모바일 딥링크 식별자)
  eyebrow: string;   // 카테고리 매핑 ("교회소식" | "긴급공지" | "교회행사")
  title: string;     // notices.title
  subtitle: string;  // 본문에서 [IMG:..] 제거 후 최대 80자 (초과 시 "…" 말줄임)
  image: string;     // notices.images[0] | 본문 첫 [IMG:url] (둘 다 없으면 슬라이드 제외)
  href: string;      // "/notice/{slug}" (웹/모바일 공용 경로)
  date: string | null; // notices.date (YYYY-MM-DD)
}
```

**데이터 선택 규칙**:
1. `notices.is_public = true`
2. `date` 내림차순
3. 이미지 추출 사슬: `images[0]` → 본문 첫 `[IMG:url]` → 슬라이드 제외
4. 최종 `limit`개 반환 (기본 5)

**예시**:
```
GET /api/home/hero-slides           → 최대 5개 슬라이드
GET /api/home/hero-slides?limit=3   → 최대 3개
```

---

### GET `/api/new-content`

홈/탭바의 레드닷 배지용 — 콘텐츠 최신 일자 4종을 스냅샷으로 반환.

- **인증**: 불필요
- **캐시**: ISR 10분 (`revalidate: 600`)
- **응답**: `NewContentDates`

```ts
interface NewContentDates {
  notices: string | null;  // 최신 공지 date
  sermons: string | null;  // 최신 YouTube 설교 publishedAt
  gallery: string | null;  // 최신 앨범 created_at
  weeklies: string | null; // 최신 주보 date
}
```

---

### GET `/api/calendar`

교회 Google Calendar에서 다가오는 이벤트를 조회한다.

- **인증**: 불필요
- **캐시**: ISR 10분 (`revalidate: 600`)
- **쿼리 파라미터**:
  - `limit` — 최대 결과 수 (기본 20, 상한 100, `parseLimit()`)
  - `days` — 오늘부터 며칠 후까지 (기본 60, 상한 365)
- **응답**: `CalendarEvent[]`

```ts
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;     // ISO 8601 또는 YYYY-MM-DD (종일)
  end: string;
  isAllDay: boolean;
  htmlLink: string;
}
```

```
GET /api/calendar                   → 향후 60일, 최대 20개
GET /api/calendar?limit=5&days=7    → 이번 주, 최대 5개
GET /api/calendar?days=30           → 이번 달
```

- **외부 API**: Google Calendar API v3 (공개 캘린더, API 키 인증)
- **에러**: API 키 미설정 또는 Google API 오류 시 빈 배열 `[]` 반환

### POST `/api/calendar`

Google Calendar에 이벤트를 생성한다.

- **인증**: admin 역할 필수 (`requireAdmin()`)
- **외부 API**: Google Calendar API v3 (Service Account JWT 인증)
- **요청 본문** (Zod 검증: `CalendarEventSchema`):

```ts
{
  title: string;         // max 200
  description?: string;  // max 5000
  location?: string;     // max 200
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  startTime?: string;    // HH:mm (없으면 종일)
  endTime?: string;      // HH:mm (없으면 종일)
}
```

- **응답 (201)**: `CalendarEvent`
- **에러**: `400`, `401`, `403`, `500`

---

### DELETE `/api/calendar/[id]`

Google Calendar에서 이벤트를 삭제한다.

- **인증**: admin 역할 필수 (`requireAdmin()`)
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `403`, `500`

---

## 입력 검증

모든 API 라우트의 입력 검증은 `src/lib/validation.ts`에 정의된 Zod 스키마로 수행.
모바일 앱에서 동일 API를 호출해도 동일한 검증이 적용됨.

| 엔드포인트 | Zod 스키마 | 비고 |
|-----------|-----------|------|
| POST `/api/weeklies/generate-pdf` | 없음 (body: `{ weeklyId }`) | admin 전용, Puppeteer PDF 생성 |
| POST `/api/revalidate` | `RevalidateSchema` | paths 최대 20개, 타이밍-세이프 시크릿 비교 |
| POST `/api/sermon-summary` | `SermonSummarySchema` | 모든 필드 길이 제한 |
| POST `/api/shorts/trigger` | `ShortsTriggerSchema` | videoId 50자, title 300자 |
| POST `/api/shorts/[id]/reject` | `ShortsRejectSchema` | note 500자 |
| GET `/api/gallery` | `parseLimit()` | limit 상한 100 |
| GET `/api/shorts` | `parseLimit()` | limit 상한 100 |
| GET `/api/calendar` | `parseLimit()` | limit 상한 100, days 상한 365 |
| GET `/api/home/hero-slides` | `parseLimit()` | limit 기본 5, 상한 100 |

---

## 보안 헤더

`next.config.ts`의 `headers()` 함수에서 전역 적용:

- `Content-Security-Policy` — 허용 출처 제한 (self + YouTube + Supabase + Gemini)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 주보 마스터 데이터 (REST 엔드포인트 없음)

주보 5개 마스터 테이블(`church_settings`, `mokjang_entries`, `servants`,
`support_sections`, `community_prayers`)은 **전용 REST API를 두지 않고**
브라우저 Supabase 클라이언트(`@/lib/supabase/client`)에서 직접 CRUD한다.

- **인증/권한**: Supabase RLS — public SELECT 허용, CUD는 `profiles.role='admin'` 체크
- **관리 페이지**: `/admin/masters/{topic|mokjang|servants|supports|community-prayers}`
- **공개 조회**: Server Component에서 `loadBulletinMaster(supabase)` (5개 테이블 병렬 SELECT)
- **검증**: 저장 전 클라이언트에서 `src/lib/validation.ts`의 Zod 스키마로 `.safeParse()`

이 설계 이유: (1) 관리자 전용 단순 CRUD이므로 RLS로 충분, (2) Weekly와 달리
단일 리소스가 아니라 5개 독립 테이블이라 REST 라우트가 과함, (3) Live Reference 패턴으로
즉시 반영이 필요.

---

## 서버 사이드 데이터 함수

API 라우트 외에 Server Component에서 직접 호출하는 데이터 함수:

| 함수 | 파일 | 설명 |
|------|------|------|
| `loadBulletinMaster(supabase)` | `src/lib/bulletin-master.ts` | 주보 마스터 5개 테이블 병렬 SELECT → `BulletinMasterData` |
| `loadWeeklyWithMaster(supabase, id)` | `src/lib/bulletin-master.ts` | 주보 1건 + 마스터 동시 로드 |
| `getNotices()` | `src/lib/notices.ts` | 공개 공지사항 목록 (날짜 역순) |
| `getNoticeBySlug(slug)` | `src/lib/notices.ts` | 단건 공지 조회 |
| `getHeroSlides(limit)` | `src/lib/notices.ts` | 홈 히어로 슬라이드 (이미지 보유 공지 → HeroSlide[]) |
| `getWeeklies()` | `src/lib/notices.ts` | 발행된 주보 목록 (`is_published=true`, 최근 20개) |
| `getWeeklyById(id)` | `src/lib/notices.ts` | 주보 단건 조회 (관리자 편집용) |
| `getGalleryAlbums(options?)` | `src/lib/gallery.ts` | 공개 앨범 + 이미지 (태그 필터 지원) |
| `getSermonVideos(max)` | `src/lib/youtube.ts` | YouTube RSS 설교 목록 |
| `getLatestSermon()` | `src/lib/youtube.ts` | 최신 설교 1건 |
| `summarizeSermonFromVideo(sermon)` | `src/lib/gemini.ts` | Gemini 설교 요약 |
| `callGeminiWithFallback(prompt)` | `src/lib/gemini.ts` | 범용 Gemini 호출 (폴백+재시도) |
| `requireAdmin()` | `src/lib/admin-auth.ts` | API 라우트 admin 인증 헬퍼 |
| `getUpcomingEvents(max, days)` | `src/lib/google-calendar.ts` | Google Calendar 다가오는 이벤트 |
| `getAllEvents(max)` | `src/lib/google-calendar.ts` | 관리자용 이벤트 목록 (과거 30일 포함) |
| `createCalendarEvent(input)` | `src/lib/google-calendar.ts` | 이벤트 생성 (Service Account) |
| `deleteCalendarEvent(id)` | `src/lib/google-calendar.ts` | 이벤트 삭제 (Service Account) |
| `validateFile(file, exts, maxSize)` | `src/lib/validation.ts` | 파일 업로드 검증 (타입 + 크기) |
| `safeExtension(filename, allowed)` | `src/lib/validation.ts` | 안전한 확장자 추출 |
| `parseLimit(raw, fallback)` | `src/lib/validation.ts` | limit 파라미터 파싱 (상한 100) |

---

## 인증 흐름

- **Supabase Auth** (이메일/비밀번호)
- 클라이언트: `createBrowserClient` (`src/lib/supabase/client.ts`)
- 서버: `createServerClient` + cookies (`src/lib/supabase/server.ts`)
- 미들웨어: `/groups/*`, `/profile/*`, `/admin/*` 보호

## 외부 서비스

| 서비스 | 용도 | 환경변수 |
|--------|------|----------|
| Supabase | DB + Auth + Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| YouTube Data API v3 | 설교 영상 목록 | `YOUTUBE_API_KEY` |
| Google Gemini | AI 설교 요약 + 쇼츠 하이라이트 | `GEMINI_API_KEY` |
| Next.js ISR | 캐시 무효화 | `REVALIDATE_SECRET` |
| Google Maps Embed | 찾아오시는 길 | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` |
| Google Calendar API v3 | 교회 일정 조회/생성/삭제 | `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY` |
| GitHub Actions | 쇼츠 생성 파이프라인 | `GITHUB_PAT` |
| Puppeteer + @sparticuz/chromium | 주보 PDF 자동 생성 | `CHROME_EXECUTABLE_PATH` (개발 환경만, 선택) |
