# 소모임 게시판 시스템 — 설계 보고서 (rev. 2)

> 작성일: 2026-05-02
> 범위: 웹페이지 전용. 모바일은 별도 작업.
> 전제: Next.js 16.2.2 App Router + Supabase + 기존 admin/auth/RLS 패턴 그대로 유지.
> AGENTS.md 행동 규칙 준수 — 본 문서는 **설계 보고서**이며 코드 변경은 포함하지 않는다.

> **개정 이력**: 초안에서는 목장/선교회 소속을 정규화 테이블로 묶어 자동 게이팅하려 했으나,
> 사용자 의견에 따라 **"제목만 적어 게시판 생성 + 멤버는 admin 이 그때그때 임의 지정 + 용도
> 끝나면 숨김 처리"** 의 ad-hoc 모델로 단순화. 두 종류 소속 모델은 폐기.

---

## 0. TL;DR

1. **요구사항 요약**
   - admin 이 **게시판 제목만** 입력해 생성
   - 게시판마다 **접근 가능 멤버를 admin 이 임의로 지정** (목장/선교회 같은 정규화 소속 개념 없음)
   - 게시판 용도가 끝나면 **숨김 처리**(soft hide) — 글·댓글은 보존, 더 이상 노출 안 됨
   - 게시판은 제목·본문·댓글·이미지, 작성자 표시, 작성자/admin 삭제권
2. **핵심 결정**
   - 단 4개 테이블: `boards`, `board_members`, `board_posts`, `board_comments`
   - 멤버 매핑은 **board_members 단일 M:N 테이블** — admin 이 회원 검색/멀티선택해 등록
   - 숨김은 `boards.is_visible boolean` 한 컬럼. 멤버 RLS 가 `is_visible=true AND 멤버` 로 조합
   - 권한 체계는 **이미 검증된 021 패턴** 답습 — `author_id = auth.uid() OR is_admin_or_master()`
3. **노출 위치** — 회원 영역 `(member)/boards/*`. 기존 `/groups`(거의 안 쓰는 정적 토론) 와 충돌 회피.
4. **신규 마이그레이션 1개**(025) + 신규 라우트 ~10개. 기존 코드 수정은 거의 없음 — 미들웨어 matcher 1줄, AdminNav 메뉴 1줄.
5. **난이도** — 중간 하. 가장 까다로운 부분은 **board_members 와 board_posts 사이의 RLS cascade**(섹션 6). 멤버 검색·이미지 업로드·댓글은 모두 프로젝트에 동일 패턴이 이미 있어 모방으로 충분.
6. **의도적으로 v1 에서 제외** — 좋아요, @멘션, 알림(알림톡), 첨부파일(이미지 외), 검색, 무한스크롤, board 모더레이터. 모두 v2 후보.

---

## 1. 요구사항 분해

| ID | 요구사항 | 분해 |
|---|---|---|
| R1 | admin 이 게시판 제목 입력해 생성 | `/admin/boards` 에서 모달/폼 — 제목 + 설명(옵션) |
| R2 | 게시판마다 접근 멤버를 admin 이 그때그때 지정 | 같은 페이지에서 회원 검색·다중 선택 → `board_members` M:N |
| R3 | 게시판 용도 끝나면 숨김 처리 | `is_visible` 토글. 데이터 보존, 비멤버에게 안 보임. 멤버에게도 안 보임. admin 만 노출 |
| R4 | 제목, 글, 댓글, 사진 업로드 | board_posts(title, content, images[]) + board_comments(content) |
| R5 | 작성자 표시 | author_id + author_name 스냅샷 직접 컬럼 (섹션 5-3 근거) |
| R6 | 작성자/admin 삭제권 | 021 패턴 (`is_admin_or_master() OR author_id = auth.uid()`) |
| 비기능 | 웹 only, 모바일 차후 | DTO 와 API 라우트는 모바일 호환을 의식해 `createApiClient(request)` 패턴 그대로 유지 |

---

## 2. 도메인 모델

