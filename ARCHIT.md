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
│   │   ├── shorts/              # 쇼츠 관리 (생성/검수/승인)
│   │   └── weeklies/
│   │
│   └── api/                     # API 라우트
│       ├── calendar/            # 교회 일정 (Google Calendar, 모바일 호환)
│       ├── gallery/             # 갤러리 목록 (태그 필터, 모바일 호환)
│       ├── og/                  # OG 이미지 생성 (Edge)
│       ├── revalidate/          # ISR 캐시 무효화
│       ├── sermon-summary/      # Gemini 설교 요약
│       ├── sermons/             # 설교 목록
│       └── shorts/              # 쇼츠 CRUD + 트리거 (모바일 호환)
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
│   ├── gallery.ts               # 갤러리 데이터
│   ├── admin-auth.ts            # API admin 인증 헬퍼
│   ├── gemini.ts                # Gemini AI 호출 (폴백 체인)
│   ├── google-calendar.ts       # Google Calendar API v3
│   ├── notices.ts               # 공지/주보 데이터
│   ├── utils.ts                 # cn(), formatDate()
│   ├── validation.ts            # Zod 스키마 + 파일/입력 검증 유틸
│   └── youtube.ts               # YouTube Data API v3
│
├── types/
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
- 6개 메뉴: 대시보드, 공지사항, 주보, 갤러리, 설교 요약, 쇼츠

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
- **환경변수 (Vercel)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY`, `REVALIDATE_SECRET`, `GITHUB_PAT`
- **GitHub Secrets**: `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
