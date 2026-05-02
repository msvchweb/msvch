# 아키텍처

## 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.2 |
| UI | React (Server + Client Components) | 19.2.4 |
| 스타일링 | Tailwind CSS (PostCSS) | v4 |
| DB / Auth / Storage | Supabase | - |
| AI | Google Gemini 2.5 Flash | - |
| 아이콘 | Lucide React | 1.7+ |
| 유틸 | clsx + tailwind-merge, date-fns | - |
| 검증 | Zod (런타임 스키마 검증) | 4.x |
| 이미지 처리 | sharp | 0.34+ |
| 갤러리 | yet-another-react-lightbox | 3.30+ |
| PDF 생성 | puppeteer-core + @sparticuz/chromium | - |
| 언어 | TypeScript | 5.x |

---

## 디렉토리 구조

```
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # 루트 레이아웃 (Header + Footer + BottomTabBar)
│   ├── page.tsx                 # 홈페이지
│   ├── globals.css              # Tailwind + 커스텀 스타일
│   ├── not-found.tsx            # 404 페이지
│   ├── robots.ts                # SEO
│   ├── sitemap.ts               # SEO
│   │
│   ├── (public)/                # 공개 페이지 (인증 불필요)
│   │   ├── churchschool/        # 교회학교 (영유치부/아동부/청소년부/청년부)
│   │   ├── calendar/            # 교회 일정 (Google Calendar 연동)
│   │   ├── gallery/             # 비전갤러리 (2단계 카테고리 필터)
│   │   ├── greetings/           # 인사말
│   │   ├── map/                 # 찾아오시는 길
│   │   ├── menu/                # 더보기 메뉴 (탭바 연동)
│   │   ├── new-family/          # 새가족 등록 (공개 폼 → /api/new-family)
│   │   ├── notice/              # 공지사항
│   │   ├── sermons/             # 말씀영상
│   │   ├── staff/               # 섬기는 이들
│   │   ├── volunteer-center/    # 봉사센터 (반찬/이미용/문화/탁구)
│   │   ├── weekly/              # 주보
│   │   └── worship/             # 예배안내 (시간표 통합)
│   │
│   ├── (auth)/                  # 인증 페이지
│   │   └── login/               # OAuth 로그인 (Google + Kakao)
│   │
│   ├── auth/
│   │   └── callback/            # OAuth 리디렉트 콜백 (exchangeCodeForSession)
│   │
│   ├── (member)/                # 회원 전용 (미들웨어 보호)
│   │   ├── groups/
│   │   └── profile/
│   │
│   ├── admin/                   # 관리자 전용 (미들웨어 보호 — staff/admin/master)
│   │   ├── layout.tsx           # PC 사이드바 + 모바일 상단 가로 스크롤 탭
│   │   ├── AdminNav.tsx         # 사이드바/모바일탭 클라이언트 컴포넌트
│   │   ├── gallery/
│   │   ├── notices/
│   │   ├── sermons/
│   │   ├── calendar/            # 교회일정 관리 (자체 DB events 테이블)
│   │   ├── event-subscribers/   # 일정 알림톡 구독자 관리 (admin/master)
│   │   ├── shorts/              # 쇼츠 관리 (생성/검수/승인)
│   │   ├── inquiries/           # 챗봇 문의 내역 (열람/삭제)
│   │   ├── new-families/        # 새가족 등록 (목록/상태변경/메모/삭제)
│   │   ├── members/             # 회원관리 (master 단독, role 변경)
│   │   ├── masters/             # 주보 마스터 (올해표어/목장/섬기는이/후원/공동체기도)
│   │   └── weeklies/
│   │
│   └── api/                     # API 라우트
│       ├── admin/
│       │   ├── cron/
│       │   │   └── alimtalk-events/ # Vercel Cron — D-1 일정 알림톡 발송
│       │   ├── event-subscribers/   # 일정 알림 수신자 CRUD (master)
│       │   │   └── [id]/
│       │   ├── new-families/        # 새가족 등록 GET 목록 + [id] PATCH/DELETE
│       │   │   └── [id]/
│       │   ├── members/             # PATCH (master 전용 role 변경)
│       │   └── revalidate/          # 세션 인증 ISR 무효화
│       ├── calendar/            # 교회 일정 CRUD (자체 DB, 모바일 호환)
│       │   └── [id]/                # PATCH/DELETE
│       ├── chat/                # 챗봇 (Gemini)
│       │   └── inquiry/         # 챗봇 문의 접수
│       ├── gallery/             # 갤러리 목록 (태그 필터, 모바일 호환)
│       │   └── [id]/images/
│       ├── home/
│       │   └── hero-slides/     # 홈 히어로 슬라이드 (공지→HeroSlide[], 모바일 호환)
│       ├── me/                  # 현재 사용자 인증/권한 (쿠키 OR Bearer)
│       ├── new-content/         # 콘텐츠 최신일자 스냅샷 (레드닷 배지)
│       ├── new-family/          # POST — 공개 새가족 등록 폼 제출 (service_role)
│       ├── og/                  # OG 이미지 생성 (Edge)
│       ├── revalidate/          # ISR 캐시 무효화 (시크릿)
│       ├── sermon-summary/      # Gemini 설교 요약
│       ├── sermons/             # 설교 목록
│       ├── shorts/              # 쇼츠 CRUD + 트리거 (모바일 호환)
│       └── weeklies/
│           └── generate-pdf/    # Puppeteer PDF 생성 → Supabase Storage 업로드
│
├── components/
│   ├── layout/                  # 레이아웃 컴포넌트
│   │   ├── Header.tsx           # 상단 네비게이션 (PC: nav+admin+auth+IG, 모바일: IG+햄버거)
│   │   ├── AuthButton.tsx       # 로그인/로그아웃 토글 (desktop pill / menu 행 두 변형)
│   │   ├── NavigationShell.tsx  # Header + BottomTabBar 클라이언트 경계
│   │   ├── Footer.tsx           # 하단 푸터
│   │   ├── NoticeBanner.tsx     # 노티스 배너 (홈 공지 강조)
│   │   ├── BottomTabBar.tsx     # 하단 탭바 (모바일/태블릿)
│   │   ├── nav-config.ts        # Header 메뉴 설정
│   │   └── tab-config.ts        # 탭바 설정 (플랫폼 공용)
│   │
│   ├── home/                    # 홈페이지 섹션 (UIsample 디자인 기반)
│   │   ├── HeroSection.tsx        # 클라이언트 슬라이더 (HeroSlide[] props, 공지 자동 채움)
│   │   ├── QuickLinks.tsx         # 4카드 그리드 (aspect-[4/5])
│   │   ├── WorshipTimeCard.tsx    # 분할선 4분할 그리드
│   │   ├── UpcomingEvents.tsx     # 다가오는 일정 위젯
│   │   ├── RecentNotice.tsx       # 라인 리스트 (border-t/border-b)
│   │   └── LatestSermon.tsx
│   │
│   ├── gallery/
│   │   └── GalleryGrid.tsx
│   │
│   ├── groups/
│   │   └── DiscussionList.tsx
│   │
│   ├── weekly/
│   │   ├── WeeklyForm.tsx       # 주보 입력 폼 (6탭 구조, 클라이언트 컴포넌트)
│   │   ├── WeeklyInlineView.tsx # 공개 페이지 인라인 뷰 (설교/기도제목/공지)
│   │   └── form/                # 주보 폼 공용 추상화
│   │       ├── FormTabs.tsx         # 탭 컨테이너
│   │       ├── DynamicArrayField.tsx # 제네릭 배열 편집기 (add/remove/move)
│   │       ├── Field.tsx             # 라벨+도움말 래퍼
│   │       └── shared.ts             # inputCls, weekOfMonth 등
│   │
│   ├── bulletin/                 # ⚠ LAYOUT LOCKED (원본 디자인 유지)
│   │   ├── Bulletin.tsx         # 진입점 (print/web 모드 + master prop)
│   │   ├── BulletinFront.tsx    # 앞면 레이아웃 + weeklyToFrontData(w, master?)
│   │   └── BulletinBack.tsx     # 뒷면 레이아웃 + weeklyToBackData(w, master?)
│   │
│   ├── LogoutButton.tsx         # 로그아웃 버튼 (클라이언트 컴포넌트)
│   │
│   └── ui/                      # 공용 UI
│       ├── Card.tsx
│       ├── Container.tsx
│       ├── PageHeader.tsx
│       └── Skeleton.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # 브라우저 Supabase 클라이언트
│   │   ├── server.ts            # 서버 Supabase 클라이언트 (쿠키)
│   │   └── api.ts               # API 라우트용 — Bearer 토큰 OR 쿠키 자동 분기 (모바일 호환)
│   ├── bulletin-master.ts       # 5개 마스터 테이블 병렬 로드 + parseTopicOfYear
│   ├── gallery.ts               # 갤러리 데이터
│   ├── admin-auth.ts            # requireAdmin/Master, hasStaffAccess/MasterAccess
│   ├── content-authors.ts       # content_authors shadow 테이블 조회 (notice/weekly/gallery_album/event)
│   ├── use-me.ts                # useMe() + canDelete() 클라이언트 훅 (auth 이벤트 구독)
│   ├── image-compress.ts        # Canvas 기반 이미지 압축 (5/10MB 제한 대응)
│   ├── gemini.ts                # Gemini AI 호출 (폴백 체인)
│   ├── events.ts                # 자체 캘린더 데이터 함수 (events 테이블)
│   ├── alimtalk.ts              # 알림톡 추상화 (카카오 비즈 미설정 시 noop)
│   ├── notices.ts               # 공지/주보 데이터 + getHeroSlides() (홈 히어로 DTO)
│   ├── new-content-provider.ts  # 새 콘텐츠 레드닷 React Context
│   ├── utils.ts                 # cn(), formatDate()
│   ├── validation.ts            # Zod 스키마 + 파일/입력 검증 유틸
│   ├── weekly-html-template.ts  # 주보 HTML 빌더 (앞/뒷면, A4 인쇄용)
│   └── youtube.ts               # YouTube Data API v3
│
├── types/
│   ├── bulletin-master.ts       # BulletinMasterData, 5개 row 타입
│   ├── calendar.ts              # CalendarEvent (자체 DB 기반 DTO)
│   ├── subscribers.ts           # EventSubscriber, AlimtalkSentRow
│   ├── gallery.ts
│   ├── new-family.ts            # NewFamilyRegistration + enum + 라벨 매핑
│   ├── notice.ts
│   ├── shorts.ts                # ShortsJob, ShortsClip, ShortsSettings
│   ├── supabase.ts
│   └── youtube.ts
│
└── middleware.ts                 # 인증 미들웨어
```