```
       ┌──────────────┐
       │   profiles   │ (기존 — OAuth 가입자)
       └──────┬───────┘
              │ 회원 검색용
              ▼
       ┌──────────────┐                ┌────────────┐
       │ board_members│ ───────────────►   boards   │ ◄── admin 이 제목 입력
       │ (M:N)        │     belongs to │ is_visible │     멤버 다중 선택해 생성
       └──────────────┘                └─────┬──────┘
                                             │
                              ┌──────────────┴───────────────┐
                              ▼                              ▼
                     ┌─────────────────┐         ┌──────────────────┐
                     │  board_posts    │ ◄────── │ board_comments   │
                     │  images[]       │         │ (post_id FK)     │
                     │  author_id/name │         │ author_id/name   │
                     └─────────────────┘         └──────────────────┘
```

**핵심 단순화**:
- 멤버십이 board_members 한 곳에만 존재 → 게시판마다 독립적
- 한 회원이 여러 게시판에 속할 수 있음 (예: 자기 목장 게시판 + 임시 행사 준비 게시판)
- 한 회원이 0개 게시판이어도 시스템 OK (그냥 `/boards` 목록이 빔)
- admin/master 는 모든 게시판 관리 권한 (board_members 무관)

---

## 3. DB 스키마 (마이그레이션 025 — 단일 파일)

### 3-1. `boards`

```sql
CREATE TABLE public.boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR length(description) <= 500),
  is_visible  boolean NOT NULL DEFAULT true,            -- false = 숨김 (멤버에게 안 보임)
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_boards_visible_created ON public.boards(is_visible, created_at DESC);
```

### 3-2. `board_members`

```sql
CREATE TABLE public.board_members (
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (board_id, profile_id)
);
CREATE INDEX idx_board_members_profile ON public.board_members(profile_id);
```

### 3-3. `board_posts`

```sql
CREATE TABLE public.board_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,                              -- 작성 시점 닉네임 스냅샷
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 10000),
  images      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_posts_board_created ON public.board_posts(board_id, created_at DESC);
CREATE INDEX idx_board_posts_author ON public.board_posts(author_id);
```

### 3-4. `board_comments`

```sql
CREATE TABLE public.board_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_comments_post_created ON public.board_comments(post_id, created_at);
```

### 3-5. updated_at 트리거

기존 `events_set_updated_at()` 와 동일 패턴 — `boards`, `board_posts` 두 테이블에 BEFORE UPDATE 부착.

---

## 4. 권한 / RLS 설계

### 4-1. 멤버십 헬퍼 함수 (신규)

```sql
-- 사용자가 특정 board 의 멤버인지 (단순 EXISTS — board_members 가 단일 테이블이라 매우 간단)
CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND profile_id = auth.uid()
  );
$$;

-- 게시판이 가시 상태이고 사용자가 멤버 OR admin/master 인지 (조회·열람 통합 게이트)
CREATE OR REPLACE FUNCTION public.can_view_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_master()
    OR EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = p_board_id
        AND b.is_visible = true
        AND public.is_board_member(b.id)
    );
$$;
```

### 4-2. 정책 매트릭스

| 테이블 | 작업 | 정책 |
|---|---|---|
| `boards` | SELECT | `can_view_board(id)` (숨김 게시판은 admin 만) |
| `boards` | INSERT/UPDATE/DELETE | `is_admin_or_master()` |
| `board_members` | SELECT | `is_admin_or_master() OR profile_id = auth.uid()` (본인 가입 여부 + admin 전체 조회) |
| `board_members` | INSERT/DELETE | `is_admin_or_master()` |
| `board_posts` | SELECT | `can_view_board(board_id)` |
| `board_posts` | INSERT | `is_board_member(board_id) AND author_id = auth.uid()` (숨김 게시판이라도 멤버는 볼 수 있어야 하므로 is_visible 가드는 SELECT 만; 일반적으로 숨김 시 글쓰기 자체가 UI 에서 막힘) |
| `board_posts` | UPDATE | `author_id = auth.uid() AND is_board_member(board_id)` |
| `board_posts` | DELETE | `is_admin_or_master() OR author_id = auth.uid()` |
| `board_comments` | SELECT | EXISTS(board_posts JOIN — `can_view_board(bp.board_id)`) |
| `board_comments` | INSERT | EXISTS(board_posts JOIN — `is_board_member(bp.board_id)`) AND `author_id = auth.uid()` |
| `board_comments` | DELETE | `is_admin_or_master() OR author_id = auth.uid()` |

