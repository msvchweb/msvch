# 쇼츠 자동화 구현을 위한 프로젝트 분석 보고서

> 작성일: 2026-04-12
> 목적: YouTube 자막 기반 쇼츠 자동화 기능을 구현하기 위해 기존 프로젝트의 구조, 패턴, 재사용 가능한 자산을 파악한다.
> 범위: 웹 전용 (모바일 앱은 별도)
> 핵심 변경: Whisper API 완전 배제, YouTube 자막(json3)으로 대체

---

## 1. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.2 |
| UI | React + TypeScript | 19.2.4 / 5 |
| 스타일 | Tailwind CSS | 4 |
| DB / Auth / Storage | Supabase (@supabase/ssr) | 0.10.0 / 2.101.1 |
| AI | Google Gemini (REST, API key) | 2.5-flash + 폴백 |
| 영상 | YouTube Data API v3 (REST, API key) | — |
| 이미지 | sharp, Next.js Image | 0.34.5 |
| 갤러리 뷰어 | yet-another-react-lightbox | 3.30.1 |
| 아이콘 | lucide-react | 1.7.0 |
| 배포 | Vercel (GitHub 자동 배포) | — |
| 저장소 | github.com/msvchweb/msvch (private) | — |

---

## 2. 디렉토리 구조

```
src/
├── app/
│   ├── (public)/            ← 공개 페이지 (서버 컴포넌트 위주)
│   │   ├── sermons/         ← 설교 목록 + [id] 상세
│   │   ├── gallery/         ← 비전갤러리
│   │   ├── notice/          ← 공지사항 목록 + [slug] 상세
│   │   ├── worship/         ← 예배안내
│   │   ├── weekly/          ← 주보
│   │   ├── map/             ← 찾아오시는 길 (Google Maps Embed)
│   │   ├── greetings/       ← 인사말
│   │   ├── staff/           ← 섬기는 이들
│   │   ├── churchschool/    ← 교회학교 [department]
│   │   └── volunteer-center/← 봉사센터
│   ├── admin/               ← 관리자 패널 (클라이언트 컴포넌트)
│   │   ├── layout.tsx       ← 사이드바 네비게이션 (adminNav 배열)
│   │   ├── page.tsx         ← 대시보드 (통계 카드)
│   │   ├── notices/         ← 공지 CRUD
│   │   ├── weeklies/        ← 주보 관리 + PDF 업로드
│   │   ├── gallery/         ← 앨범/이미지 CRUD + Storage 업로드
│   │   └── sermons/         ← Gemini 설교 요약 생성
│   ├── api/
│   │   ├── sermons/route.ts         ← GET: YouTube 설교 목록 (15개)
│   │   ├── sermon-summary/route.ts  ← POST: Gemini 요약 (admin only, maxDuration=60)
│   │   ├── gallery/route.ts         ← GET: 앨범 목록 (태그 필터)
│   │   ├── gallery/[id]/images/     ← GET: 앨범별 이미지
│   │   ├── new-content/route.ts     ← GET: 최신 콘텐츠 날짜 (뱃지용)
│   │   ├── revalidate/route.ts      ← POST: ISR 캐시 갱신
│   │   └── og/route.tsx             ← GET: OG 이미지 (Edge)
│   ├── layout.tsx
│   └── globals.css          ← Tailwind 테마 (church-gold, primary-600, Pretendard)
├── components/
│   ├── layout/              ← Header, Footer, BottomTabBar, NavigationShell
│   ├── home/                ← HeroSection, LatestSermon, RecentNotice
│   ├── gallery/             ← GalleryGrid (2단계 필터 + 라이트박스 + 페이지네이션)
│   ├── ui/                  ← Container, PageHeader, Card, Skeleton
│   └── SermonTabs.tsx       ← 설교 탭 필터 (주일/수요/금요/새벽/찬양)
├── lib/
│   ├── supabase/server.ts   ← 서버용 클라이언트 (cookies 기반)
│   ├── supabase/client.ts   ← 브라우저용 클라이언트
│   ├── youtube.ts           ← getSermonVideos(), getLatestSermon()
│   ├── gemini.ts            ← callGemini() + 폴백 체인 + summarizeSermonFromVideo()
│   ├── gallery.ts           ← getGalleryAlbums() (태그 AND/OR 필터)
│   ├── notices.ts           ← getNotices(), getNoticeBySlug(), getWeeklies()
│   ├── utils.ts             ← cn(), formatDate(), formatDateKorean()
│   └── new-content-provider.tsx ← 새 콘텐츠 뱃지 Context (localStorage 기반)
├── types/
│   ├── youtube.ts           ← SermonVideo
│   ├── gallery.ts           ← GalleryAlbum, GalleryImage
│   ├── notice.ts            ← Notice, Weekly
│   └── supabase.ts          ← Profile, Group, GroupPost
└── middleware.ts             ← /admin/* 보호 (auth + role=admin 체크)
```

---

## 3. 인증 & 권한 시스템

### 흐름
```
로그인 → Supabase Auth 세션 쿠키 → middleware.ts 검증 → API route 이중 체크
```

### middleware.ts (src/middleware.ts:1-66)
- matcher: `/groups/:path*`, `/admin/:path*`, `/profile/:path*`
- `/admin/*`: user 미존재 → `/login` 리다이렉트, `profiles.role !== "admin"` → `/` 리다이렉트

### API 라우트 보호 패턴 (sermon-summary/route.ts:28-40 참고)
```typescript
const supabase = createServerClient(url, anonKey, { cookies });
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;
const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
if (profile?.role !== "admin") return 403;
```

→ **쇼츠 API 라우트에 동일 패턴 적용**

---

## 4. YouTube 연동 상세

### src/lib/youtube.ts (56줄)
- `API_KEY = process.env.YOUTUBE_API_KEY`
- `UPLOADS_PLAYLIST_ID = "UUcJc6fm6McCxvpizoe3T4YQ"` (채널 업로드 재생목록)
- `getSermonVideos(maxResults = 15)`:
  - `GET https://www.googleapis.com/youtube/v3/playlistItems`
  - params: `part=snippet`, `playlistId`, `maxResults`
  - ISR: `revalidate: 1800` (30분)
  - 반환: `SermonVideo[]` → `{ videoId, title, description, thumbnail, publishedAt }`
- `getLatestSermon()`: `getSermonVideos(1)[0]`

### SermonVideo 타입 (src/types/youtube.ts)
```typescript
interface SermonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string; // ISO 8601
}
```

### 쇼츠에서 재사용
- `getSermonVideos()` → Admin에서 영상 선택 UI
- `SermonVideo` 타입 → Job 생성 입력
- `UPLOADS_PLAYLIST_ID` → 최신 영상 자동 감지 (Phase 2)

### 쇼츠에서 새로 필요
- YouTube 자막 추출: `yt-dlp --write-auto-sub --sub-lang ko --sub-format json3` (GitHub Actions에서)
- YouTube 업로드: `videos.insert` API (OAuth 필요, 쿼터 1,600 units/건, 일 6건 상한)

---

## 5. Gemini 연동 상세

### src/lib/gemini.ts (127줄)

