# 데이터베이스 스키마

Supabase (PostgreSQL) 기반. 모든 테이블에 Row Level Security(RLS) 적용.

> **DB 외 영속 데이터**: 업데이트 노트(릴리스 노트)는 의도적으로 DB가 아닌
> 루트 `UPDATES.md` 파일에 저장. 단순성·Git history audit·검토 용이성을 우선한 결정.
> 자세한 흐름은 `ARCHIT.md` "업데이트 노트 시스템" 섹션 참고.
>
> **UI 권한 ≈ RLS (037 이후 정렬 완료)**: 관리자 페이지의 가시성과 RLS 가
> admin/master 등급에서 일치한다 — 마이그레이션 037 적용 후. 페이지가 admin+ 인
> 테이블은 RLS 도 admin/master 만 INSERT/UPDATE/SELECT-all 가능.
> 예외 정책(보존):
> - 공개 SELECT — `notices(is_public)`, `weeklies`, `events`, `churchschool_posts`, `sermon_videos` 등은 공개 페이지에서 anon 가 읽음.
> - 작성자 본인 DELETE — 021 패턴, `notices/weeklies/gallery_albums/events` 의 본인 작성 글은 작성자 SELECT/DELETE 가능.
> - anon INSERT — `chat_inquiries`(챗봇), `new_family_registrations`(공개 폼).
> - service_role / cron — RLS 우회.

---

## 테이블

### `profiles`

Supabase Auth `auth.users`를 확장하는 사용자 프로필. OAuth(Google/Kakao) 가입 사용자만 존재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | `auth.users.id` 참조 |
| `name` | `text NOT NULL` | 사용자 이름 (OAuth provider 의 닉네임) |
| `phone` | `text` | 전화번호 (nullable, 사용 안 함) |
| `role` | `text DEFAULT 'member'` | `'member'` \| `'staff'` \| `'admin'` \| `'master'` (마이그레이션 015/019) |
| `email` | `text` | OAuth 이메일 (마이그레이션 014) |
| `avatar_url` | `text` | OAuth 프로필 사진 URL (마이그레이션 014) |
| `provider` | `text` | `'google'` \| `'kakao'` (마이그레이션 014) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책** (015/019):
- 모든 사용자: SELECT 가능
- 본인만: UPDATE 가능 (`auth.uid() = id`)
- master: 모든 사용자의 profile UPDATE 가능 (회원관리 페이지에서 role 변경 단독 권한)

**트리거**:
- `auth.users` INSERT 시 자동으로 `profiles` 레코드 생성 (017 — Kakao OAuth 응답 metadata 처리 포함)
- `profiles.role` UPDATE 시 `prevent_unauthorized_role_change()` 가 master 가 아닌 사용자의 role 변경 차단 (019)
- 동일 이메일이 다른 OAuth provider 로 가입 시 `EMAIL_ALREADY_REGISTERED` 발생 (018)

**역할 헬퍼 함수** (015/019/021):
- `public.is_staff()` — staff/admin/master 중 하나면 true
- `public.is_admin_or_master()` — admin 또는 master 면 true
- `public.is_master()` — master 면 true
- `public.is_content_author(content_type, content_id)` — 현재 사용자가 해당 컨텐츠 작성자면 true

**TypeScript 타입** (`src/types/supabase.ts`):
```ts
type Role = "member" | "staff" | "admin" | "master";
interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
  email: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
}
```

---

### `groups`

커뮤니티 그룹 (토론/게시판).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `name` | `text NOT NULL` | 그룹 이름 |
| `slug` | `text UNIQUE NOT NULL` | URL 슬러그 |
| `description` | `text` | 설명 (nullable) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**초기 데이터**: `공지` (slug: gongji), `주보` (slug: jubo)

**TypeScript 타입**:
```ts
interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}
```

---

### `group_posts`

그룹 내 게시글.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `group_id` | `uuid NOT NULL` | `groups.id` FK |
| `author_id` | `uuid NOT NULL` | `profiles.id` FK |
| `title` | `text NOT NULL` | 제목 |
| `content` | `text NOT NULL` | 내용 |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

**RLS 정책**:
- 모든 사용자: SELECT 가능
- 인증된 사용자: INSERT 가능
- 작성자만: UPDATE, DELETE 가능

**앱 레벨 제약** (`GroupPostSchema`): title 100자, content 5,000자

**TypeScript 타입**:
```ts
interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: { name: string }; // JOIN 결과
}
```

---

### `notices`

공지사항/알림.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` | 제목 |
| `slug` | `text UNIQUE NOT NULL` | URL 슬러그 |
| `category` | `text DEFAULT '일반'` | `'일반'`, `'긴급'`, `'행사'` |
| `content` | `text NOT NULL` | 본문 (인라인 `[IMG:url]` 마커 지원) |
| `images` | `text[] NOT NULL DEFAULT '{}'` | 첨부 이미지 Supabase Storage URL 배열 (마이그레이션 009). `images[0]`이 홈 히어로 슬라이더 배경으로 사용됨 |
| `is_public` | `boolean DEFAULT true` | 공개 여부 |
| `date` | `date` | 날짜 (nullable) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책** (003 + 015 + 021):
- 공개 공지(`is_public=true`): 모든 사용자 SELECT 가능
- staff(staff/admin/master): SELECT 모두, INSERT, UPDATE
- DELETE: **작성자 본인 OR admin OR master** (`is_admin_or_master() OR is_content_author('notice', id)`)

**앱 레벨 제약** (`NoticeSchema`): title 200자, content 50,000자, slug 100자

**작성자 추적**: INSERT 시 `record_content_author('notice')` 트리거가 `content_authors` 에 자동 기록 (020)

**파생 용도**:
- **홈 히어로 슬라이더** — `getHeroSlides()`가 `is_public=true` + `images[0] OR 본문 첫 [IMG:url]`이 존재하는 공지를 최신순으로 추려 `HeroSlide[]` DTO로 변환. 관리자가 공지를 게시하면 자동으로 슬라이더에 노출 (ISR 1시간 TTL). 신규 테이블 없이 기존 `notices`를 재활용하는 설계로 백엔드 수정 없이 모바일 앱과도 동일 데이터를 공유.

**TypeScript 타입** (`src/types/notice.ts`):
```ts
interface Notice {
  id: string;
  title: string;
  slug: string;
  category: "일반" | "긴급" | "행사";
  content: string;
  images: string[];
  is_public: boolean;
  date: string | null;
  created_at: string;
}

