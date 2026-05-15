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
| 이미지 처리 | sharp / Canvas API (포스터 합성) | 0.34+ |
| 갤러리 | yet-another-react-lightbox | 3.30+ |
| QR 코드 | qrcode | - |
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
│   │   ├── updates/             # 업데이트 노트 (UPDATES.md 파싱, 일반 공개)
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
│   │   ├── boards/              # 소모임 게시판 (목록/상세/글쓰기/댓글)
│   │   ├── groups/              # (legacy 정적 토론 — 거의 미사용)
│   │   └── profile/
│   │
│   ├── admin/                   # 관리자 전용 (미들웨어 보호 — staff/admin/master)
│   │   ├── layout.tsx           # 슬레이트 배경 + 노란 "관리자 모드" 띠 + PC 사이드바 + 모바일 탭
│   │   ├── AdminNav.tsx         # 사이드바/모바일탭 클라이언트 컴포넌트 (슬레이트 톤)
│   │   ├── AdminBottomTabBar.tsx# 관리자 하단 탭 (모바일)
│   │   ├── AdminGroupTabs.tsx   # 그룹 페이지 상단 가로 탭
│   │   ├── _components/         # 대시보드 전용 서버 컴포넌트
│   │   │   └── UpdatesCard.tsx  # 업데이트 노트 카드 (UPDATES.md 상위 5개)
│   │   ├── updates/             # 업데이트 노트 전체 보기 (staff-only 포함)
│   │   ├── menu/                # 전체 메뉴 (모바일 더보기 진입점, 카드 그리드)
│   │   ├── guide/               # 관리자 가이드 (공지/갤러리/주보/포스터/문의 사용법)
│   │   ├── posters/             # 포스터 도구 (PromptBuilder + Finalizer 두 패널)
│   │   ├── gallery/
│   │   ├── notices/
│   │   ├── sermons/
│   │   ├── calendar/            # 교회일정 관리 (자체 DB events 테이블)
│   │   ├── event-subscribers/   # 일정 알림톡 구독자 관리 (admin/master)
│   │   ├── shorts/              # 쇼츠 관리 (생성/검수/승인)
│   │   ├── inquiries/           # 챗봇 문의 내역 (열람/삭제)
│   │   ├── new-families/        # 새가족 등록 (목록/상태변경/메모/삭제)
│   │   ├── boards/              # 소모임 게시판 (신설/숨김/멤버관리)
│   │   ├── members/             # 회원관리 (master 단독, role 변경)
│   │   ├── masters/             # 주보 마스터 라우트 (인라인 에디터 wrapper)
│   │   └── weeklies/
│   │
│   └── api/                     # API 라우트
│       ├── admin/
│       │   ├── cron/
│       │   │   ├── alimtalk-events/ # Vercel Cron — D-1 일정 알림톡 발송 (KST 06:00)
│       │   │   └── sync-sermons/    # Vercel Cron — YouTube 50개 → sermon_videos upsert (KST 15:00)
│       │   ├── event-subscribers/   # 일정 알림 수신자 CRUD (master)
│       │   │   └── [id]/
│       │   ├── new-families/        # 새가족 등록 GET 목록 + [id] PATCH/DELETE
│       │   │   └── [id]/
│       │   ├── boards/              # 소모임 게시판 admin (GET/POST + [id] PATCH/DELETE + members PUT)
│       │   │   └── [id]/
│       │   │       └── members/
│       │   ├── calendar/
│       │   │   └── batch/           # AI 추출 검수 통과 일정 일괄 INSERT (마이그 034)
│       │   ├── weeklies/
│       │   │   └── [id]/
│       │   │       └── extract-events/ # 주보 news → Gemini → 일정 후보 (마이그 034)
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
│       ├── boards/              # 소모임 게시판 멤버 API (모바일 호환)
│       │   └── [id]/posts/[postId]/comments/[cid]/  # 글/댓글 CRUD, cursor 페이지네이션
│       ├── og/                  # OG 이미지 생성 (Edge)
│       ├── posters/
│       │   ├── build-prompt/    # 메타 프롬프트 → Gemini 텍스트 → 영문 이미지 프롬프트
│       │   └── proxy-image/     # 참고 이미지 CORS 우회 프록시
│       ├── revalidate/          # ISR 캐시 무효화 (시크릿)
│       ├── sermon-summary/      # Gemini 설교 요약
│       ├── sermons/             # 설교 목록 (DB sermon_videos 에서 read)
│       ├── shorts/              # 쇼츠 CRUD + 트리거 (모바일 호환)
│       └── weeklies/
│           └── generate-pdf/    # Puppeteer + page.goto(/weekly-print/[id]) → PDF → Storage
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
│   │   ├── WeeklyForm.tsx          # 주보 입력 폼 (5탭 + 마스터, 클라이언트 컴포넌트)
│   │   ├── WeeklyEditorWithPreview.tsx # 폼 + 우측 4페이지 실시간 미리보기 (자동 스케일)
│   │   ├── form/                   # 주보 폼 공용 추상화
│   │   │   ├── FormTabs.tsx            # 탭 컨테이너 (data-tour 부여)
│   │   │   ├── DynamicArrayField.tsx   # 제네릭 배열 편집기 (add/remove/move)
│   │   │   ├── Field.tsx               # 라벨+도움말 래퍼
│   │   │   ├── constants.ts            # WORSHIP_ITEMS_TEMPLATE 등 고정 슬롯
│   │   │   └── shared.ts               # inputCls, weekOfMonth 등
│   │   └── masters/                # 주보 마스터 5개 인라인 에디터
│   │       ├── TopicEditor.tsx
│   │       ├── MokjangEditor.tsx
│   │       ├── ServantsEditor.tsx
│   │       ├── SupportsEditor.tsx
│   │       └── CommunityPrayersEditor.tsx
│   │
│   ├── bulletin/                # ⚠ LAYOUT LOCKED (인쇄 — 원본 디자인 유지)
│   │   ├── Bulletin.tsx         # 진입점 (print/web 모드 분기 + master prop)
│   │   ├── BulletinWebView.tsx  # 공개 웹 모드 — ResizeObserver 자동 스케일 (PC 2x2 / 모바일 1열) + ProtectedView 자동 적용
│   │   ├── BulletinFront.tsx    # 앞면 레이아웃 + weeklyToFrontData(w, master?)
│   │   ├── BulletinBack.tsx     # 뒷면 레이아웃 + weeklyToBackData(w, master?)
│   │   └── ProtectedView.tsx    # 공개 웹뷰 보호 래퍼 — 우클릭/드래그/복사/단축키 차단 + 워터마크 (웹 전용, RN 은 네이티브 보호 별도)
│   │
│   ├── admin/                    # 관리자 공용 컴포넌트
│   │   ├── AdminTour.tsx           # 스포트라이트 투어 (16단계, clickOnEnter 자동 탭 전환)
│   │   ├── AdminTourStartButton.tsx# 투어 시작 트리거
│   │   ├── nav-tour-keys.ts        # 사이드바·메뉴 카드 공유 data-tour 매핑
│   │   └── event-extraction/       # 주보 news → 일정 AI 추출 모달 (마이그 034)
│   │       ├── EventExtractionModal.tsx  # loading/review/inserting/done 4-phase 컨테이너
│   │       └── ExtractedEventRow.tsx     # 1건 row + 인라인 편집 + confidence 배지 + 알림톡 토글
│   │
│   ├── LogoutButton.tsx          # 로그아웃 버튼 (클라이언트 컴포넌트)
│   │
│   └── ui/                       # 공용 UI
│       ├── Card.tsx
│       ├── Container.tsx
│       └── PageHeader.tsx
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
│   ├── new-content-provider.tsx # 새 콘텐츠 레드닷 React Context
│   ├── utils.ts                 # cn(), formatDate()
│   ├── validation.ts            # Zod 스키마 + 파일/입력 검증 유틸
│   ├── boards.ts                # 소모임 게시판 데이터 함수
│   ├── poster-prompts.ts        # 포스터 메타 프롬프트 빌더 (칩→영문 프롬프트 지시문)
│   ├── poster-footer.ts         # 포스터 Canvas 합성 (배경 + 한글 텍스트 + 교회 푸터/QR)
│   ├── sermons.ts               # 설교 영상 DB 리더 (sermon_videos)
│   ├── sermon-category.ts       # categorizeSermon(title) 분류 유틸 (UI · sync 공유)
│   ├── news-event-extractor.ts  # 주보 news → Gemini → 일정 후보 (마이그 034)
│   └── youtube.ts               # YouTube 업로드 플레이리스트 fetch — sync cron 전용
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
- `admin/layout.tsx` — PC(`lg+`): 좌측 `AdminSidebar`, 모바일: `AdminBottomTabBar` (4 + 더보기) + 그룹 페이지에선 `AdminGroupTabs` 가 상단 가로 탭으로 분기
- `AdminNav.tsx` — `AdminSidebar` (사이드바). 아이콘은 문자열 키로 직렬화 가능
- `/admin/menu` — 모바일 더보기 진입점, 카드 그리드로 모든 섹션 노출
- 메뉴: 대시보드, 공지사항, 주보, 주보 마스터, 갤러리, 교회일정, 일정 구독자, 설교 요약, 쇼츠, 문의 내역, 새가족 등록, 소모임 게시판, 포스터 도구, 회원관리(master 전용)