---

## 네비게이션 구조

### Header (데스크톱)
- `lg:flex` — 수평 드롭다운 메뉴
- 5개 카테고리: 교회소개, 말씀영상, 비전갤러리, 교회학교, 봉사센터
- children 없는 메뉴(말씀영상, 비전갤러리)는 단일 링크로 동작
- 상위 메뉴 자체의 badgeKey도 레드닷 표시 지원
- **우측**: (staff 일 때) "관리자" → `<AuthButton variant="desktop" />` → Instagram
- 설정: `nav-config.ts` (`NavItem[]`)

### Header (모바일)
- `lg:hidden` — 우측에 Instagram + 햄버거만 노출 (320px 폭 안전성 확보)
- 햄버거 메뉴 최상단에 (staff 면) "관리자 페이지" + `<AuthButton variant="menu" />` 행을 divider 로 분리해 배치
- 본 nav: children 없는 항목은 `<Link>`, 있는 항목은 `<button>` + accordion

### BottomTabBar (모바일/태블릿)
- `lg:hidden` — 5개 고정 탭
- 탭: 홈, 말씀, 갤러리, 소식, 더보기
- 설정: `tab-config.ts` (`TabItem[]`)
- 숨김: `/admin/*`, `/login`, `/auth/*`

### Admin 네비게이션
- `admin/layout.tsx` — PC(`lg+`): 좌측 사이드바, 모바일: 상단 sticky 가로 스크롤 pill 탭
- `AdminNav.tsx` — `AdminSidebar` + `AdminMobileTabs` (활성 상태 표시, 아이콘은 문자열 키로 직렬화 가능)
- 메뉴: 대시보드, 공지사항, 주보, 주보 마스터, 갤러리, 교회일정, 일정 구독자, 설교 요약, 쇼츠, 문의 내역, 회원관리(master 전용)