/** 홈 히어로 슬라이드 — 플랫폼 공용 DTO (notices에서 파생) */
interface HeroSlide {
  id: string;        // notices.slug
  eyebrow: string;   // 카테고리 매핑
  title: string;
  subtitle: string;  // 본문에서 [IMG:..] 제거 후 ≤80자
  image: string;     // images[0] 또는 본문 첫 [IMG:url]
  href: string;      // /notice/{slug}
  date: string | null;
}
```

---

### `weeklies`

주보 (주간 게시물). 폼 기반 콘텐츠 입력 + PDF 자동 생성 지원.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` | 제목 |
| `date` | `date` | 날짜 (nullable) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |
| `volume` | `integer` | 권 (예: 47) |
| `issue` | `integer` | 호 (예: 16) |
| `special_praise` | `jsonb` | 특별찬양 `{part1:{song,choir}, part2:{song,choir}}` |
| `sermon_title` | `text` | 말씀 제목 |
| `sermon_pastor` | `text` | 설교자 이름 |
| `closing_hymn` | `text` | 결단 찬송 번호 |
| `weekly_verse` | `text` | 입술말씀 (구절 + 본문) |
| `afternoon_service` | `jsonb` | 주일오후 찬양예배 `{scripture, title, pastor}` |
| `afternoon_mokjang_mode` | `boolean NOT NULL DEFAULT false` | true = 페이지2 좌상단(주일오후) 자리를 "목장모임" 이미지로 대체 (마이그레이션 028) |
| `wednesday_service` | `jsonb` | 수요예배 `{leader, scripture, title, pastor, hymn, benediction}` (인도자/설교자/찬송/축도 필드는 jsonb 안에서 무스키마 확장) |
| `dawn_readings` | `jsonb` | 새벽예배 신앙일기 `[{date, passage}]` (6개) |
| `offering_members` | `jsonb` | 헌금위원 `{p1, p2, p3}` |
| `is_published` | `boolean DEFAULT false` | 공개 발행 여부 |
| `publish_channels` | `jsonb` | 발행 채널 `{website, alimtalk, instagram}` |
| `news` | `jsonb` | 교회소식 배열 `[{title, items:string[]}]` (최대 20, validation.ts 제약) |
| `meetings` | `jsonb` | 모임 안내 `[{group, when, place}]` (최대 6) |
| `north_korea_note` | `text` | 북한선교부 메모 |
| `bible_reading` | `text` | 성경 통독 현황 메모 |
| `new_members` | `jsonb` | 지난 주일 새가족 `[{no, regNo, name, inviter, dept}]` (최대 4) |
| `meal_duty_note` | `text` | 식당 봉사 메모 |
| `volunteer_note` | `text` | 봉사센터 소식 |
| `worship_leader` | `text` | 1·2·3부 인도자 |
| `worship_items` | `jsonb` | 예배 순서 배열 (최대 24). `{marker,label,content,assignees[],subRows[],emphasize}` |
| `memorize_verse` | `jsonb` | 금주 암송말씀 `{ref, text}` |
| `next_week_prayer` | `jsonb` | 다음 주 기도자 배열 (최대 3) |
| `guide_committee` | `jsonb` | 안내위원 `[{part, indoor, outdoor}]` (최대 3) |
| `offerings` | `jsonb` | 향기로운 예물 카테고리 `[{label, names}]` (최대 11) |
| `special_offering` | `jsonb NOT NULL DEFAULT '{"enabled":false,"label":"부활감사"}'` | 헌금 4번째 슬롯(부활감사 자리)을 토글/라벨 변경 가능한 "특별헌금" 으로 분리. enabled=false 면 주보 렌더 시 해당 행 제거 (마이그레이션 029) |
| `front_toggles` | `jsonb NOT NULL DEFAULT '{"bibleReading":true,"newMembers":true,"mealDuty":true,"volunteerNote":true}'` | 페이지 4(교회소식 영역) 4개 섹션별 표시 토글. OFF 시 주보 렌더에서 행 제거 + 번호 자동 재계산 (마이그레이션 030) |
| `week_total` | `text` | 지난주 헌금 총액 |
| `cumulative_total` | `text` | 누계 |

**RLS 정책** (003 + 015 + 021):
- 모든 사용자: SELECT 가능 (003 정책 — `using (true)`. `is_published` 는 앱 레벨 필터)
- staff: INSERT, UPDATE
- DELETE: **작성자 본인 OR admin OR master**

**작성자 추적**: INSERT 시 `record_content_author('weekly')` 트리거 (020)

**마이그레이션**:
- `010_weeklies_content.sql` — 초기 콘텐츠 필드(20개) 추가
- `011_weeklies_layout_fields.sql` — 신규 레이아웃 필드 15개 추가 (news, meetings, worship_items 등)
- `027_drop_weekly_legacy_fields.sql` — `hymn_number`, `scripture` (최상위) DROP. 인쇄/웹 주보가 `worship_items` 기반 신규 렌더로 통합되며 미사용 처리
- `028_weeklies_afternoon_mokjang_mode.sql` — `afternoon_mokjang_mode boolean NOT NULL DEFAULT false` 추가
- `029_weeklies_special_offering.sql` — `special_offering jsonb` 추가 (부활감사 자리 토글/라벨)
- `030_weeklies_front_toggles.sql` — `front_toggles jsonb` 추가 (페이지 4 섹션 표시 토글)
- `031_drop_weekly_misc_legacy.sql` — `prayer_items`, `announcements`, `servants_text`, `offering_list_text`, `sogroup_text` DROP. 폼의 "기타" 탭 자체 삭제. 기도제목은 마스터(`community_prayers`)로 일원화 (베이스 테이블 폴백 제거)
- `036_drop_weeklies_pdf_url.sql` — `pdf_url` DROP. PDF 자동 생성 라우트(/api/weeklies/generate-pdf)가 모든 호출 동선을 잃어 dead 상태가 된 후 컬럼·라우트·puppeteer 의존성 일괄 정리. Storage 버킷 'weeklies' 와 정책은 보존 (과거 수동 업로드 자산 대비)