**callGemini() (line 32-59)**
- 엔드포인트: `generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
- 인증: API key 쿼리 파라미터
- 반환: `{ ok: true, text } | { ok: false, status, body }`

**모델 폴백 체인 (line 15-19)**
```typescript
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];
```

**재시도 로직 (line 61-126, summarizeSermonFromVideo 내부)**
- 모델당 3회, 지수 백오프 (1s → 2s → 4s)
- 일시적 오류: 429, 500, 502, 503, 504
- 최악: 3모델 × 3회 = 9회 호출, ~21초

**현재 문제: callGemini()이 export되지 않음**
- `summarizeSermonFromVideo()`만 export됨
- 쇼츠에서 범용 Gemini 호출 필요 → `callGemini()`을 export하거나 폴백 포함 래퍼 생성

### 쇼츠에서 필요한 Gemini 호출 2종
1. **하이라이트 선정**: 트랜스크립트 → JSON (5개 구간 + 제목 + 훅)
2. **메타데이터 생성**: 구간별 → YT 제목/설명, IG 캡션, 해시태그

---

## 6. Supabase 상세

### 클라이언트 패턴
- **서버** (`lib/supabase/server.ts`): `createServerClient(url, anonKey, { cookies })` — API 라우트, 서버 컴포넌트
- **브라우저** (`lib/supabase/client.ts`): `createBrowserClient(url, anonKey)` — Admin 페이지
- **RLS**: 모든 테이블 활성화

### 기존 DB 스키마

**001_initial.sql** — profiles, groups, group_posts + handle_new_user 트리거
**002_gallery.sql** — gallery_albums, gallery_images + Storage bucket "gallery"
**003_notices_weeklies.sql** — notices, weeklies + Storage bucket "weeklies"
**004_gallery_tags.sql** — gallery_albums.tags (text[] + GIN 인덱스)

### Storage 버킷
- `gallery` — 갤러리 이미지 (공개)
- `weeklies` — 주보 PDF (공개)
- (신규) `shorts` — 쇼츠 mp4 임시 저장 (공개, 발행 후 삭제)

---

## 7. Admin 패널 상세

### 레이아웃 (src/app/admin/layout.tsx)
```typescript
const adminNav = [
  { label: "대시보드", href: "/admin", icon: LayoutDashboard },
  { label: "공지사항", href: "/admin/notices", icon: Newspaper },
  { label: "주보", href: "/admin/weeklies", icon: FileText },
  { label: "갤러리", href: "/admin/gallery", icon: ImageIcon },
  { label: "설교 요약", href: "/admin/sermons", icon: Sparkles },
];
```
- 좌측 사이드바 (w-60, border-r, bg-gray-50) + 우측 콘텐츠 (flex-1, p-8)
- 쇼츠 추가: `{ label: "쇼츠", href: "/admin/shorts", icon: Video }` 1줄

### Admin 페이지 공통 패턴
1. `"use client"` 클라이언트 컴포넌트
2. `useState` + `useEffect`로 데이터 로딩
3. Supabase 직접 호출 (gallery, notices) 또는 fetch API route (sermons)
4. 로딩 → 목록 → 폼/모달

### UI 스타일 규칙
- 페이지 제목: `text-2xl font-bold text-gray-900`
- 설명: `text-sm text-gray-500 mb-8`
- 카드: `rounded-xl border border-gray-200 bg-white`
- 일반 버튼: `bg-primary-50 text-primary-600 hover:bg-primary-100`
- 성공 버튼: `bg-emerald-50 text-emerald-600 hover:bg-emerald-100`
- 위험 버튼: `bg-red-50 text-red-600 hover:bg-red-100`
- 비활성: `disabled:opacity-50`
- 로딩: `<Loader2 className="animate-spin" />`
- 아이콘: lucide-react, size={14~18}
- 뱃지: 색상 배경 + rounded-lg + px-3 py-1.5 + text-xs font-medium

---

## 8. 쇼츠 파이프라인 (확정)

### YouTube 자막 방식 (Whisper 완전 배제)
```bash
yt-dlp --write-auto-sub --sub-lang ko --sub-format json3 \
       -f "bv*[height<=1080]+ba/b[height<=1080]" \
       --merge-output-format mp4 \
       -o "sermon_%(id)s.mp4" \
       "https://youtube.com/watch?v=XXX"
```
- `json3` 포맷: 단어 단위 타임스탬프 포함
- 비용: $0
- OpenAI 계정 불필요

### 파이프라인 단계
```
[1] yt-dlp: 영상 다운로드 + 한국어 자막(json3) 추출
     ↓
[2] Gemini: 자막 텍스트 → 하이라이트 5개 선정 (start/end초, 제목, 훅, 이유)
     ↓
[3] 타임스탬프 스냅: Gemini 반환값을 자막 segment 경계로 보정
     ↓
[4] FFmpeg: 구간 컷 + 9:16 크롭 + ASS 자막 번인
     ↓
[5] Gemini: 메타데이터 생성 (YT 제목/설명, IG 캡션, 해시태그)
     ↓
[6] Supabase: shorts_jobs/clips 저장 + mp4를 Storage 임시 업로드
     ↓
[7] Admin /admin/shorts: 미리보기 + 자막 확인 + 승인/반려
     ↓
[8] 승인 시: YouTube videos.insert (private→public)
```

### 실행 환경: GitHub Actions
- 워크플로우: `.github/workflows/sermon-shorts.yml`
- 트리거: `workflow_dispatch` (Admin 버튼) + `schedule` (Phase 2)
- 러너: `ubuntu-latest` (ffmpeg 기본, yt-dlp는 pipx install)
- 제한: 6시간/작업, 2,000분/월 무료 → 예상 60분/월 (3%)

### 비용
| 항목 | 월 비용 |
|------|---------|
| YouTube 자막 (yt-dlp) | $0 |
| Gemini API | ~$0.04 |
| GitHub Actions | $0 |
| Supabase Storage 임시 | $0 |
| YouTube Upload API | $0 |
| **합계** | **~$0.04/월** |

---

## 9. DB 스키마 설계 (005_shorts.sql)

### shorts_jobs
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK DEFAULT gen_random_uuid() | |
| video_id | text NOT NULL UNIQUE | YouTube videoId |
| video_title | text NOT NULL | |
| video_published_at | timestamptz | |
| status | text NOT NULL DEFAULT 'pending' | 상태 머신 |
| error | text | 실패 시 메시지 |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

**status 흐름:**
```
pending → downloading → transcribing → selecting → editing
  → ready_for_review → published / failed
