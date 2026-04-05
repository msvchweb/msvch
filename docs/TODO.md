# 명성비전교회 홈페이지 — 배포 전 할 일 목록

> 코드 구현은 완료되었습니다. 아래는 **실제 서비스 오픈을 위해 직접 수행해야 하는 작업**입니다.
> 각 단계를 순서대로 진행하세요.

---

## 1단계: 외부 서비스 계정 생성 및 API 키 발급

### 1-1. Notion 설정

Notion이 CMS(콘텐츠 관리 시스템) 역할을 합니다. 공지사항, 주보, 갤러리를 Notion에서 관리하면 홈페이지에 자동 반영됩니다.

#### 1) Notion Integration(통합) 생성

1. https://www.notion.so/my-integrations 접속
2. `+ 새 통합 만들기` 클릭
3. 이름: `msvch-website` 입력
4. 유형: `내부 통합` 선택
5. 기능: `콘텐츠 읽기` 활성화
6. `제출` 후 **시크릿 키** 복사 (예: `secret_abc123...`)

#### 2) Notion 데이터베이스 3개 생성

**공지사항 DB** — Notion에서 새 페이지 > 데이터베이스(전체 페이지) 생성

| 속성 이름 | 속성 타입 | 설명 |
|-----------|-----------|------|
| 제목 | Title (기본) | 공지 제목 |
| 슬러그 | Text | URL 경로 (예: `easter-2026`) |
| 카테고리 | Select | 옵션: `일반`, `긴급`, `행사` |
| 공개 | Checkbox | 체크하면 홈페이지에 표시 |
| 날짜 | Date | 게시일 |

**주보 DB** — 동일 방식으로 생성

| 속성 이름 | 속성 타입 | 설명 |
|-----------|-----------|------|
| 제목 | Title (기본) | 예: "2026년 4월 첫째주 주보" |
| 날짜 | Date | 해당 주일 날짜 |
| PDF | Files & media | 주보 PDF 파일 업로드 |

**갤러리 DB** — 동일 방식으로 생성

| 속성 이름 | 속성 타입 | 설명 |
|-----------|-----------|------|
| 제목 | Title (기본) | 앨범명 (예: "2026 부활절") |
| 카테고리 | Select | 옵션: `예배`, `교회학교`, `교회행사`, `봉사센터`, `새가족` |
| 날짜 | Date | 행사 날짜 |
| 대표이미지 | Files & media | 썸네일 1장 |
| 이미지들 | Files & media | 전체 사진 (여러 장) |
| 공개 | Checkbox | 체크하면 홈페이지에 표시 |

#### 3) 각 DB에 통합 연결

각 데이터베이스 페이지에서:
1. 우측 상단 `···` 클릭
2. `연결` > `msvch-website` 선택

#### 4) 데이터베이스 ID 확인

Notion 데이터베이스 URL 구조:
```
https://www.notion.so/워크스페이스/DATABASE_ID?v=xxx
```
`DATABASE_ID` 부분 (32자리 영숫자)을 복사합니다.

#### 5) `.env.local` 업데이트

```env
NOTION_API_KEY=secret_여기에_실제_키_입력
NOTION_NOTICE_DB_ID=공지사항_DB_ID
NOTION_WEEKLY_DB_ID=주보_DB_ID
NOTION_GALLERY_DB_ID=갤러리_DB_ID
```

---

### 1-2. Supabase 설정

Supabase가 회원 관리, 로그인, 그룹 토론 기능을 담당합니다.

#### 1) 프로젝트 생성

1. https://supabase.com 접속, 회원가입/로그인
2. `New Project` 클릭
3. 프로젝트 이름: `msvch`
4. 데이터베이스 비밀번호 설정 (안전하게 보관)
5. 리전: `Northeast Asia (Tokyo)` 선택 (한국에서 가장 가까움)

#### 2) 데이터베이스 테이블 생성

1. Supabase 대시보드 > `SQL Editor` 이동
2. `supabase/migrations/001_initial.sql` 파일 내용을 전체 복사-붙여넣기
3. `Run` 실행
4. Tables 메뉴에서 `profiles`, `groups`, `group_posts` 3개 테이블 확인

#### 3) 인증 설정

1. `Authentication` > `Providers` 이동
2. `Email` 활성화 확인
3. (선택) `Confirm email` 비활성화하면 이메일 인증 없이 바로 가입 가능