**TypeScript 타입**: `src/types/notice.ts` `Weekly` 인터페이스 참조.

---

### `church_settings`

교회 전역 설정(KV 스토어). 현재 키: `topic_of_year`.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `key` | `text` PK | 설정 키 (예: `topic_of_year`) |
| `value` | `jsonb NOT NULL` | 값. `topic_of_year` 의 경우 `{text, year}` |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

**RLS 정책**: 모든 사용자 SELECT, admin 만 CUD
**마이그레이션**: `012_bulletin_master_tables.sql`

---

### `mokjang_entries`

소그룹 목장 (Live Reference — 주보 3페이지 목장 표).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `integer` PK | 목장 번호 (1~200) |
| `name` | `text DEFAULT ''` | 목자 이름 |
| `sub` | `text DEFAULT ''` | 부목자 이름 |
| `year` | `integer` | 연도 (nullable) |
| `active` | `boolean DEFAULT true` | 주보 노출 여부 |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

**RLS 정책**: 모든 사용자 SELECT, admin 만 CUD
**마이그레이션**: `012_bulletin_master_tables.sql`

---

### `servants`

섬기는 분들 (Live Reference — 주보 4페이지 좌측).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `seq` | `integer UNIQUE` | 표시 순서 |
| `role` | `text NOT NULL` | 역할 (예: "담 임 목 사") |
| `names` | `text DEFAULT ''` | 이름 (줄바꿈으로 여러 명 가능) |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

---

### `support_sections`

후원하는 분들 (Live Reference — 주보 4페이지 좌측).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `seq` | `integer UNIQUE` | 표시 순서 |
| `heading` | `text NOT NULL` | 제목 (예: "<해외선교지>") |
| `lines` | `jsonb DEFAULT '[]'` | 줄 배열 (최대 20) |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

---

### `community_prayers`

교회공동체 기도제목 (Live Reference — 주보 2페이지, 최대 7줄).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `seq` | `integer UNIQUE` | 표시 순서 |
| `text` | `text NOT NULL` | 기도 제목 |
| `updated_at` | `timestamptz DEFAULT now()` | 수정일 |

---

### `gallery_albums`

갤러리 앨범.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` | 앨범 제목 |
| `category` | `text` | `'예배'`, `'교회학교'`, `'교회행사'`, `'봉사센터'`, `'새가족'` (nullable, 하위호환) |
| `tags` | `text[] DEFAULT '{}'` | 태그 배열 (예: `{'교회학교','영유치부'}`). GIN 인덱스 적용 |
| `date` | `date` | 날짜 (nullable) |
| `thumbnail_url` | `text` | 썸네일 URL (nullable) |
| `is_public` | `boolean DEFAULT true` | 공개 여부 |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책** (002 + 015 + 021):
- 공개 앨범(`is_public=true`): 모든 사용자 SELECT 가능
- staff: SELECT 모두, INSERT, UPDATE
- DELETE: **작성자 본인 OR admin OR master**

**작성자 추적**: INSERT 시 `record_content_author('gallery_album')` 트리거 (020)

**인덱스**: `idx_gallery_albums_tags` — GIN 인덱스 (tags 배열 검색)

**TypeScript 타입** (`src/types/gallery.ts`):
```ts
interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  date: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  images: GalleryImage[]; // 클라이언트에서 JOIN
}
```

---

### `gallery_images`

앨범 내 이미지.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `album_id` | `uuid NOT NULL` | `gallery_albums.id` FK |
| `image_url` | `text NOT NULL` | 이미지 URL |
| `sort_order` | `int DEFAULT 0` | 정렬 순서 |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책** (002 + 015 + 021):
- 공개 앨범의 이미지: 모든 사용자 SELECT 가능
- staff: SELECT 모두, INSERT, UPDATE
- DELETE: **부모 앨범의 작성자 OR admin OR master** (`is_admin_or_master() OR is_content_author('gallery_album', album_id)`)

**TypeScript 타입**:
```ts
interface GalleryImage {
  id: string;
  album_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}
```

---

### `events`

자체 캘린더 일정 (마이그레이션 022). Google Calendar 의존 제거.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` | 제목 (1~200자) |
| `description` | `text` | 설명 (≤5000자) |
| `location` | `text` | 장소 (≤200자) |
| `date` | `date NOT NULL` | 일자 (필수) |
| `start_time` | `time` | 시작 시간 (NULL = 종일 일정) |
| `end_time` | `time` | 종료 시간 (NULL = 미정/오픈엔드) |
| `end_date` | `date` | v2 다일 일정용 (v1 미사용) |
| `rrule` | `text` | v2 반복 일정 RRULE (v1 미사용) |
| `notify` | `boolean DEFAULT false` | 알림톡 발송 대상 여부 |
| `created_by` | `uuid` | 작성자 user id (`auth.users.id` ON DELETE SET NULL) |
| `source_weekly_id` | `uuid` | AI 추출 시 어느 weeklies row 에서 뽑혔는지 (마이그 034). ON DELETE SET NULL |
| `source_news_index` | `integer` | weeklies.news 의 0-based 인덱스 (마이그 034). CHECK `0 <= < 50` |
| `extracted_by_ai` | `boolean NOT NULL DEFAULT false` | AI 추출 후 staff 검수를 거쳐 INSERT 된 일정 (마이그 034) |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | 자동 갱신 트리거 |