---

## 홈 히어로 슬라이더 (공지 자동 주입)

```
notices 테이블 (is_public=true, order by date desc)
    │
    ▼
getHeroSlides(limit=5)       ← src/lib/notices.ts
    │  이미지 추출 사슬: notices.images[0] → 본문 첫 [IMG:url] → skip
    │  eyebrow 매핑: 카테고리 → "교회소식" | "긴급공지" | "교회행사"
    │  subtitle: 본문 [IMG:..] 제거 후 80자 트림
    ▼
HeroSlide[]                  ← src/types/notice.ts (플랫폼 공용 DTO)
    ├── 웹 RSC: src/app/page.tsx가 직접 호출 → <HeroSection slides={...} />
    └── 모바일: GET /api/home/hero-slides?limit=5 (같은 DTO)
```

**설계 포인트**: 데이터 소스가 변경되어도(별도 `hero_slides` 테이블 등) DTO와 엔드포인트가
안정적이라면 클라이언트(웹/모바일) 무수정. 현재는 `notices`를 재활용하므로 추가 DB 작업 없이
관리자가 공지 게시 → ISR(1시간) 후 슬라이더 자동 반영.

---

## 데이터 흐름

```
Google Calendar API ──→ google-calendar.ts ──→ CalendarEvent[]
YouTube RSS ──→ youtube.ts ──→ SermonVideo[]
                                    │
Gemini API ←── gemini.ts ←──────────┘ (설교 요약)
                    │
                    ▼
Supabase DB ←── notices.ts (저장) ──→ Notice[]
            ←── gallery.ts ──────────→ GalleryAlbum[]
            ←── server.ts (auth) ────→ Profile, GroupPost[]

Supabase Storage ← gallery 버킷 (이미지)
                 ← weeklies 버킷 (PDF)
                 ← shorts 버킷 (mp4, 임시)

Admin UI (WeeklyForm, 6-tab form) ──→ Supabase DB (weeklies)
Admin UI (/admin/masters/*) ────────→ Supabase DB (church_settings,
                                          mokjang_entries, servants,
                                          support_sections, community_prayers)
    │
    │  Public /weekly/[id] & /weekly-print/[id]:
    │    loadBulletinMaster(supabase) → BulletinMasterData
    │    └→ <Bulletin weekly={...} master={...} /> (Live Reference)
    │
    └── POST /api/weeklies/generate-pdf
            │
            ▼
        buildWeeklyHtml() ──→ HTML 문자열 (앞면 + 뒷면)
            │
            ▼
        Puppeteer (puppeteer-core + @sparticuz/chromium)
            │  page.setContent(html) → page.pdf({ format: 'A4' })
            ▼
        PDF Buffer ──→ Supabase Storage (weeklies/{id}-generated.pdf)
            │
            └── weeklies.pdf_url 업데이트

GitHub Actions ←── scripts/shorts/run.ts (파이프라인)
    │               ├── yt-dlp (다운로드 + 자막)
    │               ├── Gemini (하이라이트 선정 + 메타데이터)
    │               ├── FFmpeg (9:16 크롭 + 자막 번인)
    │               └── Supabase (업로드 + DB 저장)
    │
    └── POST /api/shorts/trigger ← Admin UI "쇼츠 생성" 버튼

새가족 등록 (마이그레이션 024 이후):
    공개 폼 /new-family ──→ POST /api/new-family
        │   (zod NewFamilyRegistrationSchema + 'etc' 직접입력 추가 검증)
        │
        ▼
    service_role INSERT ──→ new_family_registrations (privacy_consent=true 강제)
        │
        ├── 관리자 /admin/new-families
        │     ├── GET  /api/admin/new-families      → NewFamilyRegistration[]
        │     ├── PATCH /api/admin/new-families/:id  → status / adminNote
        │     └── DELETE /api/admin/new-families/:id (admin/master 만)
        │
        └── 모바일 앱 (장래) ── createApiClient 의 Bearer 인증으로 동일 라우트 사용
```