```

### shorts_clips
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK DEFAULT gen_random_uuid() | |
| job_id | uuid FK → shorts_jobs ON DELETE CASCADE | |
| clip_index | int NOT NULL | 0~4 |
| start_sec | numeric NOT NULL | |
| end_sec | numeric NOT NULL | |
| title | text | LLM 생성 제목 |
| hook | text | 첫 3초 훅 문장 |
| transcript | text | 구간 자막 전문 |
| caption_yt | text | YouTube 설명 |
| caption_ig | text | Instagram 캡션 |
| video_url | text | Supabase Storage URL |
| review_status | text DEFAULT 'pending' | pending/approved/rejected |
| reviewer_note | text | 반려 사유 |
| youtube_video_id | text | 발행 후 |
| published_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

### shorts_settings (싱글톤)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int PK DEFAULT 1 CHECK (id = 1) | |
| auto_publish | boolean DEFAULT false | |
| max_clips_per_sermon | int DEFAULT 5 | |
| daily_publish_limit | int DEFAULT 5 | |
| highlight_prompt | text | Gemini 프롬프트 |
| metadata_prompt | text | Gemini 프롬프트 |
| updated_at | timestamptz DEFAULT now() | |

---

## 10. Admin /admin/shorts 설계

### 화면 구성
```
┌──────────────────────────────────────────────────────┐
│ 쇼츠 관리                              [쇼츠 생성] 버튼│
│ 설교 영상에서 쇼츠를 자동 생성합니다                     │
├──────────────────────────────────────────────────────┤
│ ┌─ Job Card ───────────────────────────────────────┐ │
│ │ [썸네일] 설교 제목              상태: 검수 대기    │ │
│ │          2026-04-12            클립 5개 생성      │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ ┌─ Clip 1 ────────────────────────────────────┐  │ │
│ │ │ [비디오 미리보기]  "은혜의 순간"              │  │ │
│ │ │ 06:52 ~ 07:38 (46초)                       │  │ │
│ │ │ 훅: "하나님이 가장 기뻐하시는 순간은..."      │  │ │
│ │ │ 자막 텍스트 (접기/펼치기)                    │  │ │
│ │ │                          [승인] [반려]       │  │ │
│ │ └─────────────────────────────────────────────┘  │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### "쇼츠 생성" 버튼 동작
1. `/api/sermons`에서 영상 목록 모달
2. 영상 선택
3. `POST /api/shorts/trigger` → GitHub REST API `workflow_dispatch`
4. `shorts_jobs` 생성 (status: pending)
5. 페이지에서 상태 폴링

### 승인/반려
- 승인: `POST /api/shorts/[id]/approve` → review_status='approved' → YouTube 업로드
- 반려: `POST /api/shorts/[id]/reject` → review_status='rejected' + reviewer_note

---

## 11. 신규 파일 목록

### GitHub Actions
```
.github/workflows/sermon-shorts.yml
```

### 파이프라인 스크립트
```
scripts/shorts/run.ts              ← 진입점
scripts/shorts/download.ts         ← yt-dlp
scripts/shorts/highlight.ts        ← Gemini 하이라이트
scripts/shorts/edit.ts             ← FFmpeg
scripts/shorts/metadata.ts         ← Gemini 메타데이터
scripts/shorts/upload.ts           ← Supabase + YouTube
```

### DB
```
supabase/migrations/005_shorts.sql
```

### Admin + API
```
src/app/admin/shorts/page.tsx
src/app/api/shorts/route.ts
src/app/api/shorts/[id]/approve/route.ts
src/app/api/shorts/[id]/reject/route.ts
src/app/api/shorts/trigger/route.ts
src/types/shorts.ts
```

### 기존 파일 수정
```
src/lib/gemini.ts          ← callGemini() export
src/app/admin/layout.tsx   ← adminNav에 쇼츠 항목
```

---

## 12. 기존 코드 재사용 매핑

