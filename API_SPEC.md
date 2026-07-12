# API 명세

## 개요

Next.js App Router 기반 API 라우트. 모든 엔드포인트는 `/api/` 하위에 위치.

---

## 엔드포인트

### GET `/api/sermons`

설교 영상 목록을 `sermon_videos` 테이블에서 조회 (마이그레이션 032).
이전에는 매 호출마다 YouTube API를 직접 fetch 했으나, 새 영상이 들어올수록 옛 영상이
top-N에서 밀려나 화면에서 사라지는 문제가 있어 DB 누적 구조로 전환됨.
YouTube fetch 는 `/api/admin/cron/sync-sermons` 가 대신 매일 1회 수행한다.

- **인증**: 불필요
- **응답**: `SermonVideo[]` — `published_at DESC`, 최대 50건

```ts
interface SermonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string; // ISO 8601
}
```

- **캐시**: 라우트 자체 캐시 없음 — 데이터 함수(`getSermonVideos`)가 단순 SELECT
- **최대 결과**: 50개

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

### GET `/api/liturgical/today`

오늘(KST) 기준 절기와 색상 토큰. 인증 불필요. 모바일 호환 안정 스키마.

- **인증**: 불필요
- **쿼리 파라미터**: 없음
- **응답 (200)**:

```ts
interface LiturgicalTodayResponse {
  date: string;          // YYYY-MM-DD (KST)
  season: LiturgicalSeason;
  seasonKo: string;
  week: number | null;   // "사순 4주"의 4
  isOrdinary: boolean;
  color: { base: string; soft: string; strong: string; onBase: string };
  /** 브랜드 액센트용. 평주일에는 church-gold 로 fallback */
  brand: { base: string; soft: string; strong: string };
  rangeStart: string;
  rangeEnd: string;
}

type LiturgicalSeason =
  | "advent" | "christmas" | "epiphany" | "ordinary_after_epiphany"
  | "lent" | "holy_week" | "good_friday" | "easter"
  | "pentecost" | "trinity" | "ordinary_after_pentecost" | "reformation";
```

- **캐시**: `revalidate=3600` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- **모바일 호환 계약**: 응답 필드 추가는 허용, 삭제·이름·타입 변경 금지

---

### GET `/api/liturgical/events`

지정 범위의 큰 절기(부활/성탄/대림 등) 가상 캘린더 이벤트.

- **인증**: 불필요
- **쿼리 파라미터**:
  - `start` (필수) — `YYYY-MM-DD`
  - `end` (필수) — `YYYY-MM-DD`, `start` 이상
- **응답 (200)**: `{ items: CalendarEvent[] }` — 각 아이템에 `liturgical: { season, colorSoft, colorStrong }` 옵션 채워짐
- **응답 (400)**: `{ error: string }` — 파라미터 형식 오류
- **캐시**: 동일
- **부작용**: 없음 (계산 전용, DB 무접근)
- **호환 노트**: 응답 아이템이 `CalendarEvent` 스키마이므로 모바일 캘린더가 일반 이벤트로 그대로 표시 가능. `liturgical` 필드 무시해도 안전.

---

### GET `/api/updates`

루트 `UPDATES.md` 파일을 파싱해 업데이트 노트(릴리스 노트)를 JSON으로 반환한다.
**향후 모바일 앱이 동일 URL을 인증 없이 호출** — 스키마 안정성을 보증한다.

- **인증**: 불필요
- **쿼리 파라미터** (모두 선택):
  - `limit` — 1~50 정수, 기본 20
  - `since` — `YYYY-MM-DD`, 해당 날짜 이후 항목만 (포함)
- **필터링**: `<!-- staff-only -->` 주석이 있는 항목은 서버에서 **제외** (관리자 대시보드/`/admin/updates` 에만 노출)
- **응답 (200)**:

```ts
interface PublicUpdateItem {
  date: string;     // YYYY-MM-DD (KST 의미)
  title: string;
  body: string;     // 마크다운 본문 (메타 주석 제거 후)
  highlight: boolean;
}

interface UpdatesResponse {
  items: PublicUpdateItem[];
}
```

- **캐시**: `revalidate = 3600` + `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`
- **부작용**: 없음 (read-only)
- **모바일 호환 계약**: 응답 필드 추가는 허용, 삭제/이름 변경/타입 변경 금지

**예시 호출**

```bash
curl https://www.msvch.org/api/updates?limit=10&since=2026-05-01
```

---

### POST `/api/revalidate`

온디맨드 ISR 캐시 무효화 (서버-서버용 — naver-blog-sync 스크립트, 외부 cron 등).

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

### GET `/api/me`

현재 로그인 사용자의 인증 상태와 권한을 반환. 클라이언트 헤더의 로그인/로그아웃 토글, admin 진입 버튼 노출, 컨텐츠 삭제 권한 가드 등에서 사용.

- **인증**: 선택. 비인증 시 `authenticated: false` 반환
- **인증 방식**: 쿠키(웹) **OR** `Authorization: Bearer <access_token>`(모바일 앱) — `createApiClient(request)` 헬퍼가 자동 분기
- **캐시**: 없음 (`Cache-Control: no-store`, `dynamic: "force-dynamic"`)
- **응답**: `MeResponse`

```ts
interface MeResponse {
  authenticated: boolean;
  userId: string | null;        // auth.users.id (UUID), 미인증 시 null
  role: string | null;          // 'member' | 'staff' | 'admin' | 'master', 미인증 시 null
  isStaff: boolean;             // staff/admin/master 중 하나면 true (admin UI 접근 가능 권한)
  isAdminOrMaster: boolean;     // 모든 컨텐츠 삭제 가능한 권한
}
```

**예시**:
```
# 웹 (쿠키 자동)
GET /api/me

# 모바일 앱
GET /api/me
Authorization: Bearer eyJhbGc...
```

---

### GET `/api/admin/event-subscribers`

일정 알림 수신자 목록 조회 (admin/master).

- **인증**: staff (`requireAdmin()`) — RLS 상 staff SELECT 가능
- **응답**: `EventSubscriber[]`