---

## 인증 아키텍처

### 로그인 흐름 (OAuth)

```
/login (Google 또는 Kakao 버튼 클릭)
    │
    ▼
supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    │
    ▼
외부 OAuth 페이지 (Google / Kakao 동의)
    │
    ▼
GET /auth/callback?code=...&next=...
    │  exchangeCodeForSession(code) → 쿠키 설정
    │  (이메일 중복 차단: handle_new_user 트리거가 EMAIL_ALREADY_REGISTERED 발생)
    ▼
NextResponse.redirect(`${origin}${next}`)  → 원래 가려던 경로로 복귀
```

### 미들웨어 보호

```
브라우저 요청
    │
    ▼
middleware.ts ── 경로 매칭 (/groups/*, /admin/*, /profile/*)
    │
    ├── 비보호 경로 → 통과
    ├── 미인증 → /login?next=<원경로> 리다이렉트
    └── /admin + 비-staff → /?notice=no_admin 리다이렉트
```

### 권한 등급

| role | admin UI 접근 | 컨텐츠 삭제 | role 변경 |
|------|--------------|------------|----------|
| `member` | ✗ | 본인 작성만 | ✗ |
| `staff` | ✓ | 본인 작성만 | ✗ |
| `admin` | ✓ | 모두 | ✗ |
| `master` | ✓ | 모두 | ✓ (단독) |