**CHECK 제약**:
- `end_date IS NULL OR end_date >= date`
- `end_time IS NULL OR start_time IS NULL OR end_time > start_time`
- `source_news_index IS NULL OR (0 <= source_news_index < 50)` (마이그 034)

**RLS 정책** (022 + 021 패턴):
- SELECT: 누구나 (캘린더는 공개)
- INSERT/UPDATE: staff
- DELETE: **작성자 본인 OR admin OR master** (`is_admin_or_master() OR is_content_author('event', id)`)

**작성자 추적**: INSERT 시 `record_content_author('event')` 트리거 (020 재사용, 022 에서 `'event'` content_type 추가).

**인덱스**:
- `idx_events_date` (date)
- `idx_events_notify` partial index — 알림 cron 의 빠른 조회용
- `idx_events_source_weekly` partial — `WHERE source_weekly_id IS NOT NULL` (마이그 034). AI 추출 일정만 빠르게 조회

**TypeScript 타입** (`src/types/calendar.ts`):
```ts
interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;       // ISO 8601 (KST +09:00) 또는 YYYY-MM-DD (종일)
  end: string | null;  // null = 미정/오픈엔드
  isAllDay: boolean;
  recurrence: string | null;  // v2
  notify: boolean;
}
```

---

### `event_subscribers`

일정 알림톡 수신자 명단 (마이그레이션 023). admin/master 가 직접 관리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `name` | `text NOT NULL` | 수신자 이름 (1~100자) |
| `phone` | `text NOT NULL UNIQUE` | 010-XXXX-XXXX (앱 레벨 정규화) |
| `is_active` | `boolean DEFAULT true` | 활성 여부 |
| `notify_d1` | `boolean DEFAULT true` | 하루 전 알림 (D-1) 수신 |
| `notify_d_day` | `boolean DEFAULT false` | 당일 알림 (D-day) 수신 |
| `note` | `text` | 메모 (≤500자, 예: "임원", "청년부장") |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | 자동 갱신 트리거 |

**RLS 정책**:
- SELECT: staff
- INSERT/UPDATE/DELETE: admin/master 만 (`is_admin_or_master()`)

**인덱스**: `idx_event_subscribers_active` partial (`is_active = true`)

---

### `alimtalk_sent`

알림톡 발송 추적 (마이그레이션 023). 중복 발송 방지 + 운영 가시성.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `template` | `text NOT NULL` | 카카오 비즈 템플릿 코드 (예: `'event_d1'`) |
| `event_id` | `uuid` | `events.id` ON DELETE CASCADE (nullable — 일정 외 알림 대비) |
| `recipient` | `text NOT NULL` | 정규화된 수신자 전화번호 |
| `sent_at` | `timestamptz DEFAULT now()` | |
| `status` | `text NOT NULL` | `'sent'` \| `'failed'` \| `'noop'` |
| `error` | `text` | 실패/noop 사유 |
| **UNIQUE** | `(template, event_id, recipient)` | 중복 발송 방지 |

**RLS 정책**:
- SELECT: staff (운영 가시성)
- INSERT/UPDATE/DELETE: 정책 없음 — service_role(cron 라우트) 만 가능

**인덱스**: `idx_alimtalk_sent_event`, `idx_alimtalk_sent_at`

---

### `new_family_registrations`

새가족 등록 폼 (공개 페이지 → admin 처리). `chat_inquiries`(006) 와 동일한 익명 INSERT + staff SELECT 패턴. 마이그레이션 024.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `visit_paths` | `text[] NOT NULL DEFAULT '{}'` | 방문 경로 (복수). `'website'` \| `'youtube'` \| `'recommendation'` \| `'visited_first'` \| `'etc'` |
| `visit_paths_etc` | `text` | 기타 방문 경로 직접 입력 (visit_paths 에 'etc' 포함 시) |
| `faith_status` | `text NOT NULL CHECK` | 영접 여부. `'accepted'` \| `'not_yet'` \| `'unsure'` |
| `name` | `text NOT NULL` (1~50자) | 이름 |
| `gender` | `text NOT NULL CHECK` | `'male'` \| `'female'` |
| `birth` | `text NOT NULL` (1~40자) | 자유 텍스트 (`"010101"`, `"음력 010101"` 등) |
| `phone` | `text NOT NULL` (9~20자) | `010-XXXX-XXXX` |
| `region` | `text` (≤100자) | 거주 지역 (선택) |
| `church_history` | `text NOT NULL CHECK` | 신앙생활 여부. `'never'` \| `'attended_no_baptism'` \| `'baptized_inactive'` \| `'baptized_active'` \| `'etc'` |
| `church_history_etc` | `text` | 기타 신앙생활 직접 입력 |
| `message` | `text` (≤2000자) | 자유 메시지 (선택) |
| `privacy_consent` | `boolean NOT NULL CHECK (= true)` | 개인정보 동의 (false 자동 거부) |
| `privacy_consented_at` | `timestamptz NOT NULL DEFAULT now()` | 동의 시각 (보존기간 산정 근거) |
| `status` | `text NOT NULL DEFAULT 'new' CHECK` | 처리 상태. `'new'` \| `'contacted'` \| `'assigned'` \| `'done'` |
| `admin_note` | `text` (≤2000자) | 관리자 메모 |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | 자동 갱신 트리거 |

**RLS 정책**:
- INSERT: 누구나 (`with check (true)`) — 공개 폼
- SELECT: staff (`is_staff()`)
- UPDATE: staff (status / admin_note 변경)
- DELETE: admin/master (`is_admin_or_master()`)

**인덱스**: `idx_new_family_registrations_status`, `idx_new_family_registrations_created_at`