#### 4) API 키 확인

`Settings` > `API` 에서:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 프론트엔드에 노출 금지)

#### 5) `.env.local` 업데이트

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

#### 6) 관리자 계정 만들기

1. 홈페이지에서 회원가입 진행
2. Supabase 대시보드 > `Table Editor` > `profiles` 테이블
3. 해당 사용자의 `role`을 `member` → `admin`으로 수정

---

### 1-3. YouTube 연동

설교 영상을 자동으로 불러오는 기능입니다.

#### 1) YouTube Data API 활성화

1. https://console.cloud.google.com 접속
2. 프로젝트 생성 (예: `msvch-website`)
3. `API 및 서비스` > `라이브러리` > `YouTube Data API v3` 검색 > `사용` 클릭
4. `사용자 인증 정보` > `사용자 인증 정보 만들기` > `API 키` 생성
5. (보안) API 키 제한: `YouTube Data API v3`만 허용

#### 2) 교회 채널 ID 확인

1. 교회 YouTube 채널 페이지 접속
2. URL에서 채널 ID 확인: `youtube.com/channel/UCxxxxxxx`
3. 또는 https://www.youtube.com/@채널명 → 페이지 소스에서 `channelId` 검색

#### 3) `.env.local` 업데이트

```env
YOUTUBE_API_KEY=AIza...
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxx
```

---

### 1-4. Google Maps 설정

오시는 길 페이지에 지도를 표시합니다.

#### 1) Maps Embed API 활성화

1. Google Cloud Console > `API 및 서비스` > `라이브러리`
2. `Maps Embed API` 검색 > `사용` 클릭
3. 기존 API 키 사용 또는 새로 생성

#### 2) `.env.local` 업데이트

```env
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
```

> 참고: Maps Embed API는 무료입니다 (사용량 제한 없음).

---

### 1-5. ISR 재검증 시크릿

Notion에서 콘텐츠 변경 시 수동으로 캐시를 갱신하는 API 키입니다.

```bash
# 랜덤 키 생성 (터미널에서 실행)
openssl rand -hex 32
```

```env
REVALIDATE_SECRET=생성된_랜덤_키
```

재검증 호출 방법 (콘텐츠 변경 후):
```bash
curl -X POST https://www.msvch.org/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{"secret":"위에서_설정한_키","paths":["/notice","/weekly","/gallery","/"]}'
```

---

## 2단계: 교회 실제 정보 입력

아래 파일에서 플레이스홀더를 실제 정보로 교체하세요.

### 2-1. 교회 기본 정보

**수정 파일: `src/components/layout/Footer.tsx`**
```
- "서울특별시 동작구" → 실제 전체 주소
- "02-XXX-XXXX" → 실제 전화번호
- "info@msvch.org" → 실제 이메일 (없으면 그대로)
- 예배 시간 확인 및 수정
```

**수정 파일: `src/app/(public)/map/page.tsx`**
```
- const CHURCH_ADDRESS = "서울특별시 동작구" → 실제 전체 주소
- "02-XXX-XXXX" → 실제 전화번호
- 버스/지하철 정보 입력 (정류장명, 역명, 노선번호)
```

### 2-2. 인사말

**수정 파일: `src/app/(public)/greetings/page.tsx`**
```
- "담임목사" → 실제 목사님 성함
- 인사말 본문 교체
- 목사님 사진: public/images/ 에 저장 후 경로 연결
```

### 2-3. 예배 시간

아래 3개 파일에서 예배 시간을 실제 시간표로 수정:

- `src/components/home/WorshipTimeCard.tsx` — 홈페이지 예배 시간 카드
- `src/app/(public)/worship/page.tsx` — 예배 안내 페이지
- `src/app/(public)/timetable/page.tsx` — 시간표 페이지
- `src/components/layout/Footer.tsx` — 하단 예배 시간

### 2-4. 교회학교 정보

**수정 파일: `src/app/(public)/churchschool/[department]/page.tsx`**
```
- 각 부서(유아/초등/청소년/청년) 담당 교역자 이름
- 정확한 예배 시간
- 주요 프로그램 목록
```

### 2-5. 문화사역 정보

**수정 파일: `src/app/(public)/ministry/[slug]/page.tsx`**
```
- 미용봉사, 탁구, 반찬사역 정확한 일정
- 상세 설명
```