- 세션: 쿠키 기반 (Supabase SSR) **OR** `Authorization: Bearer <access_token>` (모바일 앱)
- API 라우트: `createApiClient(request)` 가 두 방식을 자동 분기
- 로그인 UI: `/login` (OAuth Google + Kakao)
- 로그아웃: 클라이언트 SDK `supabase.auth.signOut()` — 별도 백엔드 엔드포인트 없음
  - Header 우측 `AuthButton` (PC) / 햄버거 메뉴 안 (모바일) — `useMe` 훅이 `onAuthStateChange` 이벤트로 즉시 갱신
  - 프로필 페이지(`/profile`)의 풀폭 `LogoutButton` 도 동일 동작

### 클라이언트 권한 훅

```
useMe() → MeResponse  (src/lib/use-me.ts)
    │  마운트 시 onAuthStateChange 구독
    │  INITIAL_SESSION/SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED → /api/me 재조회
    ▼
{ authenticated, userId, role, isStaff, isAdminOrMaster }

canDelete(me, authorId) → boolean
    └── admin/master = true, 그 외 = userId === authorId
```

### 컨텐츠 작성자 추적

`content_authors` shadow 테이블 (`supabase/migrations/020_content_authors.sql`):
- `notices`, `weeklies`, `gallery_albums` 의 INSERT 트리거가 `(content_type, content_id, author_id, author_name)` 자동 기록
- RLS: SELECT 는 staff 만 (admin UI 작성자 표시용), INSERT 는 트리거(SECURITY DEFINER) 만
- 베이스 테이블에는 author 컬럼을 추가하지 않으므로 공개 응답에 절대 노출 안 됨

### 컨텐츠 삭제 RLS (`021_content_delete_policies.sql`)

기존 `FOR ALL USING (is_staff())` → SELECT/INSERT/UPDATE 는 staff 유지, **DELETE 만 분리**:

```sql
DELETE USING (is_admin_or_master() OR is_content_author(type, id))
```

- `is_admin_or_master()`, `is_content_author(type, id)` 헬퍼 (021)
- 적용 테이블: `notices`, `weeklies`, `gallery_albums`, `gallery_images` (gallery_images 는 부모 앨범의 작성자 권한을 따름)
- UI 측: `canDelete(me, authorId)` 로 삭제 버튼을 사전에 숨김

---

## 주보 데이터 아키텍처

주보(bulletin)는 **주간 가변 데이터**(`weeklies` 행)와 **상시 참조 마스터**(5개 테이블)의
조합으로 렌더된다. 마스터는 **Live Reference** 방식으로 항상 최신 값을 읽어오며,
과거 주보에도 동일한 최신 값이 반영된다(스냅샷 아님).

### 레이어 구분