**TypeScript 타입** (`src/types/new-family.ts`):
```ts
type NewFamilyVisitPath = "website" | "youtube" | "recommendation" | "visited_first" | "etc";
type NewFamilyFaithStatus = "accepted" | "not_yet" | "unsure";
type NewFamilyGender = "male" | "female";
type NewFamilyChurchHistory =
  | "never" | "attended_no_baptism" | "baptized_inactive" | "baptized_active" | "etc";
type NewFamilyStatus = "new" | "contacted" | "assigned" | "done";

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
  privacyConsentedAt: string;
  status: NewFamilyStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

### `boards`

소모임 게시판 (마이그레이션 025). admin 이 제목만 입력해 신설하고 멤버를 임의 지정. 용도 끝나면 `is_visible=false` 로 숨김.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` (1~100자) | 게시판 제목 |
| `description` | `text` (≤500자) | 설명 (선택) |
| `is_visible` | `boolean NOT NULL DEFAULT true` | false = 숨김 (멤버에게도 안 보임, admin/master 만 노출) |
| `created_by` | `uuid` | `auth.users.id` ON DELETE SET NULL |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 자동 갱신 트리거 |

**RLS 정책**:
- SELECT: `can_view_board(id)` — 멤버 OR admin/master, 숨김 게시판은 admin/master 만
- INSERT/UPDATE/DELETE: `is_admin_or_master()`

**인덱스**: `idx_boards_visible_created (is_visible, created_at DESC)`

---

### `board_members`

게시판 ↔ 회원 M:N 매핑. admin/master 가 직접 추가/제거 (`PUT /api/admin/boards/[id]/members` 일괄 교체).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `board_id` | `uuid NOT NULL` | `boards.id` ON DELETE CASCADE |
| `profile_id` | `uuid NOT NULL` | `profiles.id` ON DELETE CASCADE |
| `added_at` | `timestamptz NOT NULL DEFAULT now()` | 추가 시각 |
| `added_by` | `uuid` | `auth.users.id` ON DELETE SET NULL — 누가 추가했는지 |
| **PK** | `(board_id, profile_id)` | |

**RLS 정책**:
- SELECT: 본인 (`profile_id = auth.uid()`) OR admin/master
- INSERT/DELETE: admin/master 단독 (`is_admin_or_master()`)

**인덱스**: `idx_board_members_profile (profile_id)`

---

### `board_posts`

게시판 글. 작성자 정보를 직접 컬럼에 보관 (shadow 패턴 미사용 — 멤버에게 노출이 정상이므로 020 패턴과 분리).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | |
| `board_id` | `uuid NOT NULL` | `boards.id` ON DELETE CASCADE |
| `author_id` | `uuid` | `auth.users.id` ON DELETE SET NULL (탈퇴해도 글 보존) |
| `author_name` | `text NOT NULL` | 작성 시점 닉네임 스냅샷 |
| `title` | `text NOT NULL` (1~150자) | |
| `content` | `text NOT NULL` (1~10,000자) | 본문 (HTML/Markdown 미사용 — `whitespace-pre-wrap` 텍스트) |
| `images` | `text[] NOT NULL DEFAULT '{}'` | Supabase Storage `board-images` public URL 배열 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 자동 갱신 트리거 |

**RLS 정책**:
- SELECT: `can_view_board(board_id)`
- INSERT: `is_board_member(board_id) AND author_id = auth.uid()` (서버에서 jwt.sub 강제)
- UPDATE: `author_id = auth.uid() AND is_board_member(board_id)` (본인 + 멤버 자격 유지 시만)
- DELETE: `is_admin_or_master() OR author_id = auth.uid()` (021 패턴)

**인덱스**:
- `idx_board_posts_board_created (board_id, created_at DESC)` — 게시판별 최신순 + cursor 페이지네이션
- `idx_board_posts_author (author_id)`

---

### `board_comments`

게시판 댓글. 작성자 직접 컬럼.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | |
| `post_id` | `uuid NOT NULL` | `board_posts.id` ON DELETE CASCADE |
| `author_id` | `uuid` | `auth.users.id` ON DELETE SET NULL |
| `author_name` | `text NOT NULL` | 작성 시점 닉네임 스냅샷 |
| `content` | `text NOT NULL` (1~1,000자) | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**RLS 정책**:
- SELECT: `EXISTS(board_posts JOIN — can_view_board(bp.board_id))`
- INSERT: `EXISTS(board_posts JOIN — is_board_member(bp.board_id))` AND `author_id = auth.uid()`
- DELETE: `is_admin_or_master() OR author_id = auth.uid()`

**인덱스**: `idx_board_comments_post_created (post_id, created_at)`

**권한 헬퍼 함수** (025):
- `public.is_board_member(p_board_id uuid)` — 사용자가 해당 게시판 멤버인지
- `public.can_view_board(p_board_id uuid)` — 멤버 OR admin/master + is_visible=true (admin 은 숨김도 통과)

---

### `posters`

AI 포스터 생성 메타 + 최종 PNG URL (마이그레이션 026).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 자동 갱신 트리거 (`boards_set_updated_at` 재사용) |
| `created_by` | `uuid` | `auth.users.id` ON DELETE SET NULL |
| `created_by_name` | `text` | 작성 시점 닉네임 스냅샷 |
| `category` | `text NOT NULL CHECK` | `'event'` \| `'welcome'` \| `'group'` \| `'notice'` \| `'custom'` |
| `title` | `text NOT NULL` (1~100자) | 포스터 핵심 제목 |
| `body_text` | `text` (≤500자) | 부가 설명 (선택) |
| `prompt_used` | `text NOT NULL` | Gemini 가 만든 영문 이미지 프롬프트 본문 |
| `ratio` | `text NOT NULL CHECK` | `'1:1'` \| `'9:16'` \| `'a4'` |
| `ai_image_url` | `text NOT NULL` | AI 가 생성한 원본 이미지 URL |
| `final_image_url` | `text NOT NULL` | 한글 텍스트·푸터 합성 후 최종 PNG URL |
| `linked_event_id` | `uuid` | `events.id` ON DELETE SET NULL (Phase 2 연결용, 현재 NULL) |
| `linked_notice_id` | `uuid` | `notices.id` ON DELETE SET NULL (Phase 2 연결용, 현재 NULL) |
| `cost_cents` | `int` | 생성 비용 (선택) |

