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

## 입력 검증

모든 API 라우트의 입력 검증은 `src/lib/validation.ts`에 정의된 Zod 스키마로 수행.
모바일 앱에서 동일 API를 호출해도 동일한 검증이 적용됨.

| 엔드포인트 | Zod 스키마 | 비고 |
|-----------|-----------|------|
| POST `/api/revalidate` | `RevalidateSchema` | paths 최대 20개, 타이밍-세이프 시크릿 비교 |
| POST `/api/sermon-summary` | `SermonSummarySchema` | 모든 필드 길이 제한 |
| POST `/api/shorts/trigger` | `ShortsTriggerSchema` | videoId 50자, title 300자 |
| POST `/api/shorts/[id]/reject` | `ShortsRejectSchema` | note 500자 |
| GET `/api/gallery` | `parseLimit()` | limit 상한 100 |
| GET `/api/shorts` | `parseLimit()` | limit 상한 100 |

---

## 보안 헤더

`next.config.ts`의 `headers()` 함수에서 전역 적용:

- `Content-Security-Policy` — 허용 출처 제한 (self + YouTube + Supabase + Gemini)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 서버 사이드 데이터 함수

API 라우트 외에 Server Component에서 직접 호출하는 데이터 함수:

| 함수 | 파일 | 설명 |
|------|------|------|
| `getNotices()` | `src/lib/notices.ts` | 공개 공지사항 목록 (날짜 역순) |
| `getNoticeBySlug(slug)` | `src/lib/notices.ts` | 단건 공지 조회 |
| `getWeeklies()` | `src/lib/notices.ts` | 주보 목록 (최근 20개) |
| `getGalleryAlbums(options?)` | `src/lib/gallery.ts` | 공개 앨범 + 이미지 (태그 필터 지원) |
| `getSermonVideos(max)` | `src/lib/youtube.ts` | YouTube RSS 설교 목록 |
| `getLatestSermon()` | `src/lib/youtube.ts` | 최신 설교 1건 |
| `summarizeSermonFromVideo(sermon)` | `src/lib/gemini.ts` | Gemini 설교 요약 |
| `callGeminiWithFallback(prompt)` | `src/lib/gemini.ts` | 범용 Gemini 호출 (폴백+재시도) |
| `requireAdmin()` | `src/lib/admin-auth.ts` | API 라우트 admin 인증 헬퍼 |
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
| GitHub Actions | 쇼츠 생성 파이프라인 | `GITHUB_PAT` |