| 구분 | 대상 | 이유 |
|------|------|------|
| 주 1회 변경 (`weeklies` 칼럼/JSONB) | 예배 항목, 오후/수요예배, 새벽말씀, 안내/감사위원, 헌금명세, 교회소식, 정기모임, 새가족, 비고, 주간/누계합계, 다음주 기도제목 | 매주 달라지는 가변 정보 |
| 마스터 (5개 테이블) | 올해 표어(`church_settings`), 목장 현황(`mokjang_entries`), 섬기는 이(`servants`), 후원(`support_sections`), 교회공동체 기도제목(`community_prayers`) | 주 단위로 바뀌지 않고, 변경 시 과거 주보도 최신값 반영이 더 바람직 |

### 로드 흐름

```
Server Component (/weekly/[id] or /weekly-print/[id])
    ↓
Promise.all([ weeklies SELECT, loadBulletinMaster(supabase) ])
    ↓
<Bulletin weekly={w} master={m} mode="web|print" />
    ├── weeklyToFrontData(w, m) → BulletinFrontLeft + BulletinFrontRight
    └── weeklyToBackData(w, m)  → BulletinBackLeft  + BulletinBackRight
```

- `src/lib/bulletin-master.ts::loadBulletinMaster()` — 5개 테이블 병렬 SELECT
- `src/types/bulletin-master.ts` — `BulletinMasterData` 통합 타입
- `src/components/bulletin/*` — **LAYOUT LOCKED**, 매핑 함수만 수정 가능

### 폼 추상화

`src/components/weekly/form/`:

- `FormTabs` — 6탭 구조(①기본 ②주일예배 ③앞면(교회소식) ④뒷면좌측 ⑤뒷면우측 ⑥기타)
- `DynamicArrayField<T>` — 제네릭 배열 편집기 (add/remove/move-up/move-down, max 상한)
- `Field`, `SectionTitle` — 라벨/도움말/섹션 헤더

마스터 CRUD(5개)는 `src/app/admin/masters/` 하위에 각각 별도 페이지로 분리:
`topic`, `mokjang`(40행 고정), `servants`, `supports`, `community-prayers`(max 7).

Reorder 시 UNIQUE(seq) 충돌을 피하기 위해 **shift-to-temp 패턴** 사용 — 먼저 seq+1000으로
upsert 후 실제 seq로 재upsert.

### 검증

`src/lib/validation.ts`:

- `WeeklyContentSchema` — `weeklies` 전 필드 (슬라이스 상한과 `.max(N)` 일치)
- `ChurchSettingTopicSchema`, `MokjangEntrySchema`, `ServantSchema`,
  `SupportSectionSchema`, `CommunityPrayerSchema` — 마스터별

마이그레이션: `supabase/migrations/011_weeklies_layout_fields.sql`,
`012_bulletin_master_tables.sql` (RLS: public SELECT, admin CUD).

---

## 캘린더 + 알림톡 아키텍처

### 자체 캘린더 (마이그레이션 022 이후)

```
events 테이블 (단일 소스)
    │  RLS:
    │   - SELECT: 누구나 (캘린더 공개)
    │   - INSERT/UPDATE: staff
    │   - DELETE: 작성자 본인 OR admin OR master (021 패턴)
    │  컬럼: date(필수), start_time/end_time(둘 다 nullable), notify, end_date/rrule(v2 예약)
    │
    ▼
src/lib/events.ts → CalendarEvent[]  (KST +09:00 ISO 변환)
    ├── /(public)/calendar/page.tsx + CalendarView.tsx (호버/탭 popover)
    ├── /admin/calendar/page.tsx (입력 폼: 시작시간만 필수, 종료시간 옵셔널)
    ├── /api/calendar (GET/POST) — 모바일 호환 DTO
    └── /api/calendar/[id] (PATCH/DELETE)
```

**Google Calendar 의존 제거**. 마이그레이션 시 1회용 `scripts/migrate-google-calendar.ts` 가
`GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_API_KEY` 로 기존 일정을 import 한 후, 환경변수 정리 가능.

### 일정 알림톡 파이프라인