### 관리자 온보딩 — 가이드 + 스포트라이트 투어
- `/admin/guide` — 공지/갤러리/주보/포스터/문의 단계별 사용법(Section + Step + Tip)
- `AdminTour` — 16단계 스포트라이트 투어. SVG mask 로 화면 어둡게 + 타깃만 cutout
  - 단계마다 자동 경로 이동(usePathname/Router) + scrollIntoView
  - `clickOnEnter` 플래그로 탭 버튼을 진입 시 자동 클릭 → 패널 콘텐츠까지 함께 시연
  - 사이드바·메뉴 카드 양쪽에 동일 `data-tour` 부여 → viewport 별로 보이는 쪽 자동 매칭 (`nav-tour-keys.ts` 가 매핑)
- 트리거: `'admin-tour:start'` 윈도우 이벤트 — 대시보드/가이드 페이지의 시작 버튼이 발사

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
설교 영상 (DB 누적 모델 — 마이그레이션 032 이후):
    매일 KST 15:00 Vercel Cron
         │
         ▼
    GET /api/admin/cron/sync-sermons (CRON_SECRET 인증)
         │
         ▼
    fetchYouTubeUploads(50)  ── youtube.ts (sync 전용)
         │
         ▼
    Supabase upsert ── sermon_videos (PK=video_id, 누적 보존)
         │
         └── 표시: src/lib/sermons.ts → DB read only
               ├─ /sermons (목록 + SermonTabs 필터)
               ├─ /sermons/[id] (상세 + iframe 임베드)
               ├─ 홈 LatestSermon
               └─ /api/new-content (레드닷 최신 일자)

