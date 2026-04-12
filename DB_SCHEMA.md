# 데이터베이스 스키마

Supabase (PostgreSQL) 기반. 모든 테이블에 Row Level Security(RLS) 적용.

---

## 테이블

### `profiles`

Supabase Auth `auth.users`를 확장하는 사용자 프로필.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | `auth.users.id` 참조 |
| `name` | `text NOT NULL` | 사용자 이름 |
| `phone` | `text` | 전화번호 (nullable) |
| `role` | `text DEFAULT 'member'` | `'member'` 또는 `'admin'` |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책**:
- 모든 사용자: SELECT 가능
- 본인만: UPDATE 가능 (`auth.uid() = id`)

**트리거**: `auth.users` INSERT 시 자동으로 `profiles` 레코드 생성.

**TypeScript 타입** (`src/types/supabase.ts`):
```ts
interface Profile {
  id: string;
  name: string;
  phone: string | null;
  role: "member" | "admin";
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
| `content` | `text NOT NULL` | 본문 |
| `is_public` | `boolean DEFAULT true` | 공개 여부 |
| `date` | `date` | 날짜 (nullable) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책**:
- 공개 공지: 모든 사용자 SELECT 가능
- admin만: INSERT, UPDATE, DELETE

**TypeScript 타입** (`src/types/notice.ts`):
```ts
interface Notice {
  id: string;
  title: string;
  slug: string;
  category: "일반" | "긴급" | "행사";
  content: string;
  is_public: boolean;
  date: string | null;
  created_at: string;
}
```

---

### `weeklies`

주보 (주간 게시물, PDF).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | 자동 생성 |
| `title` | `text NOT NULL` | 제목 |
| `date` | `date` | 날짜 (nullable) |
| `pdf_url` | `text` | PDF 파일 URL (nullable) |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책**: 공지와 동일 (공개 읽기, admin 쓰기)

**TypeScript 타입**:
```ts
interface Weekly {
  id: string;
  title: string;
  date: string | null;
  pdf_url: string | null;
  created_at: string;
}
```

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

**RLS 정책**: 공개 앨범 읽기, admin 쓰기

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

**RLS 정책**: 공개 이미지 읽기, admin 쓰기

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

각 버킷 정책: 누구나 읽기, admin만 업로드/삭제. `shorts` 버킷은 service_role도 업로드/삭제 가능 (GitHub Actions용).

---

## 마이그레이션 파일

| 파일 | 내용 |
|------|------|
| `supabase/migrations/001_initial.sql` | profiles, groups, group_posts + 초기 데이터 |
| `supabase/migrations/002_gallery.sql` | gallery_albums, gallery_images + storage |
| `supabase/migrations/003_notices_weeklies.sql` | notices, weeklies + storage |
| `supabase/migrations/004_gallery_tags.sql` | gallery_albums에 tags 컬럼 + GIN 인덱스 |
| `supabase/migrations/005_shorts.sql` | shorts_jobs, shorts_clips, shorts_settings + storage |