```
event_subscribers 테이블 (admin/master 가 직접 관리)
    │  컬럼: name, phone(010-XXXX-XXXX 정규화), is_active, notify_d1, notify_d_day, note
    │
    │  /admin/event-subscribers/page.tsx 에서 CRUD
    │
    ▼
Vercel Cron (vercel.json — 매일 06:00 KST)
    │
    ▼
GET /api/admin/cron/alimtalk-events  (x-cron-secret 헤더 인증)
    │
    │  1. D-1 일자 events.notify=true 조회
    │  2. is_active=true AND notify_d1=true 구독자 조회
    │  3. (event × subscriber) 조합으로 alimtalk_sent 미기록만 sendAlimtalk()
    │  4. 결과 status('sent'/'failed'/'noop') 와 함께 alimtalk_sent 기록 (UNIQUE 키로 중복 방지)
    │
    ▼
src/lib/alimtalk.ts — sendAlimtalk(payload)
    ├── KAKAO_BIZ_* env 미설정 → 'noop' 반환 (실 발송 X, 추적만)
    └── env 설정 시 → 카카오 비즈 중계사 API 호출 (NHN Cloud / Aligo / Solapi 등)
```

**핵심 설계**:
- 알림톡 추상화 격리 — 카카오 비즈 승인 + 환경변수만 채우면 즉시 동작
- `alimtalk_sent` UNIQUE(template, event_id, recipient) 로 중복 발송 방지
- 'noop' 상태도 기록 — 카카오 비즈 승인 후 재실행 시 이미 noop 처리된 건은 재발송 안 됨 (의도적 안전장치). 신규 발송 정책 필요 시 별도 마이그레이션으로 정리.

---

## 새가족 등록 아키텍처

마이그레이션 024 이후. 익명 INSERT + staff SELECT 패턴 (`chat_inquiries` 와 동일).

### 데이터 모델
- `new_family_registrations` — 9문항 + 개인정보 동의 + 처리 상태 + 관리자 메모.
- `privacy_consent boolean NOT NULL CHECK (= true)` — 동의 없는 데이터 DB 단 거부.
- `privacy_consented_at timestamptz` — 보존기간 산정 근거.
- `status` enum 4단계: `new` → `contacted` → `assigned` → `done`.

### 권한 모델 (RLS)
- INSERT: 누구나 (`with check (true)`) — 공개 폼
- SELECT: `is_staff()` (마이그레이션 015)
- UPDATE: `is_staff()` (status / admin_note 변경)
- DELETE: `is_admin_or_master()` (마이그레이션 019)

### 라우트 매트릭스

| 라우트 | 인증 | 용도 |
|--------|------|------|
| `/new-family` (공개 페이지) | 없음 | 폼 렌더 (서버 컴포넌트 셸 + `NewFamilyForm` 클라이언트) |
| `POST /api/new-family` | 없음 (service_role) | 익명 제출 — zod + 'etc' 직접입력 검증 |
| `/admin/new-families` (페이지) | `requireAdmin` | 목록 + 필터 + 펼침 + 상태/메모 변경 |
| `GET /api/admin/new-families` | `requireAdmin` | 전체 목록 (created_at DESC) |
| `PATCH /api/admin/new-families/[id]` | `requireAdmin` | status / adminNote 부분 업데이트 |
| `DELETE /api/admin/new-families/[id]` | `requireAdmin` + RLS | admin/master 만 통과 |

### 검증 3계층
1. 클라이언트 폼 — `NewFamilyForm.handleSubmit` 즉시 피드백 (필수 항목 / 'etc' 직접입력 / 010-XXXX-XXXX 정규식)
2. 서버 zod — `NewFamilyRegistrationSchema` (`privacyConsent: z.literal(true)`) + 라우트 추가 룰
3. DB CHECK — enum 값, 길이 제약, `privacy_consent = true`

### 모바일 앱 호환 포인트
- 응답 DTO 는 `NewFamilyRegistration` (camelCase). DB 컬럼명 비노출 → 향후 컬럼 rename 시 `toDto()` 만 유지하면 됨.
- 입력 페이로드는 `NewFamilyRegistrationInput` 인터페이스 그대로.
- admin API 는 `createApiClient(request)` 가 cookie 또는 `Authorization: Bearer <jwt>` 자동 분기 → RN 앱에서 동일 라우트 호출 가능.
- 익명 제출 라우트는 토큰 불필요 → RN 비로그인 화면도 동일 호출.
- enum 라벨(`*_LABELS`)은 `src/types/new-family.ts` 에 정적 객체로 보관 → RN 도 임포트 가능.