Supabase DB ←── notices.ts (저장) ──→ Notice[] + HeroSlide[]
            ←── gallery.ts ──────────→ GalleryAlbum[]
            ←── server.ts (auth) ────→ Profile, BoardPost[]
Gemini API ←── gemini.ts ←─── (설교 요약 / 챗봇 / 포스터 영문 프롬프트)

Supabase Storage ← gallery 버킷 (이미지)
                 ← weeklies 버킷 (PDF)
                 ← shorts 버킷 (mp4, 임시)
                 ← board-images 버킷 (게시판 첨부)
                 ← poster-images 버킷 (포스터 결과 — 마이그레이션 026, 현재 표시 흐름과는 미연결)

Admin UI (WeeklyForm, 5탭 + 마스터) ──→ Supabase DB (weeklies)
    │  탭 구성: 기본 / 페이지1 주일예배 / 페이지2 예배안내 / 페이지3 헌금 / 페이지4 교회소식 / 주보 마스터(인라인 accordion)
    │
    ▼
WeeklyEditorWithPreview ── 우측에 4페이지 실시간 미리보기 (자동 스케일)

Admin UI (/admin/masters/*) ────────→ Supabase DB (church_settings,
    │                                     mokjang_entries, servants,
    │                                     support_sections, community_prayers)
    │  standalone 라우트 + 주보 폼 마스터 탭이 동일한 Editor 컴포넌트(masters/*) 재사용
    │
    │  Public /weekly:
    │    최신 발행 주보 1건을 <Bulletin mode="web"> 으로 풀 렌더 (BulletinWebView 자동 스케일)
    │    하단에 지난 주보 목록 → 상세는 /weekly/[id]
    │
    │  Public /weekly/[id] & /weekly-print/[id]:
    │    loadBulletinMaster(supabase) → BulletinMasterData
    │    └→ <Bulletin weekly={...} master={...} /> (Live Reference)
    │
    │  공개 웹뷰 보호 (BulletinWebView):
    │    BulletinWebView 가 <ProtectedView> 래퍼로 자동 감싸짐 — 외부인 마찰 추가:
    │      · 우클릭/드래그/복사/텍스트선택 차단 (React 합성 이벤트 + CSS)
    │      · 키보드 단축키 차단 (F12, Ctrl+S/P/C/U, Ctrl+Shift+I/J/C, Cmd 조합)
    │      · 워터마크 (사선 줄무늬 + 중앙 회전 텍스트, 모두 pointer-events: none)
    │      · iOS Safari 길게 누르기 메뉴 차단 (-webkit-touch-callout: none)
    │    한계: PrintScreen·카메라 촬영·브라우저 메뉴 인쇄/소스 진입은 차단 불가.
    │
    │  /weekly-print/[id] (staff 전용) 와 admin 미리보기는 보호 X — 작성자/직원 본인 동선.
    │
    │  ※ 과거 POST /api/weeklies/generate-pdf (Puppeteer + @sparticuz/chromium) 경로는
    │    호출 동선 부재로 마이그 036 에서 라우트·컬럼·의존성 모두 제거됨.

포스터 도구 (admin/posters):
    ① PromptBuilder (칩 5종 + 행사 정보 입력)
         │  buildMetaPromptForGemini()  ── poster-prompts.ts
         ▼
    POST /api/posters/build-prompt  ── Gemini 텍스트 호출
         │
         ▼
    영문 이미지 프롬프트 ── 사용자가 복사해 외부 AI 도구(ChatGPT/Gemini/Midjourney 등)에 붙여 이미지 생성
         │
         ▼
    ② Finalizer ── AI 결과 이미지 업로드
         │  poster-footer.ts: drawCover + 한글 텍스트 오버레이 + 교회 푸터(로고 banner.avif + 전화/주소 + QR)
         │  비율별 캔버스: 1080×1080 / 1080×1920 / A4 1240×1754
         │  /api/posters/proxy-image — 참고 이미지 CORS 우회 시 사용
         ▼
    PNG 다운로드 (클라이언트 직접) — 외부 SNS/인쇄 사용

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

주보 → 일정 AI 추출 (마이그레이션 034 이후):
    Admin /admin/weeklies/[id]/edit 페이지4 탭
        │  "📅 AI 일정 추출" 버튼 (weeklyId 가드 — 신규 작성 시 비활성)
        │  POST /api/admin/weeklies/{id}/extract-events
        ▼
    src/lib/news-event-extractor.ts
        │  ① flattenNews/flattenMeetings → 프롬프트 빌드 (anchor=weekly.date)
        │  ② callGeminiWithFallback (텍스트 단발, gemini-2.5-flash → -lite → -latest 폴백)
        │  ③ stripCodeFence + JSON.parse + Zod (ExtractEventsResponseSchema)
        │  ④ adjustConfidenceByDayOfWeek (요일 어긋남 시 confidence ≤ 0.5)
        │  ⑤ adjustConfidenceByDateRange (anchor ±14일 / +365일 초과 시 ≤ 0.4)
        ▼
    ExtractEventsResponse → EventExtractionModal 검수 UI
        │  staff 가 항목별 toggle / 인라인 편집 / 알림톡 토글
        │  (기본: confidence ≥ 0.7 ON, < 0.6 amber 경고 + 자동 OFF, notify 기본 false)
        ▼
    POST /api/admin/calendar/batch
        │  EventBatchInsertSchema (1~30건) 항목별 INSERT
        │  → events (extracted_by_ai=true, source_weekly_id, source_news_index)
        │  → content_authors 트리거 자동 작성자 기록
        │  → 응답 BatchInsertResult { inserted: CalendarEvent[], skipped: BatchSkipped[] }
        │  → HTTP 201 (전부 성공) 또는 207 Multi-Status (부분 성공)
        ▼
    캘린더 페이지에 즉시 반영 + (notify=true 항목은) D-1 cron 발송 대상
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
middleware.ts ── 경로 매칭 (/groups/*, /admin/*, /profile/*, /boards/*)
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

- `FormTabs` — 5탭 + 주보 마스터 = 6 탭 (①기본 ②페이지1 주일예배 ③페이지2 예배안내 ④페이지3 헌금 ⑤페이지4 교회소식 ⑥주보 마스터). 각 버튼에 `data-tour="weekly-tab-{key}"` 부여
- `DynamicArrayField<T>` — 제네릭 배열 편집기 (add/remove/move-up/move-down, max 상한)
- `Field`, `SectionTitle` — 라벨/도움말/섹션 헤더
- `constants.ts` — `WORSHIP_ITEMS_TEMPLATE` (16행 고정), `OFFERING_CATEGORIES` (10), `SPECIAL_OFFERING_INDEX=3` 등 고정 슬롯

`WeeklyEditorWithPreview` — 폼 + 우측 4페이지 실시간 미리보기. `ResizeObserver` 로 컨테이너 폭에 맞춰 자동 스케일, 활성 탭 변경 시 해당 페이지로 자동 스크롤.

### 주보 마스터 인라인 편집

마스터 CRUD(5개) 컴포넌트는 `src/components/weekly/masters/` 에 추출:
`TopicEditor`, `MokjangEditor` (40행 고정), `ServantsEditor`, `SupportsEditor`, `CommunityPrayersEditor` (max 7).

이들은 두 곳에서 재사용:
1. **standalone 라우트** `/admin/masters/{name}` — 페이지 헤더 + Editor (deep-link/북마크 호환)
2. **주보 폼 6번째 탭 "주보 마스터"** — accordion 으로 5개 Editor 인라인 편집 (현재 작성 중인 주보 잃지 않고 마스터 수정 가능)

Reorder 시 UNIQUE(seq) 충돌을 피하기 위해 **shift-to-temp 패턴** 사용 — 먼저 seq+1000으로
upsert 후 실제 seq로 재upsert.

### 새 토글 필드 (마이그레이션 028~030)

| 필드 | 타입 | 효과 |
|------|------|------|
| `weeklies.afternoon_mokjang_mode` | boolean | true 면 페이지2 좌상단 "주일오후 찬양예배" 셀이 목장모임 이미지(`public/mokjang.jpg`)+안내 문구로 대체 |
| `weeklies.special_offering` | jsonb `{enabled,label}` | 헌금 4번째 슬롯(부활감사 자리)을 토글/이름변경. enabled=false 면 행 자체 제거 |
| `weeklies.front_toggles` | jsonb 4개 boolean | 페이지4 4섹션(성경통독·새가족·식당봉사·봉사센터) 표시 토글, 후속 항목 번호 자동 재계산 |

### 정리된 레거시 (마이그레이션 027/031)

- 027: `weeklies.hymn_number`, `weeklies.scripture` 컬럼 DROP
- 031: `prayer_items`, `announcements`, `servants_text`, `offering_list_text`, `sogroup_text` 컬럼 DROP — 기도제목은 마스터(`community_prayers`)로 일원화. "기타 탭" 자체 제거. `WeeklyInlineView.tsx`, `weekly-html-template.ts` 파일도 삭제.

### 검증

`src/lib/validation.ts`:

- `WeeklyContentSchema` — `weeklies` 전 필드 (슬라이스 상한과 `.max(N)` 일치)
- `ChurchSettingTopicSchema`, `MokjangEntrySchema`, `ServantSchema`,
  `SupportSectionSchema`, `CommunityPrayerSchema` — 마스터별

마이그레이션: `supabase/migrations/011_weeklies_layout_fields.sql`,
`012_bulletin_master_tables.sql` (RLS: public SELECT, admin CUD), 추가 027~031 (위 표 참조).

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

## 소모임 게시판 아키텍처

마이그레이션 025 이후. 소모임(목장/선교회/임시 행사)이 운영진에 신청 → admin 이 제목 입력해 신설 + 멤버 임의 지정. 용도 끝나면 `is_visible=false` 로 숨김 처리.

### 데이터 모델
- `boards` — 게시판 (제목 + 가시 토글)
- `board_members` — M:N 매핑 (admin 이 직접 관리)
- `board_posts` — 글 (제목 + 본문 + 이미지[] + author_id/author_name 직접 컬럼)
- `board_comments` — 댓글 (작성자 직접 컬럼)
- Storage: `board-images` 버킷 (5MB, jpg/png/webp/gif)

### 권한 모델 (RLS)
- 헬퍼: `is_board_member(board_id)`, `can_view_board(board_id)` (admin/master 분기 포함)
- SELECT: `can_view_board()` — 멤버 OR admin/master, 숨김 게시판은 admin/master 만
- INSERT (글/댓글): 멤버 본인만 (`author_id = auth.uid()` 강제)
- UPDATE (글): 본인 + 멤버 자격 유지 시
- DELETE: `is_admin_or_master() OR author_id = auth.uid()` (021 패턴)
- 멤버 추가/제거: admin/master 단독

### 라우트 매트릭스

| 라우트 | 인증 | 용도 |
|--------|------|------|
| `/boards` | 멤버 | 내 게시판 목록 |
| `/boards/[boardId]` | 멤버 | 글 목록 + 작성 폼 |
| `/boards/[boardId]/[postId]` | 멤버 | 글 상세 + 댓글 |
| `/admin/boards` | staff | 게시판 신설/숨김/삭제 |
| `/admin/boards/[id]/members` | staff | 멤버 검색/추가/저장 |
| `GET /api/boards` | 인증 | 내가 볼 수 있는 게시판 |
| `GET/POST /api/boards/[id]/posts` | 멤버 | 글 목록(cursor) / 작성 |
| `GET/PATCH/DELETE /api/boards/[id]/posts/[postId]` | 멤버 | 상세 / 수정 / 삭제 |
| `POST /api/boards/[id]/posts/[postId]/comments` | 멤버 | 댓글 작성 |
| `DELETE /api/boards/[id]/posts/[postId]/comments/[cid]` | 멤버 | 댓글 삭제 |
| `GET/POST /api/admin/boards` | staff | 목록 / 신설 |
| `PATCH/DELETE /api/admin/boards/[id]` | staff | 수정 / 영구 삭제 |
| `GET/PUT /api/admin/boards/[id]/members` | staff | 멤버 조회 / 일괄 교체 |

### 모바일 호환성 (백엔드 무수정 재사용)

설계 원칙 7가지 모두 v1 부터 적용:

1. **인증 단일 진입점** — 모든 라우트가 `createApiClient(request)` 사용 → Bearer/쿠키 자동 분기
2. **camelCase DTO** — `toBoardDto`, `toBoardPostDto`, `toBoardCommentDto` 가 snake_case 차단
3. **ISO 8601 날짜** — Supabase timestamptz 자동
4. **에러 통일** — `{ error: string }` + 표준 상태코드 (400/401/403/404/500)
5. **권한 서버 계산** — `canDelete` 가 응답에 포함, 모바일이 RLS 재현 불필요
6. **클라이언트 직접 Storage 업로드** — `@supabase/supabase-js` (RN 동일) + Storage RLS 가 멤버 게이트
7. **cursor 페이지네이션** — `${ISO}|${id}` 형식, offset 미사용 (동시 INSERT 누락 방지)

### 데이터 흐름

```
admin/boards 페이지
    │
    ├─ POST /api/admin/boards { title, description?, initialMemberIds? }
    │     → boards INSERT + board_members INSERT (옵션)
    │
    ├─ PATCH /api/admin/boards/[id] { isVisible?: false }  (숨김 처리)
    └─ DELETE /api/admin/boards/[id]                       (영구 삭제 — CASCADE)

admin/boards/[id]/members 페이지
    │
    ├─ supabase.from("profiles").or("name.ilike.%q%,email.ilike.%q%")  (검색)
    └─ PUT /api/admin/boards/[id]/members { profileIds: [...] }       (일괄 교체)

(member)/boards 페이지 (RSC)
    │
    └─ listVisibleBoards(supabase) → Board[]   ← RLS 가 멤버+가시 필터

(member)/boards/[boardId] 페이지 (RSC + 클라이언트)
    │
    ├─ getBoardById(supabase, boardId)      ← RLS 가 게이트
    ├─ listPosts(supabase, boardId, ...)    ← cursor 페이지네이션
    └─ BoardPostList (클라이언트)
          │
          ├─ "더 보기" → fetch /api/boards/{id}/posts?cursor=...&limit=20
          └─ "글쓰기" → BoardPostForm
                │
                ├─ supabase.storage.from("board-images").upload(`${boardId}/${userId}/${ts}.${ext}`)
                │     → 5MB 초과 시 compressImage() 자동 압축
                │     → Storage RLS 가 멤버 검증
                ├─ getPublicUrl() → URL
                └─ POST /api/boards/{id}/posts { title, content, images: [URL] }
                      → board_posts INSERT (author_id = auth.uid())
                      → RLS 가 멤버 + URL 화이트리스트(board-images) 검증

(member)/boards/[boardId]/[postId] 페이지 (RSC + 클라이언트)
    │
    ├─ getPostWithComments(supabase, postId, viewerId, isAdminOrMaster)
    │     → { post: BoardPost, comments: BoardComment[] }
    │     → canDelete 서버 계산
    │
    └─ BoardPostDetail (클라이언트)
          │
          ├─ POST /api/boards/{id}/posts/{postId}/comments { content }
          ├─ DELETE /api/boards/{id}/posts/{postId}            (본인 OR admin)
          └─ DELETE /api/boards/{id}/posts/{postId}/comments/{cid}
```

### 작성자 추적 — 020 shadow 패턴 미사용 결정

다른 컨텐츠(notices/weeklies/gallery_albums/events) 는 `content_authors` shadow 테이블을 써서
**공개 응답에 작성자 정보가 새지 않도록** 막았다. 본 시스템은 멤버에게 작성자 표시가 **필수**이므로:

- `board_posts.author_id` + `author_name` 직접 컬럼
- `author_name` 은 작성 시점 닉네임 스냅샷 — 닉네임 변경/탈퇴(`auth.users` 삭제) 후에도 보존
- `author_id ON DELETE SET NULL` — 탈퇴 시 글은 살고 작성자 매칭만 끊김
- `content_authors.content_type` 에 `'board_post'` 추가하지 **않음**

→ 결과: 멤버 조회 시 즉시 작성자 표시, JOIN 불필요, 탈퇴 후에도 "이름 (탈퇴)" 식 표시 자연스러움.

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
| 설교 목록 | ISR (DB read) | 1시간 (`revalidate: 3600`) — YouTube fetch 는 cron 시점만 |
| 업데이트 노트 (`/api/updates`, `/updates`, 관리자 카드) | ISR (파일 read) | 1시간 (`revalidate: 3600`) |
| 정적 페이지 (예배, 소개 등) | Static (빌드 시) | - |
| 공지사항 | Dynamic (매 요청) | - |
| 온디맨드 무효화 | POST `/api/revalidate` | - |

### Vercel Cron (`vercel.json`)

| 경로 | 스케줄 (UTC) | 의미 |
|------|--------------|------|
| `/api/admin/cron/alimtalk-events` | `0 21 * * *` (KST 06:00) | D-1 일정 알림톡 발송 |
| `/api/admin/cron/sync-sermons` | `0 6 * * *` (KST 15:00) | YouTube → sermon_videos upsert (50개 누적) |

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

## 관리자 권한 매트릭스

`src/lib/admin-permissions.ts` 가 단일 진실의 원천. 미들웨어·사이드바·하단 탭바·메뉴 페이지·대시보드 카드가 모두 이 모듈만 참조한다.

| 경로 prefix | 최소 권한 | 비고 |
|------------|----------|------|
| `/admin` | staff | 대시보드 (카드는 권한별 필터링) |
| `/admin/menu` | staff | 전체 메뉴 (아이템은 권한별 필터링) |
| `/admin/guide` | staff | 가이드 페이지 |
| `/admin/updates` | staff | 업데이트 노트 전체 보기 |
| `/admin/notices` | **admin** | 공지사항 |
| `/admin/weeklies` · `/admin/masters` · `/admin/calendar` · `/admin/event-subscribers` | **admin** | 주보·일정 그룹 |
| `/admin/inquiries` · `/admin/new-families` | **admin** | 문의·새가족 그룹 |
| `/admin/gallery` · `/admin/boards` | staff | 갤러리·게시판 그룹 |
| `/admin/posters` | staff | 포스터 |
| `/admin/sermons` · `/admin/shorts` | staff | 설교·쇼츠 그룹 |
| `/admin/members` | **master** | 회원관리 (role 변경 단독) |

**적용 경계 (Defense in depth)**

1. **미들웨어** (`src/middleware.ts`) — 서버측 진짜 보안 경계. URL 직접 입력해도 차단. 부족 시 `/admin?notice=no_permission` 으로 리디렉트.
2. **레이아웃 필터링** (`src/app/admin/layout.tsx`) — 사이드바·하단 탭바에서 권한 없는 항목을 **숨김**.
3. **메뉴 페이지 필터링** (`src/app/admin/menu/page.tsx`) — 아이템 단위 필터, 빈 그룹은 자동 숨김.
4. **대시보드 카드 필터링** (`src/app/admin/page.tsx`) — 처리 대기·빠른 작성·최근 활동 카드 모두 권한별 분기. 권한 없는 섹션은 통째로 비노출.
5. **API 라우트** (`src/lib/admin-auth.ts`) — `requireAdmin(request?)` 는 staff 통과(현 사양). 향후 더 세밀한 admin-only API 가 필요하면 `requireMinRole(request, "admin")` 헬퍼 추가 검토.

`RLS` 는 별도 보안층이며 UI 권한과 일치하지 않을 수 있다(예: `new_family_registrations` 는 staff SELECT 허용). UI 가시성은 위 매트릭스가, DB 접근 가능성은 RLS 가 결정한다.

---

## 업데이트 노트 시스템

DB 없이 **파일 기반**으로 운영. 진실의 원천은 루트 `UPDATES.md` 하나.

```
[루트 UPDATES.md]  ← 사람이 직접 편집(또는 Claude가 사용자 지시로 갱신)
        │
        │ build/runtime read + parse
        ▼
[src/lib/updates.ts]  ← loadUpdates(), parseUpdates(), stripMetaComments()
        │
        ├──► [관리자 대시보드 카드]  src/app/admin/_components/UpdatesCard.tsx
        │     상위 5개 + staff-only 포함
        │
        ├──► [관리자 전체보기]  src/app/admin/updates/page.tsx
        │     전체 목록 + staff-only 포함
        │
        ├──► [GET /api/updates]  공개 JSON (staff-only 제외)
        │     모바일 앱 / 외부 통합 동일 엔드포인트
        │
        └──► [공개 페이지 /updates]  src/app/(public)/updates/page.tsx
              staff-only 제외, 타임라인 UI
```

**메타 주석**

- `<!-- highlight -->` — 카드/공개 페이지에서 **NEW** 배지 표시
- `<!-- staff-only -->` — 관리자 전용 (공개 API/공개 페이지에서 제외)

**Vercel 트레이싱**

`next.config.ts` 의 `outputFileTracingIncludes` 에 `UPDATES.md` 경로를 명시 — Vercel Functions
번들에 파일이 포함되어 production 런타임에서 `fs.readFile` 가 동작한다.

**갱신 절차**

1. `UPDATES.md` 상단에 `## YYYY-MM-DD — 제목` 섹션 추가
2. 커밋 → push → Vercel 재배포 → 1시간 내 (또는 `/api/revalidate` 호출 후 즉시) 반영

---

## 배포

- **플랫폼**: Vercel (GitHub 자동 배포)
- **빌드**: `npm run build` → Next.js static + dynamic
- **CI/CD**: GitHub Actions (쇼츠 생성 파이프라인)
- **환경변수 (Vercel — 일상 트래픽)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `REVALIDATE_SECRET`, `GITHUB_PAT`, `CRON_SECRET`
- **환경변수 (선택, 카카오 비즈 승인 후 추가)**: `KAKAO_BIZ_API_KEY`, `KAKAO_BIZ_SENDER_KEY`, `KAKAO_BIZ_API_URL`
- **환경변수 (마이그레이션 1회용 — 사용 후 제거 권장)**: `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`
- **GitHub Secrets**: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