### 4-3. 댓글 RLS 의 EXISTS 서브쿼리 예시

```sql
CREATE POLICY "members read comments" ON public.board_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.board_posts bp
      WHERE bp.id = board_comments.post_id
      AND public.can_view_board(bp.board_id)
    )
  );
```

성능: post_id 인덱스 + board_id 인덱스 + 멤버십 인덱스 모두 있어 단순 EXISTS — 1~2 IO.

### 4-4. Storage RLS — `board-images` 버킷

```sql
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('board-images', 'board-images', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO NOTHING;

-- 읽기: 누구나 (URL 알면)
CREATE POLICY "Public read board-images"
  ON storage.objects FOR SELECT USING (bucket_id = 'board-images');

-- 쓰기: 인증 + 어떤 board 든 멤버라면 OK. 첨부 시 board RLS 가 진짜 게이트.
CREATE POLICY "Members upload board-images"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'board-images'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_admin_or_master()
      OR EXISTS (
        SELECT 1 FROM public.board_members WHERE profile_id = auth.uid()
      )
    )
  );

-- 삭제: 본인 글 지울 때 호출. 간이 정책 — admin/master OR 멤버.
CREATE POLICY "Members delete board-images"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'board-images'
    AND (
      public.is_admin_or_master()
      OR EXISTS (
        SELECT 1 FROM public.board_members WHERE profile_id = auth.uid()
      )
    )
  );
```

**Path 컨벤션**: `board-images/{boardId}/{userId}/{timestamp}.{ext}` — 추후 path 기반 RLS 로 좁히고 싶을 때 깔끔.

**버킷 RLS 의 한계 인정** — 어떤 게시판이든 멤버라면 임의 path 에 업로드는 가능. 진짜 게이트는 **`board_posts.images[]` 에 URL 을 INSERT 할 때 board RLS** (해당 board 의 멤버여야 함). 고아 파일은 v2 cron 청소.

---

## 5. 주요 설계 결정과 근거

### 5-1. "정규화 소속" 모델 폐기

초안에서는 `mokjang_entries`(목장) + `mission_groups`(선교회) 두 축으로 멤버 소속을 정규화하고 RLS 가 자동 매칭하도록 했음. 사용자 의견 — **모든 목장·선교회가 게시판을 만들 것 같지 않다**. 따라서:
- 정규화 매핑 테이블 2개 폐기 (`profile_mokjangs`, `profile_missions`)
- 별도 `mission_groups` 테이블 폐기
- 게시판의 `scope_type`/`scope_xxx` 컬럼 폐기
- 한 테이블 `board_members` 로 단순화

장점: 운영 비용·DB 복잡도 모두 낮아짐. 정규화는 실제 운영 사례가 누적되어 **자동화 필요성이 명확해진 시점**(예: "모든 목장에 매주 게시판 자동 신설") 에 v2 로 도입해도 늦지 않음.

### 5-2. 숨김(`is_visible`) — soft hide vs delete

| 전략 | 설명 | 평가 |
|---|---|---|
| (a) `is_active` boolean | 활성/비활성 토글, 멤버에게도 비활성은 안 보임, admin 만 토글·복원 | **채택** (이름은 `is_visible` 로) |
| (b) `archived_at` timestamptz | NULL = 활성, 값 = 보관 시각. 시간 정보 추가 | v2 — 통계용으로 의미 있을 때 |
| (c) DELETE | 모든 글·댓글 cascade. 운영 실수 시 복구 불가 | "정말 영구 삭제" 버튼만 별도 |