```ts
interface EventSubscriber {
  id: string;
  name: string;
  phone: string;          // 010-XXXX-XXXX
  isActive: boolean;
  notifyD1: boolean;      // D-1 알림
  notifyDDay: boolean;    // D-day 알림
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### POST `/api/admin/event-subscribers`

수신자 등록.

- **인증**: admin/master (RLS — `is_admin_or_master()`)
- **요청 본문** (Zod 검증: `EventSubscriberSchema`):

```ts
{
  name: string;           // 1~100
  phone: string;          // 자동 정규화 (다양한 입력 → 010-XXXX-XXXX)
  isActive?: boolean;     // 기본 true
  notifyD1?: boolean;     // 기본 true
  notifyDDay?: boolean;   // 기본 false
  note?: string;          // max 500
}
```

- **응답 (201)**: `EventSubscriber`
- **에러**:
  - `400` — 형식 오류 / 휴대폰 번호 형식 오류
  - `401`, `403` — 권한
  - `409` — 이미 등록된 전화번호 (UNIQUE 제약)

### PATCH `/api/admin/event-subscribers/[id]`

수신자 정보 수정 (필드별 옵셔널).

- **인증**: admin/master
- **요청 본문**: 위 스키마의 partial
- **응답 (200)**: `{ ok: true }`

### DELETE `/api/admin/event-subscribers/[id]`

수신자 삭제.

- **인증**: admin/master
- **응답 (200)**: `{ ok: true }`

---

### GET `/api/admin/cron/alimtalk-events`

Vercel Cron 엔드포인트 — 다음 날(D-1) 일정 중 `notify=true` 인 건을 활성 구독자(`notify_d1=true`)에게 알림톡 발송.

- **인증**: `x-cron-secret` 헤더 OR `Authorization: Bearer <CRON_SECRET>` (`crypto.timingSafeEqual` 비교)
- **스케줄**: 매일 06:00 KST (`vercel.json` — `0 21 * * *` UTC)
- **동작**:
  1. D-1 일자의 `events.notify=true` 일정 조회
  2. 활성 구독자(`is_active=true AND notify_d1=true`) 조회
  3. `alimtalk_sent` 에 미기록 (event_id × recipient) 조합만 `sendAlimtalk()` 호출
  4. 결과 status (`sent`/`failed`/`noop`) 와 함께 `alimtalk_sent` 기록
- **카카오 비즈 미설정 시**: `sendAlimtalk` 가 `noop` 반환 → 추적만 기록되고 실 발송 없음
- **응답 (200)**:

```ts
{
  template: "event_d1";
  targetDate: string;             // YYYY-MM-DD
  events: number;
  subscribers: number;
  sent: number;
  failed: number;
  noop: number;
  skipped_already_sent: number;
}
```

- **에러**:
  - `401` — 시크릿 불일치
  - `500` — Supabase env 누락 / 조회 실패

---

### GET `/api/admin/cron/sync-sermons`

Vercel Cron 엔드포인트 — YouTube 업로드 플레이리스트에서 최근 50개 영상을 받아 `sermon_videos` 테이블에 upsert (마이그레이션 032).
표시용 코드(`/api/sermons`, 홈/설교 페이지)는 이 테이블만 읽으므로, 한 번 들어온 영상은 영구 보존된다.

- **인증**: `x-cron-secret` 헤더 OR `Authorization: Bearer <CRON_SECRET>` (`crypto.timingSafeEqual` 비교)
- **스케줄**: 매일 15:00 KST (`vercel.json` — `0 6 * * *` UTC)
- **최대 실행 시간**: 60초 (`maxDuration = 60`)
- **동작**:
  1. `fetchYouTubeUploads(50)` 로 YouTube Data API v3 `playlistItems.list` 호출 (channel uploads playlist)
  2. 응답 영상마다 `categorizeSermon(title)` 으로 sunday/wednesday/friday/dawn/praise/all 분류
  3. 기존 `video_id` 조회 후 신규 카운트 계산
  4. `sermon_videos` upsert (`onConflict: video_id`) — 신규 행은 추가, 기존 행은 메타데이터(title/thumbnail 등)만 갱신
- **응답 (200)**:

```ts
{
  fetched: number;       // YouTube 응답 영상 수
  upserted: number;      // DB 반영된 행 수 (= fetched, 실패 시 0)
  inserted_new: number;  // 그 중 신규로 추가된 행 수
  error?: string;        // 0건 fetch / upsert 실패 시 메시지
}
```

- **에러**:
  - `401` — 시크릿 불일치
  - `500` — Supabase env 누락 / upsert 실패

- **수동 트리거** (배포 직후 첫 백필 등):
  ```bash
  curl -H "x-cron-secret: $CRON_SECRET" https://www.msvch.org/api/admin/cron/sync-sermons
  ```

---

### PATCH `/api/admin/members`

회원의 role 을 변경한다 (master 단독 권한).

- **인증**: master 권한 (`requireMaster()`) — 쿠키 또는 Bearer
- **요청 본문**:

```ts
{
  id: string;    // 대상 user id (UUID)
  role: "member" | "staff" | "admin" | "master";
}
```

- **응답 (200)**: `{ ok: true }`
- **에러**:
  - `400` — 유효하지 않은 입력 / 자기 자신의 권한 변경 시도
  - `401` — 미인증
  - `403` — 비 master
  - `500` — DB 에러

---

### POST `/api/admin/revalidate`

관리자 UI 전용 revalidate — 시크릿 노출 없이 세션 인증으로 ISR 캐시를 무효화.
`/admin/notices`에서 히어로 이미지 교체/공개 토글 등을 할 때 홈 `/`와 모바일 엔드포인트 `/api/home/hero-slides`를 즉시 갱신하기 위해 사용.

- **인증**: admin 또는 staff 세션 (`requireAdmin()`) — 쿠키 또는 `Authorization: Bearer` 헤더
- **요청 본문** (Zod 검증 내부):

```ts
{
  paths: string[]; // max 20개, 각 `'/'`로 시작, max 500자
}
```

- **응답 (200)**: `{ revalidated: true }`
- **에러**:
  - `400` — 잘못된 요청 형식
  - `401` — 미인증
  - `403` — 비 admin/staff

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

> ℹ️ 카테고리 / 하위부서 목록은 `src/lib/gallery-categories.ts` 가 단일 출처. 관리자 페이지의
> 앨범 메타 편집은 별도 REST 라우트 없이 클라이언트 supabase 가 `gallery_albums` 를
> 직접 UPDATE 한다 (RLS: staff 통과 + UI: `canEdit` 으로 작성자/admin+ 게이트).

---

### GET `/api/gallery/[id]/images`

특정 앨범의 이미지 목록.

- **인증**: 불필요 (RLS 가 공개 SELECT)
- **응답**: `GalleryImage[]` — `sort_order ASC`

---

### POST `/api/chat`

Gemini 기반 챗봇 — 최근 공지 10건을 system prompt 에 동적으로 주입.

- **인증**: 불필요
- **Rate limit** (`src/lib/rate-limit.ts`): IP 당 분당 10건 / 일 100건. 초과 시 `429 Retry-After`
- **메시지 한도**: 1건당 500자, 히스토리 최대 20턴 (초과 시 자동 슬라이스)
- **모델 폴백**: `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-flash-latest`, 각 모델 429/5xx 시 exponential backoff 3회
- **요청 본문**:
  ```ts
  { messages: { role: "user" | "model"; content: string }[] }
  ```
- **응답 (200)**: `{ reply: string }`
- **응답 (400)**: 메시지 없음 / 형식 오류 / 길이 초과
- **응답 (429)**: rate limit 초과
- **응답 (503)**: Gemini 폴백 전체 실패 (`GeminiUnavailableError`)

---

### POST `/api/chat/inquiry`

챗봇 안에서 "문의 남기기" 클릭 시 사용. `chat_inquiries` INSERT + (`RESEND_API_KEY` 설정 시) Resend 이메일 알림.

- **인증**: 불필요 (service_role INSERT, RLS anon INSERT 허용)
- **Rate limit**: IP 당 분당 2건 / 일 10건 (`windowKey: "inquiry"`, 챗봇 본문보다 타이트)
- **요청 본문** (Zod):
  ```ts
  { name: string;       // 1~50
    phone: string;      // 9~20
    message?: string }  // ≤ 500
  ```
- **응답 (200)**: `{ ok: true }`
- **이메일 알림**: `RESEND_API_KEY` 가 있을 때만. 모든 사용자 입력은 `escapeHtml` 통과(인젝션 차단). 실패 시 silent (DB 저장은 성공으로 처리)

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
  sermons: string | null;  // 최신 설교 publishedAt — sermon_videos 테이블에서 1건 (마이그레이션 032)
  gallery: string | null;  // 최신 앨범 created_at
  weeklies: string | null; // 최신 주보 date
}
```