---

## 3단계: 이미지 준비

`public/images/` 폴더에 아래 이미지를 넣으세요:

| 파일명 (권장) | 용도 | 권장 사이즈 |
|---------------|------|-------------|
| `hero-church.jpg` | 홈페이지 히어로 배경 (현재는 그라데이션) | 1920x1080 |
| `pastor.jpg` | 담임목사 프로필 사진 | 400x500 |
| `og-default.jpg` | SNS 공유 시 기본 이미지 | 1200x630 |

> 이미지를 넣은 후 `HeroSection.tsx`에서 배경을 이미지로 교체할 수 있습니다.

---

## 4단계: 로컬 테스트

모든 설정이 완료되면 로컬에서 테스트합니다.

```bash
# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속 후 확인:

- [ ] 홈페이지 정상 표시
- [ ] 공지사항에 Notion 데이터 표시 확인
- [ ] 갤러리에 Notion 데이터 표시 확인
- [ ] 주보에 Notion 데이터 표시 확인
- [ ] 설교 영상에 YouTube 영상 표시 확인
- [ ] 오시는 길 지도 표시 확인
- [ ] 회원가입 → 로그인 정상 동작
- [ ] 그룹 토론 글쓰기 정상 동작
- [ ] 모바일 반응형 확인 (브라우저 폭 줄여서 확인)
- [ ] 관리자 대시보드 접속 확인 (/admin)

```bash
# 프로덕션 빌드 테스트
npm run build && npm start
```

---

## 5단계: Git 저장소 및 배포

### 5-1. GitHub 저장소 생성

```bash
# Git 초기화 (이미 되어있으면 생략)
git init
git add .
git commit -m "Initial commit: 명성비전교회 홈페이지"

# GitHub에 저장소 생성 후
git remote add origin https://github.com/사용자명/msvch.git
git push -u origin main
```

> `.env.local`은 `.gitignore`에 포함되어 있어 자동으로 제외됩니다.

### 5-2. Cloudflare Pages 배포

#### 방법 A: Cloudflare 대시보드에서 직접 연결 (추천)

1. https://dash.cloudflare.com 접속, 계정 생성
2. `Workers & Pages` > `Pages` > `Connect to Git`
3. GitHub 저장소 연결
4. 빌드 설정:
   - 빌드 명령: `npm run build`
   - 출력 디렉토리: `.next`
   - 프레임워크 프리셋: `Next.js`
5. `Environment Variables` 에 `.env.local`의 모든 변수 추가
6. `Save and Deploy` 클릭

#### 방법 B: GitHub Actions 자동 배포

이미 `.github/workflows/deploy.yml`이 작성되어 있습니다.

GitHub 저장소 > `Settings` > `Secrets and variables` > `Actions`에 추가:
- `CLOUDFLARE_API_TOKEN` — Cloudflare API 토큰
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 계정 ID

Cloudflare API 토큰 생성:
1. Cloudflare 대시보드 > `My Profile` > `API Tokens`
2. `Create Token` > `Cloudflare Pages 편집` 템플릿 사용

---

## 6단계: 도메인 연결 (msvch.org)

### 6-1. Cloudflare에 도메인 추가

1. Cloudflare 대시보드 > `Add a site` > `msvch.org` 입력
2. Free 플랜 선택
3. Cloudflare가 제공하는 **네임서버 2개** 메모:
   ```
   예: ada.ns.cloudflare.com
       bob.ns.cloudflare.com
   ```

### 6-2. 도메인 레지스트라에서 네임서버 변경

현재 도메인을 관리하는 곳(가비아, 카페24, GoDaddy 등)에서:

1. 도메인 관리 > 네임서버 설정
2. 기존 Wix 네임서버 → Cloudflare 네임서버로 변경
3. 저장

> DNS 전파에 24~48시간 소요될 수 있습니다.

### 6-3. Cloudflare Pages에 커스텀 도메인 연결

1. Cloudflare Pages > 프로젝트 > `Custom domains`
2. `www.msvch.org` 추가
3. `msvch.org` 추가 (www 없는 버전도)
4. HTTPS 자동 발급 확인

### 6-4. DNS 전파 확인

```bash
# 네임서버 확인
nslookup -type=NS msvch.org