→ `is_visible=false` 는 게시판을 멤버 시야에서 빼지만, admin/master 는 그대로 보고 다시 켤 수 있다. 전체 삭제는 별도 "영구 삭제" 동작.

### 5-3. 작성자: shadow 테이블 vs 직접 컬럼

기존 `content_authors`(020) shadow 패턴은 **공개 응답에 작성자 미노출** 이 목적. 본 시스템은:
- 작성자 표시가 **핵심 요구사항**(R5) — 멤버에게 보여야 함
- 응답에 항상 노출이라 shadow 의 이점 없음

→ **직접 컬럼 `author_id` + `author_name`**. 이유:
- 공개 노출이 의도된 응답이라 shadow 불필요
- JOIN/N+1 회피 — 목록·상세 쿼리 단순
- `author_name` 은 작성 시점 스냅샷 — 닉네임 변경/탈퇴 후에도 과거 글 표시 유지
- DELETE 권한은 `author_id = auth.uid()` 직접 매칭 (021 의 `is_content_author` 호출 대체)

→ `content_authors` CHECK 제약에 `'board_post'` 추가하지 **않음**. 시스템 분리.

### 5-4. profiles 검색 vs 별도 admin 검색 라우트

admin 이 멤버 추가 시 회원을 찾아야 함. 옵션:
- (a) 클라이언트에서 `supabase.from('profiles').select('id,name,email').ilike(name)` — profiles SELECT 가 누구나 허용이라 작동
- (b) 서버 라우트 `/api/admin/profiles/search?q=...` — 마스킹·rate limit 가능

→ **(b) 추천**. 이유: 회원 이메일을 admin 이 보는 건 정상이지만 anon 클라이언트로 그대로 노출되는 건 보안상 깨끗하지 못함. profiles SELECT 정책을 좁히는 별도 마이그레이션은 다른 페이지에 영향 — 본 마이그레이션 범위 밖. 대신 admin 라우트로 한정.

→ **간단 대안 (a)**: 본 v1 에선 (a) 로 시작 — 기존 갤러리 admin 등도 클라이언트가 직접 supabase 를 호출하는 패턴. 라우트 신설 비용 절약. 마스킹은 선택적 v2.

→ **결론**: v1 은 **(a)** — 클라이언트가 `profiles` 직접 검색.

---

## 6. API 설계

기존 패턴(`new-families`, `calendar`) 그대로 — `createApiClient(request)` + `requireAdmin/Master`. 모바일 호환은 자동.

| 라우트 | 메서드 | 권한 | 용도 |
|---|---|---|---|
| `/api/boards` | GET | 인증 | 내가 속한(가시) 게시판 + admin 이면 전체 |
| `/api/admin/boards` | GET/POST | admin/master | 게시판 CRUD (목록 + 신설) |
| `/api/admin/boards/[id]` | PATCH/DELETE | admin/master | 제목/설명/숨김 토글, 영구 삭제 |
| `/api/admin/boards/[id]/members` | GET/PUT | admin/master | 멤버 목록 조회 + 일괄 교체 |
| `/api/boards/[id]/posts` | GET/POST | 멤버(+admin) | 글 목록 / 작성 |
| `/api/boards/[id]/posts/[postId]` | GET/PATCH/DELETE | 멤버(+admin) | 글 상세·수정·삭제 |
| `/api/boards/[id]/posts/[postId]/comments` | GET/POST | 멤버(+admin) | 댓글 목록 / 작성 |
| `/api/boards/[id]/posts/[postId]/comments/[cid]` | DELETE | 댓글 작성자 OR admin | 댓글 삭제 |

### 6-1. 멤버 일괄 교체 (`PUT /api/admin/boards/[id]/members`)

```ts
PUT /api/admin/boards/{id}/members
body: { profileIds: string[] }   // 새 멤버 명단 (전체 교체)
```

서버:
1. 트랜잭션 (RPC 또는 service_role) 으로 기존 행 DELETE → 새 명단 INSERT
2. profile_id 화이트리스트 검증 (실존 profiles 인지)
3. 응답: 갱신된 멤버 목록