**RLS 정책**:
- SELECT: staff (`is_staff()`)
- INSERT: staff + (`created_by IS NULL OR created_by = auth.uid()`)
- UPDATE/DELETE: 작성자 본인 OR admin/master

**인덱스**: `idx_posters_created_at (created_at DESC)`, `idx_posters_created_by (created_by, created_at DESC)`

**현재 사용 상태 (피벗 후)**:
2026-05-06 피벗 — Gemini 이미지 모델 직접 호출은 무료 티어 quota 한계로 포기. 대신 **프롬프트 빌더**가 영문 프롬프트만 만들어 사용자가 자기 AI 도구(ChatGPT/Gemini/Midjourney 등)에 붙여 이미지를 생성하고, **이미지 마무리 합성기**가 그 결과 이미지에 한글 텍스트·교회 푸터를 합성한다. **테이블·로그·Storage 버킷은 026에서 만들어졌으나 현재 표시·저장 흐름과 연결되지 않음**. Phase 2 에서 events/notices 와 양방향 연결 시 활성화 예정.

---

### `poster_generations_log`

포스터 생성 rate-limit 추적 (마이그레이션 026). 사용자별 일 20회 제한 검증 용도.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `user_id` | `uuid NOT NULL` | `auth.users.id` ON DELETE CASCADE |
| `variants_count` | `int NOT NULL DEFAULT 1` | 한 번 호출에서 생성된 변형 수 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

**RLS 정책**:
- SELECT: 본인 (`user_id = auth.uid()`) OR admin/master
- INSERT: 본인 + staff (`is_staff() AND user_id = auth.uid()`)

**인덱스**: `idx_poster_gen_log_user_time (user_id, created_at DESC)`

**현재 상태**: 026 에서 생성됐으나 피벗 이후 직접 호출 제거되어 미기록. `posters` 와 동일하게 Phase 2 활성화 대기.

---

### `sermon_videos`

설교 영상 누적 저장 (마이그레이션 032). YouTube 업로드 플레이리스트에서 매일 1회 cron sync → 한 번 들어온 영상은 영구 보존. 표시는 모두 이 테이블에서 읽으며 YouTube API 는 sync 경로에서만 사용.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `video_id` | `text` PK | YouTube videoId |
| `title` | `text NOT NULL` | 제목 |
| `description` | `text NOT NULL DEFAULT ''` | 설명 |
| `thumbnail` | `text NOT NULL DEFAULT ''` | 썸네일 URL |
| `published_at` | `timestamptz NOT NULL` | 게시일 |
| `category` | `text NOT NULL DEFAULT 'all'` | `'sunday'` \| `'wednesday'` \| `'friday'` \| `'dawn'` \| `'praise'` \| `'all'` (sermon-category.ts 와 동기) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | DB 적재일 |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 메타데이터 마지막 갱신일 |

**RLS 정책**:
- SELECT: 누구나 (`USING (true)`)
- INSERT/UPDATE/DELETE: 정책 없음 — service_role(`/api/admin/cron/sync-sermons` cron) 만 가능

**인덱스**:
- `idx_sermon_videos_published_at (published_at DESC)` — 최신순 목록
- `idx_sermon_videos_category` — 카테고리 필터

**Sync 흐름**:
- Vercel Cron `0 6 * * *` (KST 15시) → `/api/admin/cron/sync-sermons` 호출
- `fetchYouTubeUploads(50)` → `categorizeSermon(title)` → upsert (onConflict: video_id)
- 신규/메타 갱신 모두 동일 경로. 기존 row 의 새 영상은 추가만 되고 옛 영상은 삭제되지 않음 (영구 누적)

**TypeScript 타입** (`src/types/youtube.ts`):
```ts
interface SermonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}
```

리더는 `src/lib/sermons.ts` (`getSermonVideos`/`getSermonByVideoId`/`getLatestSermon`).

---

### `content_authors`

컨텐츠 작성자 추적 shadow 테이블 (마이그레이션 020). 베이스 테이블에 author 컬럼을 추가하지 않으므로 공개 응답에 작성자 정보가 절대 노출되지 않음.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `content_type` | `text NOT NULL` | `'notice'` \| `'weekly'` \| `'gallery_album'` \| `'event'` (022 에서 추가) |
| `content_id` | `uuid NOT NULL` | 대상 컨텐츠 id |
| `author_id` | `uuid` | `auth.users.id` (작성자 삭제 시 SET NULL) |
| `author_name` | `text` | 작성 시점의 닉네임 스냅샷 (이후 닉네임 변경에도 과거 기록 유지) |
| `created_at` | `timestamptz DEFAULT now()` | |
| **PK** | `(content_type, content_id)` | |

**RLS 정책**:
- SELECT: staff (admin UI 작성자 표시용)
- INSERT: 정책 없음 — `record_content_author(content_type)` 트리거(SECURITY DEFINER) 만 가능

**트리거 부착 대상**: `notices`, `weeklies`, `gallery_albums`, `events` 의 AFTER INSERT 트리거가 자동 호출.

**용도**:
- admin UI 컨텐츠 목록에 작성자 표시 (`fetchAuthorRecordMap()`)
- DELETE 권한 체크 (`is_content_author()`) — 마이그레이션 021

---

### `shorts_jobs`

쇼츠 생성 파이프라인 작업 단위.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `video_id` | `text NOT NULL UNIQUE` | YouTube videoId |
| `video_title` | `text NOT NULL` | 설교 제목 |
| `video_published_at` | `timestamptz` | 설교 게시일 |
| `video_thumbnail` | `text` | 썸네일 URL |
| `status` | `text NOT NULL DEFAULT 'pending'` | 상태 머신 (아래 참고) |
| `error` | `text` | 실패 시 메시지 |
| `created_at` | `timestamptz DEFAULT now()` | |
| `updated_at` | `timestamptz DEFAULT now()` | |

