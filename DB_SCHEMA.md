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
| `category` | `text` | `'예배'`, `'교회학교'`, `'교회행사'`, `'봉사센터'`, `'새가족'` (nullable) |
| `date` | `date` | 날짜 (nullable) |
| `thumbnail_url` | `text` | 썸네일 URL (nullable) |
| `is_public` | `boolean DEFAULT true` | 공개 여부 |
| `created_at` | `timestamptz DEFAULT now()` | 생성일 |

**RLS 정책**: 공개 앨범 읽기, admin 쓰기

**TypeScript 타입** (`src/types/gallery.ts`):
```ts
interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;
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

## Storage 버킷

| 버킷 | 공개 | 용도 |
|-------|------|------|
| `gallery` | public | 갤러리 이미지 |
| `weeklies` | public | 주보 PDF |

각 버킷 정책: 누구나 읽기, admin만 업로드/삭제.

---

## 마이그레이션 파일

| 파일 | 내용 |
|------|------|
| `supabase/migrations/001_initial.sql` | profiles, groups, group_posts + 초기 데이터 |
| `supabase/migrations/002_gallery.sql` | gallery_albums, gallery_images + storage |
| `supabase/migrations/003_notices_weeklies.sql` | notices, weeklies + storage |