# 사이트 접속 확인
curl -I https://www.msvch.org
```

---

## 7단계: Wix 콘텐츠 마이그레이션

기존 Wix 사이트의 콘텐츠를 새 홈페이지로 옮깁니다.

### 7-1. 블로그/소식 이전

1. Wix 대시보드에서 블로그 글 목록 확인
2. 중요한 게시물을 Notion 공지사항 DB에 새로 작성
3. 이미지는 Notion에 직접 업로드

### 7-2. 갤러리 이전

1. Wix 갤러리에서 사진 다운로드
2. Notion 갤러리 DB에 앨범 단위로 업로드

### 7-3. 주보 이전

1. 기존 주보 PDF가 있으면 Notion 주보 DB에 업로드

---

## 8단계: 운영 가이드

### 공지사항 작성 방법

1. Notion 공지사항 DB에서 `+ 새 항목` 클릭
2. 제목, 슬러그(영문 URL), 카테고리, 날짜 입력
3. 본문은 Notion 페이지 안에 작성 (마크다운 자동 변환)
4. `공개` 체크박스 선택
5. 최대 1시간 후 홈페이지에 자동 반영 (즉시 반영하려면 재검증 API 호출)

### 갤러리 업로드 방법

1. Notion 갤러리 DB에서 `+ 새 항목` 클릭
2. 제목, 카테고리, 날짜 입력
3. `대표이미지`에 썸네일 1장 업로드
4. `이미지들`에 전체 사진 업로드 (여러 장 가능)
5. `공개` 체크박스 선택

### 주보 업로드 방법

1. Notion 주보 DB에서 `+ 새 항목` 클릭
2. 제목 (예: "2026년 4월 둘째주 주보"), 날짜 입력
3. `PDF`에 주보 파일 업로드

### 즉시 캐시 갱신

콘텐츠 변경 후 바로 반영하고 싶을 때:
```bash
curl -X POST https://www.msvch.org/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{"secret":"설정한_시크릿","paths":["/","/notice","/weekly","/gallery"]}'
```

---

## 체크리스트 요약

| # | 작업 | 완료 |
|---|------|------|
| 1 | Notion Integration 생성 + API 키 발급 | ⬜ |
| 2 | Notion 공지사항 DB 생성 + 속성 설정 | ⬜ |
| 3 | Notion 주보 DB 생성 + 속성 설정 | ⬜ |
| 4 | Notion 갤러리 DB 생성 + 속성 설정 | ⬜ |
| 5 | 각 DB에 Integration 연결 | ⬜ |
| 6 | Supabase 프로젝트 생성 | ⬜ |
| 7 | Supabase SQL 마이그레이션 실행 | ⬜ |
| 8 | YouTube Data API 활성화 + 키 발급 | ⬜ |
| 9 | 교회 YouTube 채널 ID 확인 | ⬜ |
| 10 | Google Maps Embed API 활성화 | ⬜ |
| 11 | `.env.local` 모든 환경변수 실제 값으로 교체 | ⬜ |
| 12 | 교회 실제 주소/전화번호/이메일 입력 | ⬜ |
| 13 | 담임목사 성함 및 인사말 입력 | ⬜ |
| 14 | 예배 시간 정확하게 수정 | ⬜ |
| 15 | 교회학교 부서별 담당자/시간 수정 | ⬜ |
| 16 | 문화사역 정확한 일정 수정 | ⬜ |
| 17 | 교회 이미지 준비 (히어로, 목사님 사진) | ⬜ |
| 18 | `npm run dev`로 로컬 테스트 | ⬜ |
| 19 | `npm run build`로 빌드 확인 | ⬜ |
| 20 | GitHub 저장소 생성 + push | ⬜ |
| 21 | Cloudflare Pages 프로젝트 생성 + 배포 | ⬜ |
| 22 | Cloudflare에 환경변수 등록 | ⬜ |
| 23 | 도메인 네임서버 Cloudflare로 변경 | ⬜ |
| 24 | 커스텀 도메인 (www.msvch.org) 연결 | ⬜ |
| 25 | Supabase에서 관리자 계정 role을 admin으로 변경 | ⬜ |
| 26 | 기존 Wix 콘텐츠 → Notion으로 마이그레이션 | ⬜ |
| 27 | 모바일/PC 전체 페이지 최종 확인 | ⬜ |