| 기존 자산 | 위치 | 쇼츠 용도 |
|-----------|------|----------|
| `getSermonVideos()` | lib/youtube.ts:19 | Admin 영상 목록 |
| `SermonVideo` 타입 | types/youtube.ts:1 | Job 입력 데이터 |
| `callGemini()` | lib/gemini.ts:32 | 하이라이트 + 메타데이터 (export 필요) |
| 모델 폴백 + 재시도 | lib/gemini.ts:15-19 | 그대로 재사용 |
| 서버 Supabase 클라이언트 | lib/supabase/server.ts | API 라우트 |
| 브라우저 Supabase 클라이언트 | lib/supabase/client.ts | Admin 페이지 |
| middleware /admin/* | middleware.ts:45 | /admin/shorts 자동 보호 |
| Admin 레이아웃 | admin/layout.tsx | adminNav 1줄 추가 |
| API 인증 패턴 | api/sermon-summary/route.ts:28-40 | 동일 패턴 복사 |

---

## 13. Phase 1 구현 순서

```
Step 1:  DB 마이그레이션 (005_shorts.sql)
Step 2:  타입 정의 (src/types/shorts.ts)
Step 3:  src/lib/gemini.ts — callGemini() export
Step 4:  scripts/shorts/ 파이프라인
Step 5:  .github/workflows/sermon-shorts.yml
Step 6:  Admin UI (src/app/admin/shorts/page.tsx)
Step 7:  API 라우트 (trigger, approve, reject)
Step 8:  Admin 레이아웃 사이드바 추가
Step 9:  종단 테스트 (workflow_dispatch → mp4 → Admin 검수)
Step 10: YouTube OAuth + 업로드 (Phase 1 완성)
```

---

## 14. 위험 & 대응

| 위험 | 대응 |
|------|------|
| YouTube 자동 자막 없음 | Job failed + "자막 없음" 메시지 |
| 자막 타임스탬프 부정확 | segment 경계 스냅 |
| Gemini 하이라이트 품질 | 프롬프트 DB 저장, Admin에서 수정 |
| 신학적 맥락 훼손 | 사람 검수 필수, auto_publish OFF |
| FFmpeg 처리 시간 | Actions timeout 60분 (충분) |
| YouTube 쿼터 초과 | daily_publish_limit=5 |

---
---

# 보안 취약점 분석 보고서

> 작성일: 2026-04-13
> 목적: 웹 애플리케이션 전체의 보안 취약점을 식별하고 개선 방안을 제시한다.
> 범위: 웹 전용 (모바일 앱 제외)
> 방법: 프로젝트 전체 소스코드 정적 분석 (API 라우트, 프론트엔드, 미들웨어, DB 스키마, 파일 업로드)

---

## 요약

| 등급 | 건수 | 설명 |
|------|------|------|
| 🔴 CRITICAL | 3 | 즉시 수정 필요 — 악용 시 사용자 데이터 탈취 또는 시스템 침해 가능 |
| 🟠 HIGH | 6 | 조기 수정 권장 — 서비스 안정성 또는 데이터 무결성 위협 |
| 🟡 MEDIUM | 5 | 개선 권장 — 방어 심층(defense-in-depth) 강화 |
| 🟢 LOW | 3 | 참고 — 현재 위험은 낮으나 모범 사례와 차이 |
| **합계** | **17** | |

### 긍정적 사항 (이미 잘 되어 있는 것)

- ✅ **SQL 인젝션 면역**: 모든 DB 접근이 Supabase SDK(ORM) 경유, raw SQL 전무
- ✅ **React 자동 이스케이프**: JSX `{variable}` 렌더링은 기본적으로 HTML 이스케이프 적용
- ✅ **dangerouslySetInnerHTML 미사용**: 프로젝트 전체에서 단 한 건도 없음
- ✅ **eval/Function 미사용**: 동적 코드 실행 없음
- ✅ **인증 체계 구축**: middleware.ts + requireAdmin() 이중 검증
- ✅ **RLS(Row Level Security) 활성화**: 모든 Supabase 테이블에 적용
- ✅ **서버 컴포넌트 활용**: 민감한 데이터 처리는 서버 측에서 수행

---

## 1. 🔴 CRITICAL — 파일 업로드 검증 부재

### 1-1. 갤러리 이미지 업로드: 서버측 파일 타입 검증 없음

**위치**: `src/app/admin/gallery/page.tsx:114-151`

**현황**:
```typescript
// 클라이언트에서 accept="image/*"만 설정 (line 340)
// 서버측 검증 전혀 없음
const ext = file.name.split(".").pop();           // 사용자 입력 그대로 사용
const path = `${albumId}/${Date.now()}-${i}.${ext}`;  // 경로에 직접 삽입
```

**공격 시나리오**:
1. 브라우저의 `accept` 속성은 DevTools나 curl로 우회 가능
2. `malware.exe`를 `image.jpg`로 이름 변경 후 업로드
3. 공개 버킷이므로 URL 직접 접근으로 다운로드 가능
4. 파일명에 `../../../` 포함 시 경로 조작 가능성 (Supabase Storage가 방어하지만 앱 레벨 검증 필요)

**영향**: 악성 파일 배포, 스토리지 악용

**수정 방안**:
```typescript
const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

for (const file of files) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`허용되지 않는 파일 형식: ${file.name}`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`파일 크기 초과: ${file.name} (최대 10MB)`);
  }
  // UUID 기반 파일명으로 교체
  const safePath = `${albumId}/${Date.now()}-${i}.${ext}`;
  // ...
}
```

### 1-2. 주보 PDF 업로드: 동일한 문제

**위치**: `src/app/admin/weeklies/page.tsx:42-67`

```typescript
const ext = file.name.split(".").pop();  // 검증 없음
const path = `${weeklyId}.${ext}`;       // 직접 사용
```

**수정 방안**: 확장자를 `["pdf"]`로 제한, 파일 크기 상한 설정 (예: 20MB)

### 1-3. 파일 크기 제한 없음

**위치**: 갤러리 + 주보 업로드 모두

**현황**: `file.size` 체크 없음. 공격자가 수 GB 파일을 반복 업로드하여 스토리지 쿼터 소진 가능.

**수정 방안**: 이미지 10MB, PDF 20MB 상한 적용

---

## 2. 🔴 CRITICAL — 보안 헤더 전면 부재

### 2-1. Content Security Policy (CSP) 미설정

**위치**: `next.config.ts` — headers 설정 없음

**현황**: CSP 헤더가 없으므로, 만약 XSS 취약점이 발견될 경우 인라인 스크립트 실행을 차단할 방어층이 없음.

**수정 방안** — `next.config.ts`에 추가:
```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js 요구
            "style-src 'self' 'unsafe-inline'",                 // Tailwind 요구
            "img-src 'self' https://*.ytimg.com https://*.supabase.co data:",
            "frame-src https://www.youtube.com https://www.google.com",
            "connect-src 'self' https://*.supabase.co",
            "font-src 'self'",
          ].join("; "),
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ];
},
```

---

## 3. 🔴 CRITICAL — Revalidate API 시크릿 비교 타이밍 공격

**위치**: `src/app/api/revalidate/route.ts:12`

**현황**:
```typescript
if (body.secret !== process.env.REVALIDATE_SECRET) {
  return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
}
```

**문제**: JavaScript의 `!==` 연산자는 문자열을 앞에서부터 비교하며, 불일치 시 즉시 반환한다. 공격자는 응답 시간 차이를 측정하여 시크릿을 한 글자씩 추론할 수 있다 (타이밍 공격).

**수정 방안**:
```typescript
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// 사용
if (!safeCompare(body.secret, process.env.REVALIDATE_SECRET ?? "")) {
  return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
}
```

---

## 4. 🟠 HIGH — 입력 검증 부재 (API 라우트)

### 4-1. /api/shorts/trigger — 문자열 길이 제한 없음

**위치**: `src/app/api/shorts/trigger/route.ts:15-22`

```typescript
const body = (await request.json()) as TriggerBody;
if (!body.videoId || !body.videoTitle) { ... }
// videoId, videoTitle의 길이 제한 없음
// videoThumbnail URL 형식 검증 없음
```

**영향**: 수 MB 크기의 문자열을 전송하여 DB 용량 낭비, 메모리 과부하

**수정 방안**:
```typescript
if (!body.videoId?.trim() || body.videoId.length > 50) { ... }
if (!body.videoTitle?.trim() || body.videoTitle.length > 300) { ... }
if (body.videoThumbnail && body.videoThumbnail.length > 2000) { ... }
```

### 4-2. /api/shorts/[id]/reject — reviewer_note 무제한

**위치**: `src/app/api/shorts/[id]/reject/route.ts:18`

```typescript
const body = (await request.json()) as RejectBody;
// body.note 길이 제한 없음, 내용 검증 없음
```

**수정 방안**: `note`를 500자로 제한, `.trim()` 적용

### 4-3. /api/sermon-summary — sermon 객체 런타임 검증 없음

**위치**: `src/app/api/sermon-summary/route.ts:42`

```typescript
const body = await request.json() as { sermon: SermonVideo; saveAsNotice: boolean };
// TypeScript 타입 캐스팅은 런타임에 아무것도 검증하지 않음
```

**수정 방안**: Zod 등 런타임 스키마 검증 도입
```typescript
import { z } from "zod";
const schema = z.object({
  sermon: z.object({
    videoId: z.string().max(50),
    title: z.string().max(300),
    description: z.string().max(10000),
    publishedAt: z.string().datetime(),
    thumbnail: z.string().url(),
  }),
  saveAsNotice: z.boolean(),
});
const body = schema.parse(await request.json());
```

### 4-4. /api/revalidate — paths 배열 무제한

**위치**: `src/app/api/revalidate/route.ts:16`

```typescript
for (const path of body.paths) {
  revalidatePath(path);  // 배열 크기 제한 없음, 경로 형식 검증 없음
}
```

**수정 방안**: 배열 최대 20개, 각 경로 `/`로 시작하는지 검증

### 4-5. /api/gallery, /api/shorts — limit 파라미터 상한 없음

**위치**: `src/app/api/gallery/route.ts`, `src/app/api/shorts/route.ts`

```typescript
const limit = parseInt(limitParam, 10);  // limit=999999 가능
```

**수정 방안**: `Math.min(limit, 100)` 적용

---

## 5. 🟠 HIGH — 회원가입 무제한 (Signup Abuse)

**위치**: `src/app/(auth)/signup/page.tsx`

**현황**:
- 누구나 회원가입 가능 (이메일 인증 없음 — Supabase 설정에 따라 다를 수 있으나 코드에서 확인 불가)
- CAPTCHA 없음
- 가입 속도 제한(rate limiting) 없음

**공격 시나리오**:
1. 봇이 수천 개의 가짜 계정 생성
2. 생성된 계정으로 그룹 게시판에 스팸 게시
3. profiles 테이블 오염

**수정 방안**:
- Supabase 대시보드에서 이메일 확인(email confirmation) 활성화
- hCaptcha 또는 Turnstile 적용
- Supabase Auth rate limiting 설정 확인

---

## 6. 🟡 MEDIUM — Stored XSS 가능성

### 6-1. 공지사항 내용 렌더링

**위치**: `src/app/(public)/notice/[slug]/page.tsx:49-51`

```tsx
<article className="prose max-w-none whitespace-pre-line text-gray-700">
  {notice.content}
</article>
```

**분석**: React의 `{variable}` 구문은 자동으로 HTML 이스케이프하므로, 현재 상태에서 XSS는 **발생하지 않는다**. `<script>alert(1)</script>`를 content에 저장해도 텍스트로 표시된다.

**그러나 위험한 시나리오**:
- 향후 리치 텍스트 에디터 도입 시 `dangerouslySetInnerHTML`을 사용하게 되면 즉시 취약해짐
- 현재도 `whitespace-pre-line`으로 인해 매우 긴 문자열(수만 자)이 렌더링 성능을 저하시킬 수 있음

**수정 방안**: 관리자 폼에서 content 길이 제한 (예: 50,000자) 적용

### 6-2. 그룹 게시글 렌더링

**위치**: `src/components/groups/DiscussionList.tsx:101-104`

```tsx
<h3 className="font-medium text-gray-900">{post.title}</h3>
<p className="mt-2 whitespace-pre-line text-sm text-gray-600">{post.content}</p>
```

**분석**: 위와 동일하게 React 자동 이스케이프로 현재는 안전. 다만 일반 회원이 작성하므로 입력 검증이 더 중요.

**수정 방안**: 제목 100자, 내용 5,000자 제한 적용 (클라이언트 + DB 제약조건)

### 6-3. OG 이미지 title 파라미터

**위치**: `src/app/api/og/route.tsx:7-8`

```tsx
const title = request.nextUrl.searchParams.get("title") ?? "명성비전교회";
// ImageResponse 내부에서 직접 렌더링
```

**분석**: `ImageResponse`는 이미지(PNG)를 생성하므로 브라우저에서 스크립트가 실행되지 않는다. 실질적 XSS 위험은 매우 낮음.

**수정 방안**: title 길이 제한 (100자) + 특수문자 필터링으로 방어 심층 강화

---

## 7. 🟡 MEDIUM — CORS 미설정

**위치**: 프로젝트 전체

**현황**: API 라우트에 CORS 헤더 미설정. Next.js 기본값은 동일 출처 정책을 따르나, 명시적 설정이 없음.

**영향**: 악의적인 외부 사이트에서 로그인된 사용자의 브라우저를 통해 API를 호출할 수 있음 (다만 Supabase 세션 쿠키가 SameSite 속성으로 보호될 수 있음).

**수정 방안**: 민감한 API에 명시적 CORS 설정
```typescript
// 필요한 경우에만 특정 origin 허용
const allowedOrigins = ["https://msvch.vercel.app"];
```

---

## 8. 🟡 MEDIUM — Rate Limiting 부재

**위치**: 모든 API 라우트

**현황**: 어떤 API 엔드포인트에도 요청 속도 제한이 없음.

**영향이 큰 엔드포인트**:
| 엔드포인트 | 위험 |
|-----------|------|
| POST /api/revalidate | 캐시 무효화 폭탄 → 원본 서버 부하 |
| POST /api/sermon-summary | Gemini API 쿼터 소진 (비용 발생 가능) |
| POST /api/shorts/trigger | GitHub Actions 분 소진 |
| GET /api/sermons | YouTube API 쿼터 소진 |

**수정 방안**: Vercel Edge Middleware 또는 `next-rate-limit` 등으로 IP 기반 제한 적용
```
공개 GET: 60 req/min
인증 POST: 10 req/min
revalidate: 5 req/min
```

---

## 9. 🟡 MEDIUM — 에러 메시지 정보 노출

**위치**: 여러 API 라우트

**현황**:
```typescript
// src/app/api/shorts/trigger/route.ts:95
error: `Actions 트리거 실패: ${errText.slice(0, 500)}`

// src/app/api/sermon-summary/route.ts:75
const message = err instanceof Error ? err.message : "알 수 없는 오류";
```

**문제**: 외부 서비스(GitHub API, Gemini API)의 에러 메시지를 클라이언트에 그대로 전달. 내부 인프라 정보(리포지토리 이름, API 키 형식 등)가 노출될 수 있음.

**수정 방안**: 프로덕션에서는 일반적인 에러 메시지만 반환, 상세 내용은 서버 로그에 기록
```typescript
console.error("GitHub Actions dispatch failed:", errText);
return NextResponse.json(
  { error: "쇼츠 생성 작업을 시작하지 못했습니다." },
  { status: 502 }
);
```

---

## 10. 🟡 MEDIUM — 로그아웃 기능 부재

**위치**: 프로젝트 전체 (Header, NavigationShell 등)

**현황**: 로그인/회원가입은 있으나 로그아웃 UI와 API가 없음. 사용자가 명시적으로 세션을 종료할 수 없음.

**영향**: 공유 기기에서 세션이 유지되어 다른 사용자가 이전 사용자의 계정으로 접근 가능.

**수정 방안**: Header 또는 프로필 페이지에 로그아웃 버튼 추가
```typescript
async function handleLogout() {
  await supabase.auth.signOut();
  router.push("/");
  router.refresh();
}
```

---

## 11. 🟢 LOW — REVALIDATE_SECRET 강도

**위치**: `.env.local`

**현황**: `REVALIDATE_SECRET=msvch-revalidate-2026` — 추측 가능한 패턴

**수정 방안**: `openssl rand -base64 32` 등으로 생성한 무작위 값으로 교체

---

## 12. 🟢 LOW — 공개 API의 인증 없는 데이터 접근

**위치**: `src/app/api/shorts/route.ts`

**현황**: 쇼츠 목록 API가 인증 없이 접근 가능. 아직 발행 전인 쇼츠 데이터(pending, failed 상태)도 조회 가능.

**수정 방안**: 공개 API에서는 `status = 'published'`만 반환하도록 필터, 전체 목록은 인증 필요

---

## 13. 🟢 LOW — localStorage 사용

**위치**: `src/lib/new-content-provider.tsx`

**현황**: 마지막 조회 시점을 localStorage에 저장 (`msvch_seen_notices` 등). 민감 데이터는 아니며 try-catch로 감싸져 있음.

**평가**: 현재 구현은 적절함. 별도 조치 불필요.

---

## 공격 유형별 종합 평가

| 공격 유형 | 현재 상태 | 위험도 | 비고 |
|-----------|----------|--------|------|
| **SQL 인젝션** | ✅ 안전 | 없음 | Supabase SDK가 파라미터화 처리 |
| **XSS (Reflected)** | ✅ 안전 | 없음 | React 자동 이스케이프, dangerouslySetInnerHTML 미사용 |
| **XSS (Stored)** | ✅ 현재 안전 | 낮음 | React 이스케이프로 보호, 단 리치텍스트 도입 시 주의 필요 |
| **CSRF** | ⚠️ 부분 보호 | 낮음 | Supabase 쿠키의 SameSite 속성에 의존 |
| **파일 업로드 공격** | ❌ 취약 | 높음 | 타입/크기 검증 없음 |
| **타이밍 공격** | ❌ 취약 | 중간 | revalidate 시크릿 비교 |
| **DoS/리소스 고갈** | ❌ 취약 | 중간 | rate limiting 없음, 파일 크기 제한 없음 |
| **계정 남용** | ⚠️ 부분 취약 | 중간 | 무제한 회원가입 가능 |
| **정보 노출** | ⚠️ 부분 취약 | 낮음 | 에러 메시지에 내부 정보 포함 |
| **클릭재킹** | ⚠️ 미보호 | 낮음 | X-Frame-Options 미설정 |

---

## 수정 우선순위 (권장 순서)

### Phase 1 — 즉시 (1일)
1. **보안 헤더 추가** (`next.config.ts`에 CSP, X-Frame-Options 등)
2. **파일 업로드 검증** (확장자 화이트리스트 + 파일 크기 제한)
3. **Revalidate 시크릿 교체** (무작위 값) + 타이밍-세이프 비교

### Phase 2 — 이번 주 내
4. **API 입력 검증 강화** (문자열 길이 제한, 배열 크기 제한)
5. **에러 메시지 정리** (내부 정보 제거)
6. **로그아웃 기능 구현**
7. **쇼츠 공개 API 필터링** (published만 반환)

### Phase 3 — 이번 달 내
8. **Rate limiting 도입**
9. **회원가입 보호** (이메일 인증 + CAPTCHA)
10. **CORS 명시적 설정**

---

## 참고: 안전한 영역 (수정 불필요)

| 항목 | 이유 |
|------|------|
| Supabase 클라이언트 패턴 | 서버/브라우저 분리, 쿠키 기반 세션 |
| middleware.ts 인증 로직 | getUser() + role 이중 체크 |
| requireAdmin() 헬퍼 | AuthError 클래스로 일관된 처리 |
| YouTube/Google Maps iframe | 허용된 도메인만 사용, 적절한 allow 속성 |
| localStorage 사용 | 비민감 데이터, try-catch 처리 |
| React 컴포넌트 렌더링 | dangerouslySetInnerHTML 전무, 자동 이스케이프 |
| RLS 정책 | 관리자만 CUD, 일반 사용자는 조회만 |

---
---

# Google Calendar 연동 분석 보고서

> 작성일: 2026-04-13
> 목적: 교회 웹사이트에 Google Calendar를 연동하여 일정 관리 기능을 구현하기 위한 조사
> 범위: 웹 전용 (모바일 앱은 별도)

---

## 1. 현재 일정 관련 현황

### 예배안내 페이지 (`src/app/(public)/worship/page.tsx`)

현재 **모든 예배 시간이 하드코딩**되어 있다:

```typescript
const mainWorship: WorshipInfo[] = [
  { name: "주일예배 1부", time: "오전 8:00", day: "매주 일요일", location: "본당", accent: "..." },
  { name: "주일예배 2부", time: "오전 10:00", day: "매주 일요일", location: "본당", accent: "..." },
  { name: "주일예배 3부", time: "오후 12:00", day: "매주 일요일", location: "본당", accent: "..." },
  { name: "수요기도회",   time: "오후 7:30",  day: "매주 수요일", location: "본당", accent: "..." },
  { name: "금요기도회",   time: "오후 8:00",  day: "매주 금요일", location: "본당", accent: "..." },
  { name: "새벽기도",     time: "오전 5:30",  day: "월~토",      location: "본당", accent: "..." },
];
```

- 교회학교 4개 (영유치부, 아동부, 청소년부, 청년부)
- 특별 모임 3개 (셀예배, 토요전도, 비전문화학교)
- **DB 연동 없음**, 날짜 로직 없음, 정적 텍스트만 렌더링

### 홈페이지 예배 시간 카드 (`src/components/home/WorshipTimeCard.tsx`)

- 4개 예배만 요약 표시 (주일예배, 수요기도, 금요기도, 새벽기도)
- 역시 **하드코딩**된 배열
- `/worship` 페이지로 링크

### 공지사항 (`notices` 테이블)

- `category` 필드: `'일반'`, `'긴급'`, `'행사'`
- `'행사'` 카테고리가 이벤트 역할을 하지만, **시작/종료 시간 없음**, 날짜 1개만 존재
- 현재 캘린더 기능과 연결되지 않음

### 핵심 발견

| 항목 | 현재 상태 |
|------|----------|
| 정기 예배 시간 | 하드코딩 (코드 수정해야 변경 가능) |
| 교회 행사/이벤트 | notices 테이블 `category='행사'`로 관리, 시간 없음 |
| 캘린더 뷰 | 없음 |
| 일정 관리 도구 | 없음 (Supabase + 코드 직접 수정) |

---

## 2. Google Calendar 연동 방식 비교

### 방식 A: Google Calendar API v3 (권장)

공개 캘린더의 이벤트를 API로 읽어와서 커스텀 UI로 렌더링.

**장점**:
- 완전한 UI 커스터마이징 (교회 디자인 시스템과 통합)
- 모바일 반응형 완벽 지원
- 한국어 날짜 포맷 자유롭게 제어
- SSR + ISR 캐싱으로 빠른 로딩
- SEO 친화적 (이벤트 텍스트가 DOM에 존재)
- 향후 모바일 앱에서 동일 API 엔드포인트 재사용

**단점**:
- API 키 필요 (무료)
- 코드 작성 필요

### 방식 B: iframe 임베드

```html
<iframe src="https://calendar.google.com/calendar/embed?src=CALENDAR_ID&ctz=Asia/Seoul&hl=ko&mode=AGENDA" />
```

**장점**: 코드 제로, 즉시 사용 가능

**단점**:
- CSS 커스터마이징 불가 (구글 기본 디자인)
- 모바일 반응형 매우 열악
- 교회 사이트 디자인과 이질적
- SEO 불가 (iframe 내부는 검색엔진에 보이지 않음)
- 이벤트 데이터 접근 불가 (필터링, 가공 불가)
- 일부 광고 차단기에 의해 차단될 수 있음

### 결론: **방식 A (API)** 채택

교회 사이트의 따뜻한 디자인 시스템(church-gold, primary-600 등)에 맞는 커스텀 UI를 만들고, ISR 캐싱으로 빠르게 제공하며, 모바일 앱에서도 같은 API를 재사용한다.

---

## 3. Google Calendar API v3 상세

### 인증 방식

공개 캘린더 + API 키만으로 읽기 가능. **OAuth 불필요**.

```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?key={API_KEY}
```

### 주요 쿼리 파라미터

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| `key` | API 키 (필수) | `AIzaSy...` |
| `timeMin` | 이벤트 검색 시작점 (RFC3339) | `2026-04-13T00:00:00+09:00` |
| `timeMax` | 이벤트 검색 종료점 | `2026-05-13T23:59:59+09:00` |
| `singleEvents` | `true`: 반복 이벤트를 개별 인스턴스로 전개 | `true` |
| `orderBy` | `startTime` (singleEvents=true 필수) | `startTime` |
| `maxResults` | 최대 결과 수 (기본 250) | `30` |
| `timeZone` | 응답 시간대 | `Asia/Seoul` |
| `q` | 자유 텍스트 검색 | `부활절` |

### 응답 구조

```json
{
  "items": [
    {
      "id": "abc123",
      "summary": "부활절 특별예배",
      "description": "부활절을 맞아 특별 예배를 드립니다.",
      "location": "본당",
      "start": {
        "dateTime": "2026-04-19T11:00:00+09:00",
        "timeZone": "Asia/Seoul"
      },
      "end": {
        "dateTime": "2026-04-19T12:30:00+09:00",
        "timeZone": "Asia/Seoul"
      },
      "htmlLink": "https://www.google.com/calendar/event?eid=..."
    }
  ]
}
```

- **종일 이벤트**: `start.date` (`"2026-04-19"`) 사용, `start.dateTime` 없음
- **시간 지정 이벤트**: `start.dateTime` (ISO 8601 + 오프셋) 사용

### 쿼터 및 비용

- **일일 쿼터**: 1,000,000 쿼리/일 (무료)
- **속도 제한**: ~10 req/sec/사용자
- 교회 사이트 규모에서는 ISR 캐싱 적용 시 하루 수백 쿼리 미만으로 충분
- **비용: $0**

### 사전 설정 필요 사항

1. Google Cloud Console에서 프로젝트 생성 (또는 기존 프로젝트 사용)
2. Google Calendar API 활성화
3. API 키 생성 → Google Calendar API만 허용 + HTTP 리퍼러 제한 (msvch.vercel.app)
4. 교회 Google 계정의 캘린더를 **공개**로 설정
5. 캘린더 ID 확인 (캘린더 설정 → "캘린더 통합" → "캘린더 ID")

---

## 4. 기존 코드베이스 패턴 분석

### 외부 API 호출 패턴 (`src/lib/youtube.ts` 참고)

```typescript
const API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const UPLOADS_PLAYLIST_ID = "UUcJc6fm6McCxvpizoe3T4YQ";

export async function getSermonVideos(maxResults = 15): Promise<SermonVideo[]> {
  if (!API_KEY) { console.error("YOUTUBE_API_KEY is not set"); return []; }
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?...`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  // ... 파싱 + 반환
}
```

**동일 패턴 적용 포인트**:
- `process.env`에서 키 읽기 + 빈 값 방어
- `fetch`의 `next.revalidate` 옵션으로 ISR 캐싱
- API 응답을 내부 타입(`SermonVideo`)으로 변환
- 에러 시 빈 배열 반환 (throw 하지 않음)

### API 라우트 패턴 (`src/app/api/sermons/route.ts`)

```typescript
export async function GET() {
  const videos = await getSermonVideos(15);
  return NextResponse.json(videos);
}
```

- 라이브러리 함수 호출 → JSON 응답
- 캐싱은 라이브러리 레벨에서 처리

### 캐싱 전략 참고

| 데이터 | ISR TTL | 위치 |
|-------|---------|------|
| YouTube 설교 | 1800s (30분) | fetch 옵션 |
| 갤러리 앨범 | 3600s (1시간) | route export |
| 새 콘텐츠 날짜 | 600s (10분) | route export |
| **캘린더 이벤트 (제안)** | **600s (10분)** | fetch 옵션 또는 route export |

### CSP 수정 필요

현재 `next.config.ts`의 `connect-src`:
```
connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com
```

추가 필요:
```
https://www.googleapis.com
```

(YouTube API도 `www.googleapis.com`을 사용하는데, 현재 서버 사이드에서만 호출하므로 CSP에 없었다. 캘린더도 서버 사이드 호출이면 CSP 변경 불필요. 클라이언트에서 직접 호출한다면 추가 필요.)

---

## 5. 제안 아키텍처

### 데이터 흐름

```
Google Calendar (공개)
    │
    │  API v3 (API 키)
    ▼
src/lib/google-calendar.ts ── getUpcomingEvents() ── CalendarEvent[]
    │                                                     │
    │  ISR 캐싱 (600s)                                     │
    ▼                                                     ▼
src/app/api/calendar/route.ts          src/app/(public)/calendar/page.tsx
    │                                      (서버 컴포넌트, 직접 호출)
    │  (모바일 앱용)                          │
    ▼                                      ▼
JSON 응답                              커스텀 UI 렌더링
```

### 신규 파일 목록

```
src/
├── lib/
│   └── google-calendar.ts         ← Google Calendar API 래퍼
├── types/
│   └── calendar.ts                ← CalendarEvent 타입
├── app/
│   ├── (public)/
│   │   └── calendar/
│   │       └── page.tsx           ← 캘린더 페이지 (메인 뷰)
│   └── api/
│       └── calendar/
│           └── route.ts           ← API 엔드포인트 (모바일 앱용)
└── components/
    └── calendar/
        ├── EventList.tsx          ← 이벤트 목록 컴포넌트
        └── UpcomingEvents.tsx     ← 홈페이지/사이드바용 위젯
```

### 기존 파일 수정

```
next.config.ts                      ← CSP connect-src 추가 (클라이언트 호출 시)
src/components/layout/nav-config.ts  ← "교회일정" 메뉴 항목 추가
src/app/(public)/menu/MenuContent.tsx ← 더보기 메뉴에 "교회일정" 추가
src/app/page.tsx                     ← 홈에 다가오는 일정 위젯 추가 (선택)
```

---

## 6. 타입 설계

### `src/types/calendar.ts`

```typescript
/** Google Calendar API 이벤트를 앱 내부 타입으로 변환한 결과 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;        // ISO 8601 (시간 지정 이벤트) 또는 YYYY-MM-DD (종일 이벤트)
  end: string;          // 동일
  isAllDay: boolean;    // start.date 존재 여부로 결정
  htmlLink: string;     // Google Calendar에서 보기 링크
}
```

---

## 7. API 래퍼 설계

### `src/lib/google-calendar.ts`

```typescript
import type { CalendarEvent } from "@/types/calendar";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "";
const API_KEY = process.env.GOOGLE_CALENDAR_API_KEY ?? "";

/** Google Calendar API 원본 응답 타입 (내부용) */
interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink: string;
}

