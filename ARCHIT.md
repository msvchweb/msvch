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
│   │   ├── churchschool/        # 교회학교
│   │   ├── gallery/             # 갤러리
│   │   ├── greetings/           # 인사말
│   │   ├── intro/               # 교회소개
│   │   ├── map/                 # 오시는 길
│   │   ├── menu/                # 더보기 메뉴 (탭바 연동)
│   │   ├── ministry/            # 문화사역
│   │   ├── notice/              # 공지사항
│   │   ├── sermons/             # 설교 영상
│   │   ├── timetable/           # 시간표
│   │   ├── volunteer/           # 봉사
│   │   ├── weekly/              # 주보
│   │   └── worship/             # 예배 안내
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
│   │   └── weeklies/
│   │
│   └── api/                     # API 라우트
│       ├── og/                  # OG 이미지 생성 (Edge)
│       ├── revalidate/          # ISR 캐시 무효화
│       ├── sermon-summary/      # Gemini 설교 요약
│       └── sermons/             # 설교 목록
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
│   │   ├── RecentNotice.tsx
│   │   └── LatestSermon.tsx
│   │
│   ├── gallery/
│   │   └── GalleryGrid.tsx
│   │
│   ├── groups/
│   │   └── DiscussionList.tsx
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
│   ├── gemini.ts                # Gemini AI 호출
│   ├── notices.ts               # 공지/주보 데이터
│   ├── utils.ts                 # cn(), formatDate()
│   └── youtube.ts               # YouTube RSS 파싱
│
├── types/
│   ├── gallery.ts
│   ├── notice.ts
│   ├── supabase.ts
│   └── youtube.ts
│
└── middleware.ts                 # 인증 미들웨어
```

---

## 네비게이션 구조

### Header (데스크톱)
- `lg:flex` — 수평 드롭다운 메뉴
- 6개 카테고리: 교회소개, 예배, 교회학교, 소식, 문화사역, 커뮤니티
- 설정: `nav-config.ts` (`NavItem[]`)

### Header (모바일)
- `lg:hidden` — 햄버거 → 아코디언 메뉴

### BottomTabBar (모바일/태블릿)
- `lg:hidden` — 5개 고정 탭
- 탭: 홈, 예배, 설교, 소식, 더보기
- 설정: `tab-config.ts` (`TabItem[]`)
- 숨김: `/admin/*`, `/login`, `/signup`

### Admin 사이드바
- `admin/layout.tsx` — 좌측 사이드바
- 5개 메뉴: 대시보드, 공지사항, 주보, 갤러리, 설교 요약

---

## 데이터 흐름

```
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

- **플랫폼**: Cloudflare Pages (목표)
- **빌드**: `npm run build` → Next.js static + dynamic
- **환경변수**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `REVALIDATE_SECRET`