**status 흐름**: `pending` → `downloading` → `transcribing` → `selecting` → `editing` → `ready_for_review` → `published` / `failed`

**RLS 정책**: 누구나 SELECT, admin만 CUD

**TypeScript 타입** (`src/types/shorts.ts`):
```ts
interface ShortsJob {
  id: string;
  video_id: string;
  video_title: string;
  video_published_at: string | null;
  video_thumbnail: string | null;
  status: JobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}
```

---

### `shorts_clips`

생성된 쇼츠 후보 클립.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `job_id` | `uuid NOT NULL` | `shorts_jobs.id` FK (CASCADE) |
| `clip_index` | `int NOT NULL` | 순서 (0~4) |
| `start_sec` | `numeric NOT NULL` | 시작 초 |
| `end_sec` | `numeric NOT NULL` | 종료 초 |
| `duration_sec` | `numeric GENERATED` | 계산된 길이 |
| `title` | `text` | LLM 생성 제목 |
| `hook` | `text` | 첫 3초 훅 문장 |
| `transcript` | `text` | 선정 이유 |
| `caption_yt` | `text` | YouTube 설명 |
| `caption_ig` | `text` | Instagram 캡션 |
| `video_url` | `text` | Supabase Storage URL |
| `review_status` | `text DEFAULT 'pending'` | `pending`/`approved`/`rejected` |
| `reviewer_note` | `text` | 반려 사유 |
| `youtube_video_id` | `text` | 발행 후 YouTube ID |
| `published_at` | `timestamptz` | 발행 시각 |
| `created_at` | `timestamptz DEFAULT now()` | |

**RLS 정책**: approved 클립은 누구나 SELECT, admin은 모든 상태 SELECT + CUD

**인덱스**: `idx_shorts_clips_job_id`, `idx_shorts_clips_review`

**TypeScript 타입**:
```ts
interface ShortsClip {
  id: string;
  job_id: string;
  clip_index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  title: string | null;
  hook: string | null;
  transcript: string | null;
  caption_yt: string | null;
  caption_ig: string | null;
  video_url: string | null;
  review_status: ReviewStatus;
  reviewer_note: string | null;
  youtube_video_id: string | null;
  published_at: string | null;
  created_at: string;
}
```

---

### `shorts_settings`

쇼츠 글로벌 설정 (싱글톤, id=1).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `int PK CHECK (id = 1)` | 싱글톤 |
| `auto_publish` | `boolean DEFAULT false` | 자동 발행 여부 |
| `max_clips_per_sermon` | `int DEFAULT 5` | 설교당 최대 클립 수 |
| `daily_publish_limit` | `int DEFAULT 5` | 일일 발행 상한 |
| `highlight_prompt` | `text` | Gemini 하이라이트 프롬프트 |
| `metadata_prompt` | `text` | Gemini 메타데이터 프롬프트 |
| `updated_at` | `timestamptz DEFAULT now()` | |

**RLS 정책**: 누구나 SELECT, admin만 UPDATE

---

## Storage 버킷

| 버킷 | 공개 | 용도 |
|-------|------|------|
| `gallery` | public | 갤러리 이미지 |
| `weeklies` | public | 주보 PDF |
| `shorts` | public | 쇼츠 mp4 (임시, 발행 후 삭제 가능) |
| `blog-images` | public | 네이버 블로그 동기화 이미지 + 관리자 UI 히어로 이미지 (notices/churchschool_posts 첨부, 홈 히어로 슬라이더 소스) |
| `board-images` | public | 소모임 게시판 글 첨부 이미지 (마이그레이션 025). 5MB 제한, jpg/png/webp/gif. 멤버만 업로드/삭제 |
| `poster-images` | public | AI 포스터 이미지 (마이그레이션 026). 10MB 제한, png/jpeg/webp. staff 만 업로드/수정/삭제. 피벗 이후 현재 표시 흐름과 미연결 (Phase 2 대기) |

각 버킷 정책: 누구나 읽기, admin만 업로드/삭제. `shorts` 버킷은 service_role도 업로드/삭제 가능 (GitHub Actions용).
`blog-images`는 service_role(네이버 블로그 sync 스크립트) + staff(`is_staff()`, 마이그레이션 016)이 업로드/수정/삭제 가능.
관리자 UI 업로드 경로: `admin-hero/{noticeId}/{timestamp}.{ext}` (네이버 sync 경로 `{logNo}/{n}.{ext}`와 충돌 회피).

### 업로드 제한 (앱 레벨, `src/lib/validation.ts`)

| 버킷 | 허용 확장자 | 최대 크기 | 비고 |
|-------|-----------|----------|------|
| `gallery` | jpg, jpeg, png, gif, webp | 10MB/파일 | 한 번에 최대 30장 |
| `weeklies` | pdf | 20MB/파일 | |
| `shorts` | (GitHub Actions에서 업로드) | - | 앱 레벨 제한 없음 |

---

## 마이그레이션 파일