**대안 — 추가/제거 분리** (`POST /members`, `DELETE /members/[profileId]`): 부분 업데이트가 더 자연스럽지만, **소규모 게시판(수십명)** 가정상 일괄 교체 UX 가 admin UI 작성 부담이 적음.

### 6-2. 이미지 업로드 흐름

`/admin/notices` 의 hero 업로드(`image-compress.ts` + `supabase.storage.from(...).upload`) 그대로 답습:

```
브라우저
  1) validateFile (확장자/크기, ALLOWED_IMAGE_EXTENSIONS, 5MB)
  2) >5MB 면 compressImage() 자동 압축
  3) supabase.storage.from('board-images').upload(`{boardId}/{userId}/{ts}.{ext}`)
     → Storage RLS 가 멤버 여부 검증
  4) getPublicUrl → URL
  5) POST /api/boards/{id}/posts  body: { title, content, images: [url...] }
     → board_posts INSERT, RLS 가 board 멤버 검증
```

### 6-3. Zod 스키마 (`src/lib/validation.ts` 추가)

```ts
export const BoardCreateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  initialMemberIds: z.array(z.string().uuid()).max(500).optional(),  // 생성과 동시에 멤버 셋업
});

export const BoardUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isVisible: z.boolean().optional(),
});

export const BoardMembersReplaceSchema = z.object({
  profileIds: z.array(z.string().uuid()).max(500),
});

export const BoardPostSchema = z.object({
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(10000),
  images: z.array(z.string().url()).max(10).default([]),
});

export const BoardCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});
```

### 6-4. DTO 타입 (`src/types/board.ts`)

```ts
export interface Board {
  id: string;
  title: string;
  description: string | null;
  isVisible: boolean;
  memberCount: number;       // 서버 합성
  postCount: number;         // 서버 합성 (옵션)
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  profileId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

export interface BoardPost {
  id: string;
  boardId: string;
  authorId: string | null;
  authorName: string;
  title: string;
  content: string;
  images: string[];
  commentCount: number;
  canDelete: boolean;          // 서버 계산: admin/master OR 본인
  createdAt: string;
  updatedAt: string;
}

export interface BoardComment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  canDelete: boolean;
  createdAt: string;
}
```

---

## 7. 파일 구조

### 7-1. 신규

```
supabase/migrations/
  025_boards.sql                     # 모든 테이블·RLS·헬퍼·트리거·storage 한 파일

src/types/
  board.ts                           # Board, BoardPost, BoardComment, BoardMember DTO

src/lib/
  boards.ts                          # 서버 사이드 fetch 헬퍼 (목록, 상세 + 권한)

src/app/(member)/
  boards/
    page.tsx                         # 내가 속한 게시판 목록
    [boardId]/
      page.tsx                       # 글 목록 + 글쓰기 버튼
      [postId]/
        page.tsx                     # 글 상세 + 댓글
      BoardPostList.tsx              # 클라이언트 컴포넌트
      BoardPostForm.tsx              # 작성 폼 (이미지 업로드)
      BoardPostDetail.tsx            # 상세 + 댓글 영역

src/app/admin/
  boards/
    page.tsx                         # 게시판 목록 + 신설 폼 + 활성 토글
    [id]/
      members/
        page.tsx                     # 멤버 관리 (검색, 다중선택, 저장)
        MemberPicker.tsx             # profiles 검색 + multi-select 컴포넌트

src/app/api/
  boards/
    route.ts                         # GET 내 게시판 목록
    [id]/
      posts/
        route.ts                     # GET / POST
        [postId]/
          route.ts                   # GET / PATCH / DELETE
          comments/
            route.ts                 # GET / POST
            [cid]/route.ts           # DELETE
  admin/
    boards/
      route.ts                       # GET / POST
      [id]/
        route.ts                     # PATCH / DELETE
        members/
          route.ts                   # GET / PUT
```

