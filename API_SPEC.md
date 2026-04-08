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
- **요청 본문**:

```ts
{
  sermon: SermonVideo;
  saveAsNotice: boolean;
}
```

- **응답 (200)**:

```ts
{ summary: string }
```

- **에러 응답**:
  - `401` — `{ error: "로그인이 필요합니다." }`
  - `403` — `{ error: "관리자 권한이 필요합니다." }`
  - `500` — `{ error: string }`

- **부작용**: `saveAsNotice: true`이면 `notices` 테이블에 upsert (`slug: sermon-{videoId}`)

---

### POST `/api/revalidate`

온디맨드 ISR 캐시 무효화.

- **인증**: 시크릿 토큰 (`REVALIDATE_SECRET`)
- **요청 본문**:

```ts
{
  secret: string;
  paths: string[]; // e.g. ["/", "/sermons"]
}
```

- **응답 (200)**: `{ revalidated: true }`
- **에러**: `401` (잘못된 시크릿)

---

### GET `/api/og?title={title}`

동적 OpenGraph 이미지 생성.

- **런타임**: Edge
- **인증**: 불필요
- **쿼리 파라미터**: `title` (선택, 기본값: "명성비전교회")
- **응답**: `ImageResponse` (1200x630 PNG)

---

### GET `/api/gallery`

갤러리 앨범 목록. 태그 기반 필터링 지원 (모바일 앱 호환).

- **인증**: 불필요
- **캐시**: ISR 1시간 (`revalidate: 3600`)
- **쿼리 파라미터**:
  - `tag` (반복 가능) — AND 필터. 모든 태그를 포함하는 앨범만 반환
  - `anyTag` (반복 가능) — OR 필터. 하나라도 포함하면 반환
  - `limit` — 최대 결과 수
- **응답**: `GalleryAlbum[]`

```
GET /api/gallery                                → 전체
GET /api/gallery?tag=교회학교&tag=영유치부       → AND 필터
GET /api/gallery?anyTag=예배&anyTag=교회행사      → OR 필터
GET /api/gallery?tag=봉사센터&limit=5             → 제한
```

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
| YouTube RSS | 설교 영상 | 없음 (공개 피드) |
| Google Gemini | AI 설교 요약 | `GEMINI_API_KEY` |
| Next.js ISR | 캐시 무효화 | `REVALIDATE_SECRET` |