### 진입점
- 데스크톱 nav `교회소개` 드롭다운 — "인사말" 다음
- 풋터 `바로가기` 섹션
- (홈 카드/배너는 디자인 결정 사항, v2)

---

## 보안

### 입력 검증
- 모든 API POST 요청: `src/lib/validation.ts`의 Zod 스키마로 런타임 검증
- 파일 업로드: 확장자 화이트리스트 + 크기 제한 (`validateFile()`)
  - 이미지: jpg/jpeg/png/gif/webp, 10MB
  - PDF: pdf, 20MB
  - 한 번에 최대 30파일
- 쿼리 파라미터: `parseLimit()` (상한 100)
- 폼 입력: 클라이언트 `maxLength` + Zod 검증

### 보안 헤더 (`next.config.ts`)
- CSP: self + 허용 외부 출처 (YouTube, Supabase, Gemini)
- X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

### 에러 처리
- API 에러 응답에서 내부 정보(스택, 외부 API 메시지) 제거
- 상세 에러는 `console.error`로 서버 로그에만 기록

### 시크릿 비교
- `/api/revalidate`: `crypto.timingSafeEqual`로 타이밍 공격 방어

---

## 캐싱 전략

| 대상 | 방식 | TTL |
|------|------|-----|
| 홈페이지 | ISR | 1시간 (`revalidate: 3600`) |
| 설교 목록 | ISR + fetch cache | 30분 (`revalidate: 1800`) |
| 정적 페이지 (예배, 소개 등) | Static (빌드 시) | - |
| 공지사항 | Dynamic (매 요청) | - |
| 온디맨드 무효화 | POST `/api/revalidate` | - |

---

## 디자인 시스템

### 색상 (`globals.css` @theme)

| 토큰 | 값 | 용도 |
|------|---|------|
| `primary-600` | `#444ce7` | 주요 액센트, 활성 탭 |
| `primary-700` | `#3538cd` | 강조 텍스트 (홈 타이틀 하이라이트) |
| `church-gold` | `#c9a84c` | 골드 강조, 구분선 |
| `church-cream` | `#faf8f4` | 밝은 배경, 버튼 텍스트 |
| `church-dark` | `#111827` | 어두운 배경 (Footer), CTA 버튼 |
| `church-warm` | `#78716c` | 보조 텍스트 |
| `hero-bg-1` | `#eef2f8` | 홈 Hero/카드 soft 배경 (tint 1) |
| `hero-bg-2` | `#dee6f1` | 예배시간 섹션 배경 (tint 2) |

### 폰트
- Pretendard Variable (한국어 최적화 산세리프)

### 반응형 분기점
- `lg` (1024px): 데스크톱 Header nav 표시 / 탭바 숨김
- `md` (768px): 그리드 레이아웃 변경
- `sm` (640px): 2열 그리드 시작

---

## 배포

- **플랫폼**: Vercel (GitHub 자동 배포)
- **빌드**: `npm run build` → Next.js static + dynamic
- **CI/CD**: GitHub Actions (쇼츠 생성 파이프라인)
- **환경변수 (Vercel — 일상 트래픽)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `REVALIDATE_SECRET`, `GITHUB_PAT`, `CRON_SECRET`
- **환경변수 (선택, 카카오 비즈 승인 후 추가)**: `KAKAO_BIZ_API_KEY`, `KAKAO_BIZ_SENDER_KEY`, `KAKAO_BIZ_API_URL`
- **환경변수 (마이그레이션 1회용 — 사용 후 제거 권장)**: `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`
- **환경변수 (로컬 개발 only)**: `CHROME_EXECUTABLE_PATH` — 로컬 Chrome 경로 (Puppeteer PDF 생성용, Vercel에서는 @sparticuz/chromium 자동 사용)
- **GitHub Secrets**: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