interface GCalResponse {
  items: GCalEvent[];
  summary: string;
  timeZone: string;
}

function toCalendarEvent(e: GCalEvent): CalendarEvent {
  const isAllDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary,
    description: e.description ?? null,
    location: e.location ?? null,
    start: e.start.dateTime ?? e.start.date ?? "",
    end: e.end.dateTime ?? e.end.date ?? "",
    isAllDay,
    htmlLink: e.htmlLink,
  };
}

/**
 * 다가오는 이벤트를 가져온다.
 * @param maxResults 최대 결과 수 (기본 20)
 * @param daysAhead 오늘부터 며칠 후까지 (기본 60)
 */
export async function getUpcomingEvents(
  maxResults = 20,
  daysAhead = 60,
): Promise<CalendarEvent[]> {
  if (!CALENDAR_ID || !API_KEY) {
    console.error("GOOGLE_CALENDAR_ID or GOOGLE_CALENDAR_API_KEY is not set");
    return [];
  }

  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
  );
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", future.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("timeZone", "Asia/Seoul");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.error("Google Calendar API error:", res.status);
      return [];
    }
    const data: GCalResponse = await res.json();
    return (data.items ?? []).map(toCalendarEvent);
  } catch (err) {
    console.error("Google Calendar fetch failed:", err);
    return [];
  }
}
```

**패턴 일관성**: youtube.ts와 동일한 구조 (환경변수 → 빈 값 방어 → fetch + ISR → 타입 변환 → 에러 시 빈 배열)

---

## 8. 날짜/시간 포맷팅

### 한국어 이벤트 시간 표시

```typescript
/** 이벤트 시간을 한국어로 포맷 */
export function formatEventDateTime(start: string, isAllDay: boolean): string {
  if (isAllDay) {
    // "2026-04-19" → "4월 19일"
    const [, m, d] = start.split("-").map(Number);
    return `${m}월 ${d}일`;
  }
  // "2026-04-19T11:00:00+09:00" → "4월 19일 (일) 오전 11:00"
  const dt = new Date(start);
  return dt.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

/** 이벤트 날짜 범위 ("4월 19일 오전 11:00 ~ 오후 12:30") */
export function formatEventRange(
  start: string,
  end: string,
  isAllDay: boolean,
): string {
  if (isAllDay) {
    if (start === end) return formatEventDateTime(start, true);
    return `${formatEventDateTime(start, true)} ~ ${formatEventDateTime(end, true)}`;
  }
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const startTime = s.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  const endTime = e.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  return `${dateStr} ${startTime} ~ ${endTime}`;
}
```

---

## 9. 페이지/컴포넌트 설계

### 캘린더 페이지 (`/calendar`)

```
┌──────────────────────────────────────────────────┐
│ 교회 일정                                         │
│ 명성비전교회 주요 일정을 확인하세요                   │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 4월 19일 (일) ──────────────────────────────┐ │
│  │ 🟡 부활절 특별예배                             │ │
│  │    오전 11:00 ~ 오후 12:30                    │ │
│  │    📍 본당                                    │ │
│  │    부활절을 맞아 특별 예배를 드립니다...         │ │
│  │                          [Google Calendar →]  │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ 4월 26일 (일) ──────────────────────────────┐ │
│  │    교회학교 학부모 간담회                       │ │
│  │    오후 1:00 ~ 오후 2:00                      │ │
│  │    📍 교육관 3층                               │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ... (향후 60일 이내 이벤트)                       │
│                                                  │
│  일정이 없습니다. (이벤트 0개일 때)                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

- ISR 서버 컴포넌트 (`revalidate = 600`)
- `getUpcomingEvents()`로 다가오는 이벤트 목록 렌더링
- 각 이벤트 카드에 Google Calendar 링크 포함
- 이벤트 0개: "예정된 일정이 없습니다" 안내

### 홈페이지 위젯 (선택)

```
┌─ 다가오는 일정 ──────────────────────┐
│ 🟡 부활절 특별예배    4/19 오전 11:00 │
│    교회학교 간담회     4/26 오후 1:00  │
│    ...                               │
│              [전체 일정 보기 →]        │
└──────────────────────────────────────┘
```

- 홈페이지(`page.tsx`)에 최대 3개 이벤트만 표시
- "전체 일정 보기" → `/calendar` 링크

---

## 10. 네비게이션 변경

### nav-config.ts

"교회소개" 하위에 "교회일정" 추가:
```typescript
{
  label: "교회소개",
  href: "/greetings",
  children: [
    { label: "공지사항", href: "/notice", badgeKey: "notices" as const },
    { label: "예배안내", href: "/worship" },
    { label: "교회일정", href: "/calendar" },      // ← 신규
    { label: "찾아오시는 길", href: "/map" },
    // ...
  ],
}
```

### 더보기 메뉴 (`MenuContent.tsx`)

"소식" 섹션에 "교회일정" 추가.

---

## 11. 환경변수

```env
# .env.local
GOOGLE_CALENDAR_ID=교회계정@gmail.com        # 또는 ...@group.calendar.google.com
GOOGLE_CALENDAR_API_KEY=AIzaSy...            # Google Cloud Console에서 생성
```

Vercel 환경변수 + GitHub Actions secrets에도 동일 추가.

**기존 Google 관련 키와의 관계**:
- `YOUTUBE_API_KEY` — YouTube Data API v3 전용
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Maps Embed API 전용 (public)
- `GOOGLE_CALENDAR_API_KEY` — Calendar API v3 전용 (server-only)

같은 Google Cloud 프로젝트의 API 키를 공유할 수도 있지만, **API별로 분리된 키**를 권장한다 (키 제한 설정이 각기 다르므로).

---

## 12. API 엔드포인트 설계 (모바일 앱 호환)

### GET `/api/calendar`

모바일 앱에서 동일 데이터를 사용할 수 있도록 API 라우트 제공.

```typescript
// src/app/api/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUpcomingEvents } from "@/lib/google-calendar";
import { parseLimit } from "@/lib/validation";

export const revalidate = 600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = parseLimit(searchParams.get("limit"), 20);
  const daysAhead = Math.min(
    parseInt(searchParams.get("days") ?? "60", 10) || 60,
    365,
  );

  const events = await getUpcomingEvents(limit, daysAhead);
  return NextResponse.json(events);
}
```

**사용 예시**:
```
GET /api/calendar                          → 향후 60일, 최대 20개
GET /api/calendar?limit=5&days=7           → 이번 주, 최대 5개
GET /api/calendar?days=30                  → 이번 달
```

---

## 13. 비용

| 항목 | 비용 |
|------|------|
| Google Calendar API | $0 (1M 쿼리/일 무료) |
| Google Cloud 프로젝트 | $0 |
| API 키 | $0 |
| 추가 npm 의존성 | 없음 (raw fetch 사용) |
| **합계** | **$0** |

---

## 14. 구현 순서 (제안)

```
Step 1:  Google Cloud Console 설정 (API 활성화, 키 생성)
Step 2:  교회 Google 캘린더 공개 설정 + 캘린더 ID 확인
Step 3:  환경변수 추가 (.env.local, Vercel)
Step 4:  src/types/calendar.ts 타입 정의
Step 5:  src/lib/google-calendar.ts API 래퍼
Step 6:  src/app/api/calendar/route.ts API 엔드포인트
Step 7:  src/app/(public)/calendar/page.tsx 캘린더 페이지
Step 8:  src/components/calendar/EventList.tsx 이벤트 목록
Step 9:  nav-config.ts + MenuContent.tsx 메뉴 추가
Step 10: (선택) 홈페이지에 다가오는 일정 위젯 추가
Step 11: CSP 업데이트 (필요 시)
Step 12: Vercel 배포 + 실제 캘린더 데이터로 테스트
```

**Step 1, 2, 3은 수동 작업** (Google Cloud Console + 교회 계정 설정).
Step 4~11은 코드 구현.

---

## 15. 위험 & 대응

| 위험 | 대응 |
|------|------|
| 캘린더 비공개 설정 | 공개 캘린더 필수 — 설정 미스 시 API가 403 반환 → 빈 목록 표시 |
| API 키 누출 | 서버 사이드에서만 호출, `NEXT_PUBLIC_` 접두사 사용하지 않음 |
| Google API 장애 | 에러 시 빈 배열 반환 + ISR 캐싱으로 10분간 이전 데이터 유지 |
| 이벤트 없는 기간 | "예정된 일정이 없습니다" 안내 문구 표시 |
| 반복 이벤트 폭발 | `singleEvents=true` + `maxResults=30` + `timeMax=60일`로 제한 |
| 시간대 혼동 | 모든 API 호출에 `timeZone=Asia/Seoul` 명시 |

---

## 16. 기존 코드 재사용 매핑

| 기존 자산 | 위치 | 캘린더 용도 |
|-----------|------|-----------|
| `parseLimit()` | lib/validation.ts | API 라우트 limit 파라미터 |
| `formatDate()` | lib/utils.ts | 종일 이벤트 날짜 표시 (참고) |
| `formatDateKorean()` | lib/utils.ts | 한국어 날짜 표시 (참고) |
| youtube.ts fetch 패턴 | lib/youtube.ts | API 래퍼 구조 그대로 복제 |
| `Container`, `PageHeader` | components/ui/ | 캘린더 페이지 레이아웃 |
| `Card` | components/ui/Card.tsx | 이벤트 카드 래퍼 |
| ISR 패턴 | api/sermons/route.ts | API 라우트 캐싱 |
| 디자인 토큰 | globals.css | church-gold(이벤트 강조), primary-600(링크) |