---

### GET `/api/calendar`

자체 DB(`events` 테이블)에서 다가오는 일정을 조회. 마이그레이션 022 이후 Google Calendar 의존 제거.

- **인증**: 불필요
- **캐시**: 없음 (`dynamic: "force-dynamic"`)
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
  /** ISO 8601 datetime (KST +09:00) 또는 YYYY-MM-DD (종일) */
  start: string;
  /** ISO 8601 / YYYY-MM-DD / null. null = 종료시간 미정/오픈엔드 */
  end: string | null;
  isAllDay: boolean;
  /** RRULE — v2 예정, v1 항상 null */
  recurrence: string | null;
  /** 알림톡 발송 대상 표시 (관리 UI 용) */
  notify: boolean;
}
```

```
GET /api/calendar                   → 향후 60일, 최대 20개
GET /api/calendar?limit=5&days=7    → 이번 주, 최대 5개
GET /api/calendar?days=30           → 이번 달
```

### POST `/api/calendar`

자체 DB 에 일정을 생성. 작성자(`created_by`) 자동 기록 + `content_authors` 트리거.

- **인증**: staff/admin/master (`requireAdmin()`) — 쿠키 또는 Bearer
- **요청 본문** (Zod 검증: `CalendarEventSchema`):

```ts
{
  title: string;         // 1~200
  description?: string;  // max 5000
  location?: string;     // max 200
  date: string;          // YYYY-MM-DD (필수)
  startTime?: string;    // HH:mm — 미지정 = 종일
  endTime?: string;      // HH:mm — 미지정 = 미정/오픈엔드
  notify?: boolean;      // 알림톡 발송 대상 (기본 false)
}
```

- **검증 규칙**: `endTime` 만 있고 `startTime` 없으면 거부. `endTime <= startTime` 거부.
- **응답 (201)**: `CalendarEvent`
- **에러**: `400`, `401`, `403`, `500`

### PATCH `/api/calendar/[id]`

일정을 수정. 모든 필드 옵셔널, 보낸 필드만 갱신.

- **인증**: staff (`requireAdmin()`)
- **요청 본문**: `CalendarEventSchema.partial()` 와 동일 + 동일 일관성 검증
- **응답 (200)**: `{ ok: true }`
- **에러**: `400`, `401`, `403`, `500`

### DELETE `/api/calendar/[id]`

일정을 삭제. RLS 정책상 **작성자 본인 OR admin OR master** 만 통과 (021 패턴 / 022 적용).

- **인증**: staff (`requireAdmin()`) — 추가로 RLS 가 작성자 매칭
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `403`, `500`

---

### POST `/api/new-family`

공개 새가족 등록 폼 제출. `chat_inquiries` 와 동일한 익명 INSERT 패턴 (RLS `with check (true)` + 서버측 service_role).

- **인증**: 불필요 (공개)
- **요청 본문** (Zod 검증: `NewFamilyRegistrationSchema` + 추가 룰):

```ts
{
  visitPaths: ("website" | "youtube" | "recommendation" | "visited_first" | "etc")[];
  visitPathsEtc?: string;          // visitPaths 에 'etc' 포함 시 필수 (서버 추가 검증)
  faithStatus: "accepted" | "not_yet" | "unsure";
  name: string;                     // 1~50자
  gender: "male" | "female";
  birth: string;                    // 1~40자, 자유 텍스트 (음력 표기 허용)
  phone: string;                    // 9~20자, 010-XXXX-XXXX 권장
  region?: string;                  // ≤100자
  churchHistory: "never" | "attended_no_baptism" | "baptized_inactive" | "baptized_active" | "etc";
  churchHistoryEtc?: string;        // churchHistory === 'etc' 일 때 필수
  message?: string;                 // ≤2000자
  privacyConsent: true;             // 반드시 true (literal). false 자동 거부.
}
```

- **응답 (200)**: `{ ok: true }`
- **에러 응답**:
  - `400` — `{ error: "..." }` (zod 첫 issue 메시지 / "기타" 직접 입력 누락)
  - `500` — `{ error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." }`

- **부작용**: `new_family_registrations` 행 생성. `privacy_consent: true`, `privacy_consented_at: now()` 서버에서 강제 기록.

---

### GET `/api/admin/new-families`

관리자용 새가족 등록 목록.

- **인증**: staff/admin/master (`requireAdmin()`) — cookie 또는 `Authorization: Bearer <jwt>`
- **응답 (200)**: `NewFamilyRegistration[]` (camelCase, `created_at DESC`)

```ts
interface NewFamilyRegistration {
  id: string;
  visitPaths: NewFamilyVisitPath[];
  visitPathsEtc: string | null;
  faithStatus: NewFamilyFaithStatus;
  name: string;
  gender: NewFamilyGender;
  birth: string;
  phone: string;
  region: string | null;
  churchHistory: NewFamilyChurchHistory;
  churchHistoryEtc: string | null;
  message: string | null;
  privacyConsent: boolean;
  privacyConsentedAt: string;       // ISO 8601
  status: NewFamilyStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- **에러**: `401`, `403`, `500`

---

### PATCH `/api/admin/new-families/[id]`

처리 상태 또는 관리자 메모 변경 (부분 업데이트).

- **인증**: staff (`requireAdmin()`) + RLS `is_staff()`
- **요청 본문** (Zod: `NewFamilyUpdateSchema`):

```ts
{
  status?: "new" | "contacted" | "assigned" | "done";
  adminNote?: string;               // ≤2000자, 빈 문자열은 NULL 로 정규화
}
```

- **응답 (200)**: 갱신된 `NewFamilyRegistration` DTO
- **에러**: `400` (수정 내용 없음 / zod), `401`, `403`, `500`

---

### DELETE `/api/admin/new-families/[id]`

새가족 등록 삭제. RLS 정책상 **admin 또는 master** 만 통과.

- **인증**: staff (`requireAdmin()`) — 추가로 RLS 가 admin/master 검증
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `403`, `500`

---

## 소모임 게시판 (마이그레이션 025)

ad-hoc 멤버 모델 — admin 이 제목 입력으로 신설하고 멤버를 임의 지정. `is_visible=false` 로 숨김 가능.
**모든 엔드포인트가 `createApiClient(request)` 사용 — 쿠키(웹) 또는 `Authorization: Bearer`(모바일) 자동 분기.**
응답 DTO 는 모두 camelCase, 페이지네이션은 cursor 기반.

### 공용 DTO

```ts
interface Board {
  id: string;
  title: string;
  description: string | null;
  isVisible: boolean;
  memberCount: number;
  postCount: number;
  createdAt: string;        // ISO 8601
  updatedAt: string;
}

interface BoardMember {
  profileId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

interface BoardPost {
  id: string;
  boardId: string;
  authorId: string | null;
  authorName: string;       // 작성 시점 닉네임 스냅샷
  title: string;
  content: string;
  images: string[];         // Supabase Storage public URL
  commentCount: number;
  canDelete: boolean;       // 서버 계산: admin/master OR 본인
  createdAt: string;
  updatedAt: string;
}

interface BoardComment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  canDelete: boolean;
  createdAt: string;
}

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;  // null = 끝. 다음 호출 ?cursor=<값>
}
```

---

### GET `/api/admin/boards`

전체 게시판 목록 (admin 은 RLS 상 숨김 포함 모두 노출).

- **인증**: staff (`requireAdmin()`)
- **응답 (200)**: `Board[]` (created_at DESC)
- **에러**: `401`, `403`, `500`

### POST `/api/admin/boards`

게시판 신설. 옵션으로 초기 멤버 동시 등록.

- **인증**: staff
- **요청 본문** (`BoardCreateSchema`):

```ts
{
  title: string;            // 1~100
  description?: string;     // ≤500
  initialMemberIds?: string[]; // ≤500개 (UUID)
}
```

- **응답 (201)**: `Board`
- **에러**: `400`, `401`, `403`, `500`

### PATCH `/api/admin/boards/[id]`

제목/설명/숨김 부분 업데이트.

- **인증**: staff
- **요청 본문** (`BoardUpdateSchema`):

```ts
{
  title?: string;
  description?: string;
  isVisible?: boolean;
}
```

- **응답 (200)**: `{ ok: true }`
- **에러**: `400`, `401`, `403`, `500`

### DELETE `/api/admin/boards/[id]`

영구 삭제. CASCADE 로 board_members/posts/comments 모두 사라짐. Storage 파일은 별도 정리 필요(v2 cron).

- **인증**: staff (RLS 가 admin/master 검증)
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `403`, `500`

### GET `/api/admin/boards/[id]/members`

게시판 멤버 목록.

- **인증**: staff
- **응답 (200)**: `BoardMember[]` (added_at ASC)

### PUT `/api/admin/boards/[id]/members`

멤버 명단 일괄 교체. 기존과 새 명단을 비교해 추가/제거 자동 계산.

- **인증**: staff (RLS 가 admin/master 검증)
- **요청 본문** (`BoardMembersReplaceSchema`):

```ts
{
  profileIds: string[]; // ≤500개 (UUID). 빈 배열이면 전체 멤버 제거
}
```

- **응답 (200)**: `{ ok: true; added: number; removed: number }`
- **에러**: `400`, `401`, `403`, `500`

---

### GET `/api/boards`

내가 볼 수 있는 게시판 목록 (멤버 OR admin/master + is_visible=true; admin/master 는 숨김도 보임).

- **인증**: 로그인 필수
- **응답 (200)**: `Board[]`
- **에러**: `401`

### GET `/api/boards/[id]/posts`

게시판 글 목록 — cursor 페이지네이션.

- **인증**: 로그인 필수 (RLS 가 멤버 게이트)
- **쿼리 파라미터**:
  - `limit` — 기본 20, 상한 100 (`parseLimit()`)
  - `cursor` — `${ISO_DATETIME}|${id}` 형식. 첫 호출 시 미지정
- **응답 (200)**: `CursorPage<BoardPost>`
- **에러**: `401`

```
GET /api/boards/{id}/posts                        → 첫 페이지 (최신 20개)
GET /api/boards/{id}/posts?cursor=...&limit=20   → 다음 페이지
```

### POST `/api/boards/[id]/posts`

새 글 작성. 서버가 `author_id = auth.uid()` 강제.

- **인증**: 로그인 필수 (RLS 가 멤버 게이트)
- **요청 본문** (`BoardPostSchema`):

```ts
{
  title: string;        // 1~150
  content: string;      // 1~10,000
  images?: string[];    // ≤10. 반드시 board-images 버킷 public URL
}
```

- **응답 (201)**: `BoardPost`
- **에러**: `400`, `401`, `403`(비멤버 — RLS 차단)

### GET `/api/boards/[id]/posts/[postId]`

글 + 댓글 일괄 조회.

- **인증**: 로그인 필수
- **응답 (200)**: `{ post: BoardPost; comments: BoardComment[] }`
- **에러**: `401`, `404`

### PATCH `/api/boards/[id]/posts/[postId]`

본인 글 수정 (RLS 가 author 검증).

- **인증**: 로그인 필수
- **요청 본문**: `Partial<BoardPostSchema>` — 보낸 필드만 갱신
- **응답 (200)**: `BoardPost`
- **에러**: `400`, `401`, `403`(비작성자)

### DELETE `/api/boards/[id]/posts/[postId]`

글 삭제. RLS 가 admin/master OR author 검증.

- **인증**: 로그인 필수
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `500`

### POST `/api/boards/[id]/posts/[postId]/comments`

댓글 작성.

- **인증**: 로그인 필수 (RLS 가 멤버 게이트)
- **요청 본문** (`BoardCommentSchema`):

```ts
{
  content: string; // 1~1,000
}
```

- **응답 (201)**: `BoardComment`
- **에러**: `400`, `401`, `403`(비멤버)

### DELETE `/api/boards/[id]/posts/[postId]/comments/[cid]`

댓글 삭제. RLS 가 admin/master OR author 검증.

- **인증**: 로그인 필수
- **응답 (200)**: `{ ok: true }`
- **에러**: `401`, `500`

### 이미지 업로드 (클라이언트 → Supabase Storage 직접)

API 라우트가 아닌 **Supabase Storage 직접 업로드** 패턴 — 웹/모바일 동일.

```ts
// 웹 (현재 코드)
const path = `${boardId}/${userId}/${Date.now()}-${random}.${ext}`;
await supabase.storage.from("board-images").upload(path, file, { contentType });
const { data } = supabase.storage.from("board-images").getPublicUrl(path);
// → 그 다음 POST /api/boards/{id}/posts body.images = [data.publicUrl]
```

Storage RLS 가 멤버 여부 검증 — 비멤버는 upload 시점에 차단. board_posts INSERT 시 RLS 가 다시 검증해 타 게시판 끼워넣기 방지.

**제한 (앱 레벨)**: 5MB 압축, jpg/png/webp/gif, 한 글당 최대 10장.

---

## 포스터 도구

행사·공지용 포스터 생성/수정 도구. 관리자 화면은 세 탭으로 구성된다.

1. **이미지 만들기** — 행사 정보·스타일을 영문 이미지 프롬프트로 변환하고, GPT 이미지 API로 생성/수정한다.
2. **추천도서자동화** — 도서 URL에서 추천도서 포스터 초안을 만들고, GPT 이미지 API로 배경 생성/수정 후 최종 캔버스를 다운로드한다.
3. **저장된 포스터** — 다운로드 시 `poster-images` Storage와 `posters/poster_versions`에 저장된 최종본 목록을 조회하고, 기존 버전 또는 업로드한 이미지에서 수정 프롬프트를 이어간다.

다운로드 버튼은 로컬 파일 다운로드를 먼저 실행한 뒤 저장된 포스터 목록용 Storage 업로드/DB 저장을 시도한다. 저장 실패가 발생해도 로컬 다운로드는 유지된다.

### POST `/api/posters/build-prompt`

칩 + 행사 정보 → 영문 이미지 프롬프트 생성.

- **인증**: staff/admin/master (`requireAdmin()`) — 쿠키 또는 `Authorization: Bearer`
- **런타임**: `nodejs`
- **최대 실행 시간**: 45초 (`maxDuration = 45`)
- **요청 형식**: `multipart/form-data`
  - `payload` (string, 필수) — 아래 스키마의 JSON 직렬화
  - `reference` (file, 선택) — 참고 이미지 1장. 5MB 이하, `image/*`. 서버에서 sharp 로 768×768 inside-fit + JPEG q85 압축 후 멀티모달 호출에 첨부.

- **payload 스키마** (Zod):

```ts
{
  category: "event" | "welcome" | "group" | "notice" | "custom";
  ratio: "1:1" | "9:16" | "a4";
  title: string;                           // 1~100
  schedules: string[];                     // 각 1~120, 최대 20개
  location?: string;                       // ≤120
  audience?: string;                       // ≤120
  extraLines?: string[];                   // 각 1~150, 최대 12개
  colorPalette: ColorPalette;              // 9종 프리셋 (springPastel, summerCool, ...)
  artStyle: ArtStyle;                      // 8종
  mood: Mood;                              // 5종
  motifs: Motif[];                         // 8종 중 다중, 최대 8
  peopleHandling: "none" | "silhouette" | "abstract";
  moodKeywords?: string;                   // ≤200, 자유 키워드
  includeText: boolean;                    // true=AI 가 한글 텍스트도 그림 / false=텍스트 따로 합성
  referenceAspect?: "style" | "composition" | "both";
}
```

- **응답 (200)**:

```ts
{
  englishPrompt: string;  // ChatGPT/Gemini/Midjourney 등에 붙여 쓰는 영문 산문체 프롬프트
  koreanSummary: string;  // 어떤 톤으로 만들었는지 한 줄 요약 (UI 노출용)
}
```

- **에러**:
  - `400` — payload JSON 오류 / Zod 검증 실패 / 이미지 형식 아님
  - `401`, `403` — 권한
  - `413` — 참고 이미지 5MB 초과
  - `500` — 참고 이미지 sharp 처리 실패 / 기타 서버 오류
  - `503` — Gemini 일시 불가 (`GeminiUnavailableError`)

- **내부 동작**:
  1. `requireAdmin()` 으로 권한 검증
  2. `multipart` 파싱 + Zod 검증
  3. 참고 이미지가 있으면 sharp 로 압축 → base64
  4. `buildMetaPromptForGemini(input, hasReference)` 로 메타 프롬프트 작성
  5. `callGeminiWithFallbackMultimodal()` 호출 — Gemini 텍스트 모델이 영문 프롬프트 작성
  6. `sanitizePromptOutput()` — 모델이 끼우는 머리말/따옴표/마크다운 제거
  7. `buildKoreanSummary(input)` 으로 한국어 요약 생성

### POST `/api/posters/generate-image`

GPT 이미지 API로 포스터 이미지를 생성하거나 기존 이미지를 수정한다. 포스터 도구의 `이미지 만들기`, `추천도서자동화`, `저장된 포스터` 탭이 공통으로 사용한다.

- **인증**: staff/admin/master (`requireAdmin()`)
- **요청 형식**: `application/json`
- **입력 요약**:
  - `prompt` — 영문 이미지 프롬프트
  - `ratio` — `"1:1"` \| `"9:16"` \| `"a4"`
  - `artStyle` — `poster-prompts.ts`의 `ART_STYLES`
  - `mode` — `"generate"` \| `"revise"`
  - `revisionInstruction` — 수정 모드 설명
  - `sourceImageDataUrls` — 수정/참고 이미지 data URL 배열, 최대 6장
  - `includeFooterContent`, `posterTitle`, `posterCategory`
- **응답**: `{ imageUrl, imageBase64?, mimeType?, revisedPrompt? }`
- **저장 주의**: 이 route는 이미지를 생성만 한다. `posters/poster_versions` 저장은 관리자 클라이언트가 다운로드 시 `poster-images` Storage와 DB에 기록한다.

---

### GET `/api/admin/openai/monthly-spend`

포스터 도구 상단에 표시할 OpenAI API 해당 월 총 사용 금액을 조회한다.

- **인증**: staff/admin/master (`requireAdmin()`)
- **환경 변수**:
  - `OPENAI_ADMIN_KEY` — OpenAI Organization Admin API key. 클라이언트에 노출 금지.
- **처리**:
  1. Asia/Seoul 기준 현재 월 시작 Unix seconds 계산
  2. OpenAI Costs API `/v1/organization/costs` 호출로 현재 시점까지의 조직 전체 비용 조회
  3. `bucket.results[].amount.value` 합산
- **응답**:

```json
{
  "totalUsd": 0,
  "currency": "usd",
  "monthLabel": "7월",
  "startTime": 1782831600
}
```

UI는 실패 시 포스터 도구 전체를 깨뜨리지 않고 `총 사용량 - / 7월` 형태로 표시한다.

---

### POST `/api/admin/weeklies/[id]/extract-events`

**주보 "교회소식" → 캘린더 일정 AI 자동 추출** (마이그레이션 034 이후).
저장된 weekly 의 `news` JSONB + `meetings` 배열을 Gemini 가 분석해 일정 후보를 리턴.
실제 INSERT 는 `/api/admin/calendar/batch` 가 담당 — 본 라우트는 검수용 후보만 생성.

- **인증**: `requireAdmin(request)` — staff/admin/master. Bearer 자동 분기 (모바일 호환).
- **입력**: 없음 (URL `[id]` = `weeklies.id`). body 빈 POST.
- **처리**: `weeklies.date` 를 anchor 로 `extractEventsFromNews()` 호출 → Gemini 텍스트 단발 → JSON 파싱 → Zod 검증 → 요일·날짜 범위 후처리(confidence 보정).

**응답** (`ExtractEventsResponse`):
```json
{
  "weeklyId": "uuid",
  "anchorDate": "2026-04-19",
  "candidates": [
    {
      "title": "교회 새가족 환영파티",
      "date": "2026-05-09",
      "startTime": "17:00",
      "endTime": null,
      "location": "교회식당",
      "description": "교회 새가족을 위한 환영파티",
      "sourceNewsIndex": 0,
      "sourceQuote": "5/9(토) 오후 5시 (교회식당)",
      "confidence": 0.92,
      "rruleHint": null
    }
  ],
  "skipped": [
    { "sourceNewsIndex": 4, "reason": "구체적 일자 없음" }
  ]
}
```

**에러**:
- `400` — 잘못된 weekly id 형식 / 주보 날짜 비어있음
- `401/403` — 인증·권한
- `404` — 주보 없음
- `502` — Gemini 응답이 스키마 위반 (재시도 권장)
- `503` — Gemini 일시 장애 (`GeminiUnavailableError`)
- `500` — 기타

**주의**:
- 자동 INSERT 안 함 — 응답을 staff 가 검수 모달에서 토글/편집 후 batch 라우트로 전달.
- `confidence` 0.6 미만은 UI 가 amber 경고 + 자동 OFF.
- `sourceQuote` 의 (요일) 표기와 추출 date 의 실제 요일이 어긋나면 confidence 가 0.5 이하로 강제 하향.

---

### POST `/api/admin/calendar/batch`

**검수 통과 일정 일괄 INSERT** (마이그레이션 034 이후).
`extract-events` 응답을 staff 가 모달에서 검수·편집한 후 호출.

- **인증**: `requireAdmin(request)` — staff/admin/master. Bearer 자동 분기.
- **입력** (`EventBatchInsertSchema`):
```json
{
  "events": [
    {
      "title": "교회 새가족 환영파티",
      "description": "...",
      "location": "교회식당",
      "date": "2026-05-09",
      "startTime": "17:00",
      "endTime": null,
      "notify": false,
      "sourceWeeklyId": "uuid",
      "sourceNewsIndex": 0
    }
  ]
}
```
- 항목 1~30개. 각 항목은 `events` 테이블 컬럼과 동일 구조 + `sourceWeeklyId/sourceNewsIndex` 추적 컬럼.
- 저장 시 `extracted_by_ai = true` 강제, `created_by = auth.uid()` 자동.

**응답** (`BatchInsertResult`):
```json
{
  "inserted": [
    { "id": "uuid", "title": "...", "start": "2026-05-09T17:00:00+09:00", ... }
  ],
  "skipped": [
    { "index": 2, "reason": "RLS 거부 또는 INSERT 실패 사유" }
  ]
}
```
- `inserted`: 성공 항목 (`CalendarEvent` DTO).
- `skipped`: 실패 항목 — 클라이언트가 보낸 인덱스 + DB 에러 메시지.

**상태 코드**:
- `201` — 전부 성공
- `207` — 부분 성공 (Multi-Status). 클라이언트는 `inserted`/`skipped` 둘 다 처리해야 함.
- `400` — 입력 스키마 위반
- `401/403` — 인증·권한
- `500` — 기타

**보안 강화**:
- 항목별 INSERT — RLS 거부 1건이 전체 롤백시키지 않음.
- `created_by = userId` 명시 → content_authors 트리거가 작성자 자동 기록.
- `notify` 기본 false — staff 가 의식적으로 ON 한 항목만 D-1 알림톡 cron 발송 대상.

---

### GET `/api/posters/proxy-image`

외부 이미지 URL 을 같은 origin 으로 스트림 — 클라이언트 Canvas CORS taint 회피용.

- **인증**: staff (`requireAdmin()`)
- **런타임**: `nodejs`
- **최대 실행 시간**: 30초 (`maxDuration = 30`)
- **쿼리 파라미터**:
  - `url` (필수) — 가져올 이미지의 `http(s)` URL

- **SSRF 방어**:
  - `http`/`https` 외 프로토콜 거부
  - 내부망 호스트 차단: `localhost`, `0.0.0.0`, `127.x`, `10.x`, `172.16~31.x`, `192.168.x`, `169.254.x`, IPv6 loopback/`fe80:`/`fc/fd`
  - 응답 `Content-Type` 이 `image/*` 이 아니면 415 반환 (HTML 인 경우 사용자 친화 안내 추가)

- **응답 (200)**: 원격 이미지 바이너리 그대로. `cache-control: no-store`. 최대 25MB.
- **에러**:
  - `400` — `url` 누락 / 잘못된 URL / 비 http(s) / 내부망
  - `401`, `403` — 권한
  - `413` — 25MB 초과
  - `415` — 이미지가 아님
  - `502` — 원격 응답 오류
  - `500` — 기타

---

## 주보 HWP/HWPX 자동 채우기 (마이그레이션 038)

전도사가 한컴에서 작성한 주보 파일을 업로드해 폼을 자동 채우는 흐름.
파싱 결과는 `weekly_imports` 테이블에 7일간 보존되며, cron 으로 자동 정리.

### 공용 DTO

```ts
type WeeklyImportStatus =
  | "uploaded" | "converting" | "parsing" | "parsed" | "failed";

type WeeklyImportSourceFormat = "hwp" | "hwpx";

interface ImportField<T> {
  value: T;
  confidence: number; // 0.0~1.0
}

interface WeeklyImportResult {
  date?: ImportField<string>;
  worshipItems?: ImportField<WorshipItemRow[]>;
  offerings?: ImportField<OfferingCategoryRow[]>;
  dawnReadings?: ImportField<DawnReading[]>;
  guideCommittee?: ImportField<GuideCommitteeRow[]>;
  nextWeekPrayer?: ImportField<string[]>;
  news?: ImportField<NewsItem[]>;
  meetings?: ImportField<MeetingRow[]>;
  newFamily?: ImportField<NewMemberRow[]>;
  sermonTitle?: ImportField<string>;
  sermonPastor?: ImportField<string>;
  warnings: string[]; // 마스터와 다른 값, 인식 실패 등
}

interface WeeklyImportRecord {
  id: string;
  fileName: string;
  sourceFormat: WeeklyImportSourceFormat;
  status: WeeklyImportStatus;
  errorMessage: string | null;
  result: WeeklyImportResult | null;
  createdAt: string;
  updatedAt: string;
}
```

### POST `/api/admin/weeklies/import-hwpx`

한컴 .hwpx 를 업로드해 서버 안에서 직접 파싱 + Gemini 자유 텍스트 구조화.

- **인증**: `requireAdmin(request)` + admin/master 추가 가드 (RLS 와 일치)
- **maxDuration**: 60s
- **요청**: `multipart/form-data` — `file: <.hwpx>` (≤ 10MB, ZIP 매직 검증)
- **응답 (200)**:
  ```ts
  { importId: string; result: WeeklyImportResult }
  ```
- **에러**:
  - `400` — 파일 누락 / 형식 오류 / 크기 초과 / ZIP 매직 불일치
  - `401` / `403` — 권한
  - `422` — `.hwp` 업로드 시 변환 안내 (`hint` 필드 포함). 파싱 자체 실패도 422.
  - `503` — Gemini 폴백 전체 실패 (`GeminiUnavailableError`)

### POST `/api/admin/weeklies/import-hwp`

한컴 .hwp 를 업로드 → Storage 보관 후 GitHub Actions(LibreOffice headless)에 변환 작업을 큐잉.

- **인증**: `requireAdmin(request)` + admin/master 추가 가드
- **요청**: `multipart/form-data` — `file: <.hwp>` (≤ 15MB)
- **응답 (202)**:
  ```ts
  { importId: string; status: "converting" }
  ```
- **에러**:
  - `400` — 파일 누락 / 확장자 불일치
  - `401` / `403` — 권한
  - `500` — `GITHUB_PAT` 환경변수 누락 / Storage 업로드 실패
  - `502` — GitHub Actions workflow_dispatch 실패
- **후속 흐름**: runner 가 변환을 마치면 `POST /api/admin/weeklies/import-hwp-finalize` 를 호출.
  클라이언트는 polling 라우트로 결과 수신.

### POST `/api/admin/weeklies/import-hwp-finalize`

GitHub Actions runner 가 .hwp → .hwpx 변환 + Storage 업로드 후 본 라우트를 호출해 파싱 단계 재진입.

- **인증**: `Authorization: Bearer <CRON_SECRET>` 또는 `x-cron-secret` 헤더 (사용자 세션 X)
- **maxDuration**: 60s
- **요청 본문**: `{ importId: string }`
- **동작**: Storage `weeklies/imports/{importId}.hwpx` 다운로드 → 파싱 → `WeeklyImportResult` 를 `weekly_imports.parsed_json` 에 저장.
- **응답 (200)**: `{ importId, status: "parsed" }`
- **에러**: `401` (시크릿), `400` (importId 누락), `404` (행 없음), `422` (파싱 실패), `503` (Gemini)

### GET `/api/admin/weeklies/imports/[id]`

업로드한 import 의 상태/결과를 폴링.

- **인증**: `requireAdmin(request)` + admin/master 가드
- **응답 (200)**: `WeeklyImportRecord`
- **사용**: 클라이언트(검수 모달)가 .hwp 비동기 변환을 기다릴 때 2초 간격으로 호출.

### GET `/api/admin/cron/cleanup-weekly-imports`

Vercel Cron — 매일 04:00 KST (UTC 19:00). 7일 초과한 weekly_imports 행과 Storage 객체 동시 삭제.

- **인증**: `x-cron-secret` 헤더 또는 `Authorization: Bearer <CRON_SECRET>`
- **응답 (200)**: `{ scanned, storage_removed, rows_removed }`
- **에러**: `401`, `500`

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
| GET `/api/calendar` | `parseLimit()` | limit 상한 100, days 상한 365 |
| POST `/api/calendar` | `CalendarEventSchema` | endTime 옵셔널, refine 일관성 검증 |
| PATCH `/api/calendar/[id]` | `CalendarEventPatchSchema` | partial + 동일 refine |
| POST `/api/admin/event-subscribers` | `EventSubscriberSchema` | 휴대폰 자동 정규화 |
| PATCH `/api/admin/event-subscribers/[id]` | `EventSubscriberSchema.partial()` | |
| POST `/api/new-family` | `NewFamilyRegistrationSchema` | `privacyConsent: z.literal(true)`. 'etc' 직접입력 추가 검증 |
| PATCH `/api/admin/new-families/[id]` | `NewFamilyUpdateSchema` | status 또는 adminNote 부분 업데이트 |
| GET `/api/home/hero-slides` | `parseLimit()` | limit 기본 5, 상한 100 |
| POST `/api/admin/boards` | `BoardCreateSchema` | 소모임 게시판 신설 |
| PATCH `/api/admin/boards/[id]` | `BoardUpdateSchema` | 제목/설명/isVisible 부분 업데이트 |
| PUT `/api/admin/boards/[id]/members` | `BoardMembersReplaceSchema` | 멤버 일괄 교체 |
| GET `/api/boards/[id]/posts` | `parseBoardCursor()` + `parseLimit()` | cursor 페이지네이션 |
| POST `/api/boards/[id]/posts` | `BoardPostSchema` | 글 작성 (이미지 URL board-images 버킷 강제) |
| PATCH `/api/boards/[id]/posts/[postId]` | `BoardPostPatchSchema` | 본인 글 수정 |
| POST `/api/boards/[id]/posts/[postId]/comments` | `BoardCommentSchema` | 댓글 작성 |
| POST `/api/posters/build-prompt` | route 내부 Zod (`PayloadSchema`) | 포스터 영문 프롬프트 생성. multipart payload+reference |
| POST `/api/posters/generate-image` | route 내부 Zod (`RequestSchema`) | GPT 이미지 생성/수정. 저장은 다운로드 시 클라이언트가 `poster_versions`에 기록 |
| GET `/api/posters/proxy-image` | URL 검증 + SSRF 차단 | 외부 이미지 origin 우회 |
| GET `/api/admin/openai/monthly-spend` | Admin auth + 서버 env | OpenAI Costs API 월 총액 조회 |
| POST `/api/admin/weeklies/[id]/extract-events` | UUID 검증 + 응답 시 `ExtractEventsResponseSchema` | Gemini 응답 JSON 강제, 마이그레이션 034 |
| POST `/api/admin/calendar/batch` | `EventBatchInsertSchema` (1~30건) | AI 추출 검수 통과 일괄 INSERT, 207 partial 가능 |

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
| `getSermonVideos(limit?)` | `src/lib/sermons.ts` | `sermon_videos` 테이블에서 published_at DESC 로 N건 조회 (기본 100) |
| `getSermonByVideoId(id)` | `src/lib/sermons.ts` | 단건 설교 조회 (상세 페이지용) |
| `getLatestSermon()` | `src/lib/sermons.ts` | 최신 설교 1건 (DB) |
| `fetchYouTubeUploads(max?)` | `src/lib/youtube.ts` | YouTube Data API v3 업로드 플레이리스트 fetch — sync cron 전용 |
| `categorizeSermon(title)` | `src/lib/sermon-category.ts` | 제목으로 sunday/wednesday/friday/dawn/praise/all 분류 (UI · sync 공유) |
| `summarizeSermonFromVideo(sermon)` | `src/lib/gemini.ts` | Gemini 설교 요약 |
| `callGeminiWithFallback(prompt)` | `src/lib/gemini.ts` | 범용 Gemini 호출 (폴백+재시도) |
| `requireAdmin()` | `src/lib/admin-auth.ts` | API 라우트 admin 인증 헬퍼 |
| `canAccessAdminPath(role, path)` | `src/lib/admin-permissions.ts` | 경로별 최소 권한 검증 — 미들웨어·UI 필터링 공통 |
| `meetsMinRole(role, min)` | `src/lib/admin-permissions.ts` | role 등급 비교 (staff < admin < master) |
| `getMinRoleForPath(path)` | `src/lib/admin-permissions.ts` | 경로 prefix → 최소 권한(가장 긴 매칭 우선) |
| `loadUpdates()` | `src/lib/updates.ts` | 루트 `UPDATES.md` 파싱 → `UpdateEntry[]` (날짜 내림차순) |
| `parseUpdates(md)` | `src/lib/updates.ts` | 순수 함수 — 마크다운 문자열을 `UpdateEntry[]`로 |
| `stripMetaComments(body)` | `src/lib/updates.ts` | `<!-- highlight -->`, `<!-- staff-only -->` 제거 |
| `easterSundayUtc(year)` | `src/lib/liturgical/easter.ts` | Anonymous Gregorian Algorithm 부활주일 |
| `getLiturgicalDay(date)` | `src/lib/liturgical/season.ts` | 입력 일자의 절기 + 한국어명 + 주차 |
| `isOrdinary(season)` | `src/lib/liturgical/season.ts` | 평주일 여부 |
| `getLiturgicalEventsForYear(year)` | `src/lib/liturgical/calendar.ts` | 해당 연도 큰 절기 9~10개 (`CalendarEvent[]`) |
| `getLiturgicalEventsInRange(s, e)` | `src/lib/liturgical/calendar.ts` | YMD 범위 가상 이벤트 |
| `formatLiturgyLabel(day)` | `src/lib/liturgical/format.ts` | UI 라벨("사순 4주") |
| `brandTokens(season)` | `src/lib/liturgical/colors.ts` | 브랜드 액센트(평주일 = church-gold) |
| `getUpcomingEvents(max, days)` | `src/lib/google-calendar.ts` | Google Calendar 다가오는 이벤트 |
| `getAllEvents(max)` | `src/lib/google-calendar.ts` | 관리자용 이벤트 목록 (과거 30일 포함) |
| `createCalendarEvent(input)` | `src/lib/google-calendar.ts` | 이벤트 생성 (Service Account) |
| `deleteCalendarEvent(id)` | `src/lib/google-calendar.ts` | 이벤트 삭제 (Service Account) |
| `validateFile(file, exts, maxSize)` | `src/lib/validation.ts` | 파일 업로드 검증 (타입 + 크기) |
| `safeExtension(filename, allowed)` | `src/lib/validation.ts` | 안전한 확장자 추출 |
| `parseLimit(raw, fallback)` | `src/lib/validation.ts` | limit 파라미터 파싱 (상한 100) |

---

## 관리자 권한 매트릭스 (페이지 라우트)

`src/lib/admin-permissions.ts` 의 `ADMIN_ROUTE_PERMISSIONS` 가 단일 진실의 원천. 자세한 표는 `ARCHIT.md` 의 "관리자 권한 매트릭스" 섹션 참조.

| 등급 | 포함 경로 |
|------|----------|
| **admin 이상** | `/admin/notices`, `/admin/weeklies`, `/admin/masters`, `/admin/calendar`, `/admin/event-subscribers`, `/admin/inquiries`, `/admin/new-families` |
| **staff 이상** | `/admin/gallery`, `/admin/boards`, `/admin/posters`, `/admin/sermons`, `/admin/shorts` |
| **master 단독** | `/admin/members` |
| **공통(staff 이상)** | `/admin`, `/admin/menu`, `/admin/guide`, `/admin/updates` |

미들웨어가 부족 권한 시 `/admin?notice=no_permission` 으로 리디렉트. UI 사이드바·하단 탭바·메뉴 페이지는 자동으로 권한 없는 항목을 숨긴다.

API 라우트(`/api/admin/*`)는 위 페이지 매트릭스와 **별개**로 `requireAdmin()`(staff 통과) 또는 `requireMaster()`로 보호된다. 즉 staff 도 `/api/admin/notices` 등을 호출할 수 있으나 페이지 진입은 admin 이상에서만 가능 — 직접 fetch 경로는 별도 점검 필요.

---

## 인증 흐름

- **Supabase Auth + OAuth** (Google, Kakao) — 이메일/비밀번호 로그인은 사용하지 않음
- **로그인** 페이지 `/login` → `signInWithOAuth({ provider })` → 외부 OAuth → `/auth/callback?code=...` → `exchangeCodeForSession(code)` → 쿠키 세션 + `/?next=...`로 복귀
- **로그아웃**: 클라이언트에서 `supabase.auth.signOut()` 호출 (별도 백엔드 엔드포인트 없음). 같은 탭의 헤더는 `useMe`의 `onAuthStateChange` 구독으로 즉시 갱신
- **클라이언트 SDK**: `createBrowserClient` (`src/lib/supabase/client.ts`)
- **RSC/Route Handler**: `createServerClient` + cookies (`src/lib/supabase/server.ts`)
- **API 라우트 (모바일 호환)**: `createApiClient(request)` (`src/lib/supabase/api.ts`) — `Authorization: Bearer` 헤더 OR 쿠키 자동 분기
- **미들웨어**: `/groups/*`, `/profile/*`, `/admin/*` 보호. admin 경로는 `hasStaffAccess(role)` (staff/admin/master 허용)
- **role 헬퍼**: `src/lib/admin-auth.ts`
  - `requireAdmin(request?)` — staff/admin/master 통과
  - `requireMaster(request?)` — master 단독
  - `hasStaffAccess(role)`, `hasMasterAccess(role)`
- **클라이언트 권한 훅**: `useMe()` (`src/lib/use-me.ts`) → `MeResponse`. Supabase auth 이벤트(INITIAL_SESSION/SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED)마다 `/api/me` 자동 재조회
- **삭제 권한 헬퍼**: `canDelete(me, authorId)` — admin/master 또는 본인이 작성한 글일 때만 true
- **role 등급**:
  - `member` — 일반 회원 (기본)
  - `staff` — admin UI 접근 가능, 본인이 작성한 컨텐츠만 삭제
  - `admin` — 컨텐츠 최상위 관리자, 모든 컨텐츠 삭제
  - `master` — admin 권한 + 회원 role 변경 단독 권한

## 외부 서비스

| 서비스 | 용도 | 환경변수 |
|--------|------|----------|
| Supabase | DB + Auth + Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| YouTube Data API v3 | 설교 영상 목록 | `YOUTUBE_API_KEY` |
| Google Gemini | AI 설교 요약 + 쇼츠 하이라이트 | `GEMINI_API_KEY` |
| Next.js ISR | 캐시 무효화 | `REVALIDATE_SECRET` |
| Google Maps Embed | 찾아오시는 길 | `NEXT_PUBLIC_GOOGLE_MAPS_KEY` |
| Google Calendar API v3 | 1회 마이그레이션 스크립트(`scripts/migrate-google-calendar.ts`)에서만 사용 — 일상 트래픽 의존 없음 | `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY` (마이그레이션 후 제거 권장) |
| GitHub Actions | 쇼츠 생성 파이프라인 | `GITHUB_PAT` |
| Vercel Cron | (1) 일정 알림톡 D-1 발송 `/api/admin/cron/alimtalk-events` 매일 06:00 KST · (2) 설교 영상 동기화 `/api/admin/cron/sync-sermons` 매일 15:00 KST · (3) 주보 import 7일 정리 `/api/admin/cron/cleanup-weekly-imports` 매일 04:00 KST | `CRON_SECRET` |
| GitHub Actions (LibreOffice headless) | `.hwp → .hwpx` 변환 — `/api/admin/weeklies/import-hwp` 가 워크플로우(`.github/workflows/hwp-convert.yml`) 를 dispatch. runner 가 변환 후 `/api/admin/weeklies/import-hwp-finalize` 호출 | `GITHUB_PAT`, `APP_URL` (Actions secret), `CRON_SECRET` |
| 카카오 비즈니스 알림톡 (중계사 — NHN Cloud / Aligo / Solapi 등) | 일정 알림톡 발송 — 비즈 승인 후 환경변수 채우면 동작 | `KAKAO_BIZ_API_KEY`, `KAKAO_BIZ_SENDER_KEY`, `KAKAO_BIZ_API_URL` |