### 7-2. 수정 (최소)

| 파일 | 변경 |
|---|---|
| `src/lib/validation.ts` | 5개 스키마 추가 (BoardCreate/Update/MembersReplace/Post/Comment) |
| `src/app/admin/AdminNav.tsx` | `AdminIconKey` 에 `boards` 추가 + 아이콘 (`Layers` 또는 `MessageSquareText`) |
| `src/app/admin/layout.tsx` | `baseNav` 에 "게시판" 메뉴 1줄 |
| `src/middleware.ts` | matcher 에 `/boards/:path*` 추가 (1줄) |
| `src/components/layout/nav-config.ts` | (선택) "교회소개" 드롭다운에 "소모임 게시판" 메뉴 추가 |

### 7-3. 의도적으로 손대지 않는 파일

- `src/app/(member)/groups/*` — 기존 정적 토론. 본 시스템과 별개. 사용자 결정 전까지 유지.
- 베이스 테이블 `notices/weeklies/gallery_albums` — 무관
- `content_authors` — `'board_post'` 추가하지 **않음** (섹션 5-3 결정)
- `mokjang_entries` — 주보용 그대로. 본 시스템과 무관 (사용자 결정).

---

## 8. UI/UX 흐름

### 8-1. admin 흐름

```
/admin/boards
   │
   ├─ 목록 (제목, 멤버수, 글수, 가시/숨김 토글, 삭제)
   │
   ├─ [+ 새 게시판] 버튼
   │     ▼
   │  모달
   │     · 제목 (필수, 1~100자)
   │     · 설명 (선택)
   │     · 멤버 검색 + 다중 선택 (선택, 나중에 편집 가능)
   │     [생성] → POST /api/admin/boards
   │
   └─ 행 클릭 → /admin/boards/{id}/members
            │
            ├─ 현재 멤버 칩 목록 (이름 + 제거 X 버튼)
            ├─ 회원 검색 입력 (profiles 클라이언트 직접 쿼리)
            ├─ 검색 결과에서 클릭 시 멤버에 추가
            └─ [저장] → PUT /api/admin/boards/{id}/members  (전체 교체)
```

**가시 토글**: `is_visible=true ↔ false`. 토글 시 즉시 반영. 멤버는 다음 페이지 진입 때 사라짐 (RLS 차단).

**영구 삭제**: 별도 빨간 버튼 + confirm. CASCADE 로 글·댓글 다 사라짐. 신중히 사용.

### 8-2. 멤버 흐름 (회원 영역)

```
/login (Google/Kakao)
   ▼
/boards                          ← 내가 속한 (가시) 게시판 카드 목록
   │  (속한 곳 0개면: "운영진에 게시판 등록을 요청하세요")
   ▼
/boards/{boardId}                ← 글 목록 (제목, 작성자, 날짜, 댓글수)
   │  [+ 글쓰기]
   ▼
/boards/{boardId}/{postId}       ← 상세 (제목, 작성자/날짜, 본문, 이미지 라이트박스,
                                          댓글 목록, 댓글 폼,
                                          삭제 버튼은 권한 있을 때만)
```

기존 컴포넌트 재활용:
- `Container`, `PageHeader` — 공개 페이지와 동일
- `useMe()` + `canDelete()` — 삭제 버튼 노출 게이트
- `compressImage()` + `validateFile()` — 5MB 자동 압축
- `formatDate()` — 작성일 표기
- `yet-another-react-lightbox` — 이미지 라이트박스 (이미 설치)

### 8-3. 헤더/네비 통합 위치

옵션:
| 옵션 | 위치 | 평가 |
|---|---|---|
| (A) "교회소개" 드롭다운에 "소모임 게시판" 1줄 | 가장 가벼움. 비인증자도 보이지만 클릭 시 로그인 | **추천 v1** |
| (B) 새 최상위 메뉴 "소모임" | 시각적 가중치 큼 | v2 |
| (C) AuthButton 옆 "내 게시판" 버튼 (인증 시만) | 비로그인 시 안 보여서 깔끔 | v1.5 |

