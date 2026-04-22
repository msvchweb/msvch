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
│   │   ├── notice/              # 공지사항
│   │   ├── sermons/             # 말씀영상
│   │   ├── staff/               # 섬기는 이들
│   │   ├── volunteer-center/    # 봉사센터 (반찬/이미용/문화/탁구)
│   │   ├── weekly/              # 주보
│   │   └── worship/             # 예배안내 (시간표 통합)
│   │
│   ├── (auth)/                  # 인증 페이지
│   │   ├── login/
│   │   └── signup/
│   │
│   ├── (member)/                # 회원 전용 (미들웨어 보호)
│   │   ├── groups/
│   │   └── profile/
│   │
│   ├── admin/                   # 관리자 전용 (미들웨어 보호)
│   │   ├── layout.tsx           # 사이드바 레이아웃
│   │   ├── gallery/
│   │   ├── notices/
│   │   ├── sermons/
│   │   ├── calendar/            # 교회일정 관리 (Google Calendar 생성/삭제)
│   │   ├── shorts/              # 쇼츠 관리 (생성/검수/승인)
│   │   ├── masters/             # 주보 마스터 (올해표어/목장/섬기는이/후원/공동체기도)
│   │   └── weeklies/
│   │
│   └── api/                     # API 라우트
│       ├── calendar/            # 교회 일정 CRUD (Google Calendar, 모바일 호환)
│       ├── gallery/             # 갤러리 목록 (태그 필터, 모바일 호환)
│       ├── og/                  # OG 이미지 생성 (Edge)
│       ├── revalidate/          # ISR 캐시 무효화
│       ├── sermon-summary/      # Gemini 설교 요약
│       ├── sermons/             # 설교 목록
│       ├── shorts/              # 쇼츠 CRUD + 트리거 (모바일 호환)
│       └── weeklies/
│           └── generate-pdf/    # Puppeteer PDF 생성 → Supabase Storage 업로드
│
├── components/
│   ├── layout/                  # 레이아웃 컴포넌트
│   │   ├── Header.tsx           # 상단 네비게이션
│   │   ├── Footer.tsx           # 하단 푸터
│   │   ├── BottomTabBar.tsx     # 하단 탭바 (모바일/태블릿)
│   │   ├── nav-config.ts        # Header 메뉴 설정
│   │   └── tab-config.ts        # 탭바 설정 (플랫폼 공용)
│   │
│   ├── home/                    # 홈페이지 섹션
│   │   ├── HeroSection.tsx
│   │   ├── QuickLinks.tsx
│   │   ├── WorshipTimeCard.tsx
│   │   ├── UpcomingEvents.tsx     # 다가오는 일정 위젯
│   │   ├── RecentNotice.tsx
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
│   │   └── server.ts            # 서버 Supabase 클라이언트
│   ├── bulletin-master.ts       # 5개 마스터 테이블 병렬 로드 + parseTopicOfYear
│   ├── gallery.ts               # 갤러리 데이터
│   ├── admin-auth.ts            # API admin 인증 헬퍼
│   ├── gemini.ts                # Gemini AI 호출 (폴백 체인)
│   ├── google-calendar.ts       # Google Calendar API v3
│   ├── notices.ts               # 공지/주보 데이터
│   ├── utils.ts                 # cn(), formatDate()
│   ├── validation.ts            # Zod 스키마 + 파일/입력 검증 유틸
│   ├── weekly-html-template.ts  # 주보 HTML 빌더 (앞/뒷면, A4 인쇄용)
│   └── youtube.ts               # YouTube Data API v3
│
├── types/
│   ├── bulletin-master.ts       # BulletinMasterData, 5개 row 타입
│   ├── calendar.ts              # CalendarEvent
│   ├── gallery.ts
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
- 설정: `nav-config.ts` (`NavItem[]`)

### Header (모바일)
- `lg:hidden` — 햄버거 → 아코디언 메뉴
- children 없는 항목은 `<Link>`, 있는 항목은 `<button>` + accordion

### BottomTabBar (모바일/태블릿)
- `lg:hidden` — 5개 고정 탭
- 탭: 홈, 말씀, 갤러리, 소식, 더보기
- 설정: `tab-config.ts` (`TabItem[]`)
- 숨김: `/admin/*`, `/login`, `/signup`

### Admin 사이드바
- `admin/layout.tsx` — 좌측 사이드바
- 7개 메뉴: 대시보드, 공지사항, 주보, 갤러리, 교회일정, 설교 요약, 쇼츠

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
```

---

## 인증 아키텍처

```
브라우저 요청
    │
    ▼
middleware.ts ── 경로 매칭 (/groups/*, /admin/*, /profile/*)
    │
    ├── 비보호 경로 → 통과
    ├── 미인증 → /login 리다이렉트
    └── /admin + 비admin → / 리다이렉트
```

- 세션: 쿠키 기반 (Supabase SSR)
- 역할: `profiles.role` (`member` | `admin`)
- 로그아웃: `LogoutButton` 컴포넌트 (프로필 페이지에 배치)

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
| `church-gold` | `#c9a84c` | 골드 강조, 구분선 |
| `church-cream` | `#faf8f4` | 밝은 배경 |
| `church-dark` | `#111827` | 어두운 배경 (Footer) |
| `church-warm` | `#78716c` | 보조 텍스트 |

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
- **환경변수 (Vercel)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `REVALIDATE_SECRET`, `GITHUB_PAT`
- **환경변수 (로컬 개발 only)**: `CHROME_EXECUTABLE_PATH` — 로컬 Chrome 경로 (Puppeteer PDF 생성용, Vercel에서는 @sparticuz/chromium 자동 사용)
- **GitHub Secrets**: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