| 파일 | 내용 |
|------|------|
| `001_initial.sql` | profiles, groups, group_posts + 초기 데이터 |
| `002_gallery.sql` | gallery_albums, gallery_images + storage |
| `003_notices_weeklies.sql` | notices, weeklies + storage |
| `004_gallery_tags.sql` | gallery_albums 에 tags 컬럼 + GIN 인덱스 |
| `005_shorts.sql` | shorts_jobs, shorts_clips, shorts_settings + storage |
| `006_chat_inquiries.sql` | 챗봇 문의 테이블 (`chat_inquiries`) |
| `007_churchschool_posts.sql` | 교회학교 게시물 테이블 |
| `008_chat_rate_limit.sql` | 챗봇 IP 기반 rate limit 테이블 |
| `009_blog_images.sql` | blog-images Storage 버킷 + notices.images, churchschool_posts.images 컬럼 |
| `010_weeklies_content.sql` | weeklies 테이블에 콘텐츠 필드 추가 (20개 컬럼) |
| `011_weeklies_layout_fields.sql` | weeklies 레이아웃 필드 15개 (news, meetings, worship_items 등) |
| `012_bulletin_master_tables.sql` | 주보 마스터 5개 테이블 (church_settings, mokjang_entries, servants, support_sections, community_prayers) |
| `013_mokjang_drop_year.sql` | mokjang_entries.year 제약 완화 |
| `014_profiles_oauth_fields.sql` | profiles 에 email, avatar_url, provider 컬럼 추가 |
| `015_staff_role.sql` | role 에 `'staff'` 추가 + `is_staff()` 헬퍼 + 모든 admin 정책을 staff 로 확대 |
| `016_blog_images_staff_upload.sql` | blog-images 버킷에 staff INSERT/UPDATE/DELETE 정책 추가 |
| `017_handle_new_user_kakao.sql` | Kakao OAuth metadata 처리 (handle_new_user 트리거 갱신) |
| `018_block_duplicate_email_provider.sql` | 동일 이메일이 다른 OAuth provider 로 가입 시 차단 |
| `019_master_role.sql` | role 에 `'master'` 추가 + `is_master()` + role 변경을 master 단독 권한으로 |
| `020_content_authors.sql` | content_authors shadow 테이블 + 작성자 추적 트리거 (notice/weekly/gallery_album) |
| `021_content_delete_policies.sql` | notices/weeklies/gallery_albums/gallery_images DELETE 정책 분리 — 작성자 OR admin OR master 만 |
| `022_events.sql` | 자체 캘린더 events 테이블 + 작성자 트리거 + 021 패턴 DELETE 정책 + content_authors CHECK 에 'event' 추가 |
| `023_alimtalk_subscribers.sql` | event_subscribers + alimtalk_sent (카카오 비즈 알림톡 인프라) |
| `024_new_family_registrations.sql` | new_family_registrations 테이블 (공개 새가족 등록 폼 — 누구나 INSERT, staff SELECT/UPDATE, admin/master DELETE) |
| `025_boards.sql` | 소모임 게시판 시스템 — boards/board_members/board_posts/board_comments + is_board_member/can_view_board 헬퍼 + storage 버킷 board-images. ad-hoc 멤버 모델 (admin 이 제목 입력해 신설 + 멤버 임의 지정 + is_visible 토글로 숨김) |
| `026_posters.sql` | AI 포스터 인프라 — posters/poster_generations_log + storage 버킷 poster-images. 2026-05-06 피벗 이후 직접 호출 제거되어 표시·저장 흐름과 현재 미연결 (Phase 2 대기) |
| `027_drop_weekly_legacy_fields.sql` | weeklies.hymn_number, weeklies.scripture (최상위) DROP — 신규 worship_items 기반 렌더로 통합 |
| `028_weeklies_afternoon_mokjang_mode.sql` | weeklies.afternoon_mokjang_mode boolean — 페이지2 좌상단 셀을 목장모임 이미지로 대체하는 토글 |
| `029_weeklies_special_offering.sql` | weeklies.special_offering jsonb — 헌금 4번째 슬롯(부활감사 자리)을 토글/라벨 변경 가능한 특별헌금으로 분리 |
| `030_weeklies_front_toggles.sql` | weeklies.front_toggles jsonb — 페이지 4(교회소식 영역) 4섹션 표시 토글 (성경통독/새가족/식당봉사/봉사센터) |
| `031_drop_weekly_misc_legacy.sql` | weeklies 의 prayer_items/announcements/servants_text/offering_list_text/sogroup_text DROP — 폼 "기타" 탭 자체 제거. 기도제목은 마스터(community_prayers)로 일원화 |
| `032_sermon_videos.sql` | sermon_videos 테이블 (video_id PK + 카테고리 + RLS 공개 SELECT). YouTube 업로드 플레이리스트에서 일 1회 cron 으로 누적 동기화 — 한 번 들어온 영상은 영구 보존. 표시는 DB 에서만 읽고 YouTube API 호출은 sync 경로 1곳으로 제한 |
| `033_weeklies_front_toggles_meetings.sql` | weeklies.front_toggles jsonb 에 `meetings` 키 추가 + 기존 row 백필. 페이지 4 모임 안내 섹션 표시 토글 |
| `034_events_source_weekly.sql` | events 테이블에 AI 추출 추적 컬럼 3개 (`source_weekly_id` FK + `source_news_index` + `extracted_by_ai`) + 부분 인덱스. 주보 "교회소식" → 일정 AI 추출 (Gemini) 결과 추적 |
| `035_profiles_lock_down.sql` | profiles SELECT 정책 좁히기 — 본인 행 OR staff 만 SELECT 가능. anon 의 전 회원 정보 조회 차단 (PIPA 위반 차단) |
| `036_drop_weeklies_pdf_url.sql` | weeklies.pdf_url 컬럼 DROP — PDF 자동 생성 라우트가 모든 호출 동선을 잃어 dead 상태. 컬럼/라우트/puppeteer 의존성(@sparticuz/chromium*, puppeteer-core) 일괄 정리. Storage 버킷 'weeklies' 와 정책은 보존 |
| `037_align_rls_with_ui_matrix.sql` | UI 매트릭스(`src/lib/admin-permissions.ts`)와 RLS 일치. notices / weeklies(+storage) / weekly masters(church_settings·mokjang_entries·servants·support_sections·community_prayers) / events INSERT·UPDATE / event_subscribers SELECT / alimtalk_sent SELECT / chat_inquiries SELECT / new_family_registrations SELECT·UPDATE / storage 'blog-images' 의 staff 정책을 `is_admin_or_master()` 로 좁힘. 공개 SELECT, 작성자 본인 DELETE(021), anon INSERT(chat/new-family) 흐름은 보존 |