**추천: A**. nav-config.ts 1줄. 원치 않으면 안 추가해도 회원이 직접 `/boards` URL 접근 가능.

---

## 9. 핵심 시나리오 검증

| # | 시나리오 | 통과 조건 |
|---|---|---|
| 1 | admin 이 게시판 신설하고 멤버 5명 지정 | `/admin/boards` 신설 → board 1행 + board_members 5행 |
| 2 | 비멤버가 URL 추측해 `/boards/{id}` 접근 | RLS SELECT 차단 → 빈 응답 → notFound() |
| 3 | 멤버가 글쓰기 + 이미지 첨부 | board_posts INSERT 통과, storage 업로드 통과 |
| 4 | 멤버가 다른 멤버 글 삭제 시도 | RLS DELETE 차단 (`author_id ≠ auth.uid() AND not admin`) |
| 5 | admin 이 게시판 숨김 토글 | `is_visible=false` → 멤버 SELECT 실패 → 목록·상세 빈 응답 |
| 6 | admin 이 멤버 명단 교체 | PUT 으로 일괄 교체. 제거된 멤버는 즉시 접근 불가 |
| 7 | 회원 탈퇴 (auth.users 삭제) | 작성자 글 보존 (`author_id NULL`, `author_name` 스냅샷). board_members 의 해당 행 cascade 제거 |
| 8 | 게시판 영구 삭제 | board → posts → comments cascade. storage 파일은 별도 cleanup |
| 9 | admin 이 모든 숨김 게시판도 보고 다시 가시화 | `can_view_board()` 의 `is_admin_or_master()` 분기 |
| 10 | 한 회원이 게시판 A·B·C 모두 가입 | board_members 3행. `/boards` 목록에 3개 카드 |

---

## 10. 보안 점검

- ✅ **멤버 외 접근 차단**: SELECT 정책 `can_view_board(board_id)`. 비멤버는 글 한 줄도 못 봄.
- ✅ **타 게시판 끼워넣기 방지**: INSERT WITH CHECK (`is_board_member(board_id) AND author_id = auth.uid()`).
- ✅ **타인 사칭 차단**: `author_id = auth.uid()` 강제 (서버에서 클라이언트 입력 무시하고 jwt.sub 사용).
- ✅ **숨김 게시판 노출 차단**: `is_visible=true` 가드 → 멤버에게도 안 보임. admin 만 노출.
- ✅ **Storage 무결성**: 누구나 멤버라면 업로드 가능하지만, board_posts.images[] 에 URL 을 INSERT 할 권한이 없으면 노출 안 됨.
- ✅ **삭제 권한**: 작성자 OR admin/master. 021 패턴 답습.
- ✅ **CASCADE 안전**: board → posts → comments. board_members 도 cascade. 글 작성자는 SET NULL + 스냅샷.
- ✅ **XSS**: 본문은 `whitespace-pre-wrap` 텍스트로만 렌더 (Markdown/HTML 미파싱).
- ✅ **CSP**: 기존 self + Supabase 허용으로 충분.
- ⚠ **rate limit 미구현 v1** — 도배 방지 필요 시 v2 (`board_post_rate_limit`).
- ⚠ **이미지 EXIF** — compressImage() Canvas 재인코딩이 자동 제거 → 사실상 OK.
- ⚠ **Storage 고아 파일** — board_posts.images 에 미등록 업로드 누적. v2 정기 청소 cron.
- ⚠ **profiles 검색** — v1 은 클라이언트가 직접 supabase 쿼리. 회원 이메일이 admin 페이지 네트워크에 노출. 운영상 admin/master 만 보는 페이지라 OK 수준이지만, 강화하려면 v2 admin 검색 라우트 + 마스킹.

---

## 11. 점진 도입 순서 (마이그레이션 0 → v1 라이브)

| Phase | 산출물 | 검증 |
|---|---|---|
| 1. DB | 025 마이그레이션 적용 | Supabase 스튜디오에서 RLS 4 정책 확인 |
| 2. 게시판 신설 | `/admin/boards` 에서 테스트 게시판 1개 (멤버 = 본인 + 운영자 1명) | boards + board_members 행 확인 |
| 3. 멤버 흐름 | `/boards` → 글쓰기 → 댓글 → 이미지 첨부 → 삭제 | 4가지 오용 시나리오 다 막힘(섹션 9) |
| 4. 숨김/복원 | `/admin/boards` 에서 가시 토글 | 멤버 측에서 사라짐, admin 에서 다시 켜면 복원 |
| 5. 영구 삭제 | confirm 후 cascade | board_members/posts/comments 모두 사라짐 |
| 6. 운영 시작 | 실제 소모임 신청 받아 신설 | 알림 시스템 없으니 슬랙·전화로 운영자가 전파 |
| 7. typecheck/build | `npm run typecheck && npm run build` | 0 에러 |

---

## 12. v2 후보 (지금 안 할 것)

| 항목 | 비고 |
|---|---|
| 좋아요 / 이모지 반응 | board_reactions 테이블 1개 |
| @멘션 + 알림톡 | 카카오 비즈 인프라 (023) 가 이미 있어 비교적 저렴 |
| 검색 | content tsvector + GIN. 글 1000개 넘기 전엔 불필요 |
| 페이지네이션 (무한 스크롤) | v1 은 단순 limit=50. 100건 넘기 전엔 불필요 |
| 첨부파일 (PDF 등) | 별도 버킷 + RLS. 우선 이미지로 충분 |
| 게시판 모더레이터 (소모임장에 글 삭제권 부여) | 지금은 admin 만. board_members 에 `role` 컬럼 추가하면 됨 |
| Rate limit / 도배 방지 | 008 챗봇 패턴 답습 |
| 고아 파일 cron 청소 | weekly 스케줄로 board-images 와 board_posts.images 비교 |
| 정규화 소속 자동 매칭 | 운영 사례가 누적돼 자동화 가치가 명확해지면 다시 고려 (초안의 mokjang/mission 모델) |

---

## 13. 결론 — 난이도 / 공수 추정

| 항목 | 추정 |
|---|---|
| 마이그레이션 025 (DDL + 헬퍼 + RLS + storage) | 150~200줄, 1회 검토 후 적용 |
| API 라우트 10개 | 각 30~80줄. new-families 패턴 그대로 |
| admin 페이지 2개 (boards 목록·신설, 멤버 관리) | 각 200~300줄. notices/event-subscribers 패턴 |
| 멤버 페이지 3개 (목록, 게시판, 글상세 + 댓글) | 각 150~300줄. DiscussionList + new-family-form 패턴 |
| 검증 스키마 + DTO | 40줄 |
| nav 통합 | 5줄 |
| **총합** | 약 **1,500~2,000줄 신규**, 기존 파일 수정은 **20줄 미만** |

**난이도 평가**: 새가족 등록 시스템(1 테이블, 1 페이지)보다 **2~3배** 큼. 그러나 **모든 부분이 기존 패턴의 조합** — 새로운 발명품 없음.

| 검증 패턴 | 반영 |
|---|---|
| 020 content_authors shadow | 의도적으로 사용 안 함 (섹션 5-3) |
| 021 작성자 OR admin 삭제 | 거의 그대로 답습 |
| 022 events 의 작성자 추적 + RLS | 답습 |
| 024 new-families 의 admin CRUD UI | 답습 |
| /admin/notices 의 storage 업로드 + 압축 | 답습 |
| /admin/gallery 의 다중 파일 업로드 | 답습 |
| 014~019 의 role 분기 | 그대로 활용 |

→ **"어렵지 않냐"** 의 답: **쉬워졌음**. 정규화 소속 모델을 폐기하면서 시스템이 단일 M:N 테이블 + 단순 가시 플래그로 압축됨. 운영 효율도 더 좋음 — 임시 행사 게시판, 비공식 모임 게시판도 제목 한 번 적어 즉석 신설 가능.
