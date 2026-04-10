# 설교 영상 → 쇼츠/릴스 자동화 전략

## 1. 목표와 범위

### 1.1 목표
명성비전교회 유튜브 채널의 **장편 설교 영상**(40~80분)에서 임팩트 있는 **30~60초 구간**을 자동으로 추출하고, **유튜브 쇼츠**와 **인스타그램 릴스**에 동시 자동 업로드한다.

### 1.2 핵심 가치
- **도달 확장**: 짧은 포맷이 알고리즘 노출에 유리 → 새 신자/청년층 접근
- **운영 부담 제로**: 교역자/관리자의 추가 작업 없이, 새 설교가 올라오면 자동으로 쇼츠 5개 생성
- **신학적 안전성**: 사람 검수 게이트를 거친 후 발행 (자동 발행은 옵션)

### 1.3 비목표 (Phase 1에서 제외)
- 다국어 자막
- 화자 추적 자동 카메라 워크 (강대상 고정 촬영이 대부분이므로 center crop으로 충분)
- 배경 음악 삽입 (설교 메시지 보존)
- 썸네일 자동 생성 (Phase 2)

---

## 2. 파이프라인 개요

```
[YouTube 설교 업로드 감지]
        │
        ▼
[1] 영상 다운로드 (yt-dlp)
        │
        ▼
[2] 음성 추출 + STT (Whisper, 타임스탬프 포함)
        │
        ▼
[3] 하이라이트 선정 (Gemini/Claude — 5개 구간 + 제목/이유)
        │
        ▼
[4] 영상 편집 (FFmpeg)
        │   ├─ 구간 컷
        │   ├─ 9:16 크롭
        │   └─ 자막 번인
        ▼
[5] 메타데이터 생성 (LLM — 제목/설명/해시태그)
        │
        ▼
[6] 사람 검수 게이트 (Admin UI에서 승인/반려)
        │
        ├──→ [7a] YouTube Data API → Shorts 업로드
        └──→ [7b] Instagram Graph API → Reels 업로드
        │
        ▼
[8] 결과 로그 + 분석 (Supabase)
```

---

## 3. 단계별 기술 선택

### 3.1 영상 다운로드 — `yt-dlp`
- **선택 이유**: youtube-dl 후속, 가장 안정적. CLI/Python 모두 사용 가능
- **명령 예시**:
  ```bash
  yt-dlp -f "bv*[height<=1080]+ba/b[height<=1080]" \
         --merge-output-format mp4 \
         -o "sermon_%(id)s.mp4" \
         "https://youtube.com/watch?v=XXX"
  ```
- **저장 위치**: 워커 머신의 임시 디렉토리. 처리 후 삭제. (Supabase Storage에 둘 필요 없음 — 비용 낭비)
- **저작권**: **본 교회 채널 영상에만 적용**. 외부 설교자 영상은 제외 정책 명시

### 3.2 STT — Whisper

| 옵션 | 비용 | 장단점 |
|------|------|--------|
| OpenAI Whisper API | $0.006/분 (60분 = $0.36) | 가장 간단, 운영 부담 0 |
| faster-whisper (self-host) | 무료 (GPU 필요) | 비용 0이지만 인프라 필요 |
| Google Speech-to-Text | 분당 $0.024 | 비쌈 |

**권장**: Phase 1은 **OpenAI Whisper API**.
- 모델: `whisper-1` (한국어 인식률 충분)
- 응답 형식: `verbose_json` + `timestamp_granularities=["word", "segment"]`
- 출력: 단어 단위 타임스탬프 → 자막 정확도와 컷 경계 정밀도 모두 확보

### 3.3 하이라이트 선정 — Gemini / Claude

**핵심 어려움**: 단순 키워드가 아니라 "교인의 마음에 와닿는 구간"을 골라야 함.

**프롬프트 전략**:
```
당신은 교회 설교 편집자입니다.
아래는 [제목]의 한국어 설교 트랜스크립트입니다 (segment 단위).

다음 조건을 만족하는 30~55초 구간 5개를 골라주세요:
- 한 가지 완결된 메시지를 담고 있을 것
- 문장이 잘리지 않을 것 (segment 경계 준수)
- 감정적 호소·핵심 적용·인상 깊은 비유·도전적 권면 중 하나에 해당
- 비신자에게도 이해 가능할 것 (내부 용어/상황 의존 X)
- 5개는 서로 주제가 겹치지 않을 것

JSON으로만 응답:
{
  "highlights": [
    {
      "start_sec": 412.3,
      "end_sec": 458.7,
      "title": "...(20자 이내)",
      "hook": "...(쇼츠 첫 3초용 한 줄)",
      "reason": "...(왜 골랐는지 1문장)"
    }
  ]
}
```

**모델**: 기존 `gemini-2.5-flash` 재사용 (이미 `src/lib/gemini.ts:14`에서 사용 중). 컨텍스트 윈도우 충분, 한국어 추론 양호.

**검증 로직**: LLM이 반환한 timestamp가 실제 segment 경계와 어긋날 수 있음 → 가장 가까운 segment의 시작/끝으로 **스냅** 처리.

### 3.4 영상 편집 — FFmpeg

**a. 구간 컷 + 9:16 크롭**
```bash
ffmpeg -ss 412.3 -to 458.7 -i sermon.mp4 \
  -vf "crop=ih*9/16:ih,scale=1080:1920" \
  -c:v libx264 -preset medium -crf 20 \
  -c:a aac -b:a 128k \
  short_01.mp4
```
- `crop=ih*9/16:ih`: 원본 높이 기준 가운데 세로 크롭 (1920x1080 → 608x1080)
- `scale=1080:1920`: 쇼츠 표준 해상도로 업스케일

**b. 자막 번인** (ASS 파일을 동적 생성)
```bash
ffmpeg -i short_01.mp4 \
  -vf "ass=short_01.ass" \
  -c:a copy short_01_final.mp4
```
- ASS 포맷 사용 이유: 글자 크기/외곽선/위치/한국어 폰트(Pretendard) 정밀 제어
- 단어 단위 타임스탬프로 **2~3 단어씩 묶어** 화면 중앙 하단에 표시
- 가독성: 흰 글자 + 검은 외곽선 4px, 폰트 크기 60~72px

**c. 인트로/아웃로 카드**: Phase 2에서 검토 (브랜딩 일관성용)

### 3.5 메타데이터 생성 — LLM
같은 LLM 호출에 묶거나 별도 호출. 출력:
- **유튜브 제목**: 60자 이내, 끝에 `#Shorts` 필수
- **유튜브 설명**: 본문 요약 + 원본 설교 링크 + 해시태그 5개
- **인스타 캡션**: 2200자 이내, 해시태그 최대 30개 (`#설교 #말씀 #하나님 #기독교 #쇼츠 #릴스 #명성비전교회 ...`)

### 3.6 사람 검수 게이트 — Admin UI
**중요**: 자동 발행은 위험하다. 짧게 자르면 본문 맥락이 빠질 수 있고, 정치/사회 발언이 잘못 잘릴 위험.

**Admin 화면 추가**: `/admin/shorts`
- 생성된 쇼츠 후보 리스트 (썸네일 + 미리보기 + 자막 텍스트)
- 각 카드: **승인 / 재생성 / 반려** 버튼
- 승인 시 → 발행 큐로 이동
- 반려 사유 메모 → 다음 LLM 프롬프트 개선에 활용 (선택)

---

## 4. 업로드 API

### 4.1 YouTube Shorts (YouTube Data API v3)

**요구사항**:
- Google Cloud 프로젝트 + OAuth 2.0 클라이언트
- 채널 소유 계정으로 1회 인증 → **refresh token** 저장 (Supabase 암호화)
- 스코프: `https://www.googleapis.com/auth/youtube.upload`

**업로드 호출**: `videos.insert` (resumable upload)
- `snippet.title`: 제목 + ` #Shorts`
- `snippet.description`: 본문 + 해시태그
- `snippet.categoryId`: `29` (Nonprofits & Activism) 또는 `22` (People & Blogs)
- `status.privacyStatus`: `private` → 검수 후 `public`으로 전환 (이중 안전장치)
- 영상 자체가 **9:16 + 60초 이하**면 자동으로 쇼츠로 분류됨

**쿼터 주의**:
- `videos.insert` = **1,600 units**
- 일일 무료 쿼터 = **10,000 units** → **하루 6개 업로드가 한계**
- Google에 쿼터 증액 요청 가능 (교회/비영리 사유 명시)

### 4.2 Instagram Reels (Instagram Graph API)

**요구사항**:
- Facebook Developer 앱
- **Instagram Business 계정** (개인 계정 X) + Facebook 페이지 연결
- 장기 액세스 토큰 (60일, 자동 갱신 로직 필요)
- 스코프: `instagram_business_basic`, `instagram_business_content_publish`

**업로드 절차** (2단계):
```
1) POST /{ig-user-id}/media
   {
     "media_type": "REELS",
     "video_url": "https://<공개 URL>/short_01.mp4",
     "caption": "..."
   }
   → container_id 반환

2) GET /{container_id}?fields=status_code
   → "FINISHED"가 될 때까지 폴링 (수십 초~수 분)

3) POST /{ig-user-id}/media_publish
   { "creation_id": container_id }
```

**핵심 제약**:
- `video_url`은 **외부에서 접근 가능한 URL**이어야 함 → Supabase Storage 공개 버킷에 임시 업로드 후 발행 완료되면 삭제
- 일일 발행 제한: **50개/24h** (충분)
- 영상 스펙: 9:16, 길이 ≤ 90초 권장 (우리는 60초)

### 4.3 토큰/시크릿 관리
- 모두 Supabase의 **암호화된 테이블** 또는 환경변수
- 신규 환경변수:
  - `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
  - `IG_APP_ID`, `IG_APP_SECRET`, `IG_LONG_LIVED_TOKEN`, `IG_USER_ID`
  - `OPENAI_API_KEY` (Whisper용)

---

## 5. 실행 환경 — GitHub Actions (확정)

### 5.1 결정
파이프라인은 **장시간(5~15분) + 무거운 CPU(FFmpeg)** 작업이라 Cloudflare/Vercel 함수의 60초 한도 안에서는 절대 돌릴 수 없다. 후보(로컬 워커 / GitHub Actions / Cloud Run / Trigger.dev)를 비교한 결과 **Phase 1부터 GitHub Actions에서 직접 개발**하기로 확정한다.

### 5.2 GitHub Actions를 선택한 이유
1. **이미 사용 중**. `.github/workflows/deploy.yml`이 존재하고 GitHub Secrets도 이미 운영 중. 신규 인프라/계정/결제 0개.
2. **빈도가 너무 낮다**. 월 4편 × 약 15분 = **약 60분/월** → 무료 한도(2,000분)의 3%. 사실상 평생 무료.
3. **트리거가 풍부**: cron 스케줄, `workflow_dispatch` 수동 트리거, GitHub REST API 호출(Admin UI 버튼) 모두 가능.
4. **24/7 가용**. 교회/관리자 PC 상태와 무관.
5. **시크릿 관리가 가장 안전**. YT refresh token, IG long-lived token, OPENAI_API_KEY 모두 GitHub Secrets에 두면 됨.
6. **재실행/로그가 GUI로 제공**. 실패 시 한 클릭 재실행, 로그는 모두 웹 UI에서 확인.
7. **6시간 한도 = 사실상 무제한**. 우리 작업 시간의 24배 여유.
8. **`ubuntu-latest` 러너에 ffmpeg 기본 탑재**, yt-dlp는 `pipx install yt-dlp` 한 줄로 설치.

### 5.3 다른 옵션을 뺀 이유
- **Cloudflare Pages / Vercel 함수**: 60초 한도 + FFmpeg 불가. 논외.
- **로컬 PC + Windows 작업 스케줄러**: 24/7 보장 안 됨, 정전·재부팅에 취약.
- **Cloud Run**: 좋은 선택이지만 Docker 빌드/배포가 필요하고, GitHub Actions로 이미 충분히 커버되는 빈도에서는 추가 인프라가 순손실. 월 100편 이상 처리하게 되면 그때 이전.
- **Trigger.dev / Inngest**: FFmpeg 같은 CPU-heavy 작업과 서버리스 실행 모델 궁합이 안 좋고, 무료 한도가 빠듯.
- **VPS (Hetzner 등)**: 월 $4~5 + OS 패치/모니터링 운영 부담. 이 빈도에는 과한 투자.

### 5.4 워크플로우 골격 (참고용 — 실제 코드는 선결 작업 후 작성)
```yaml
# .github/workflows/sermon-shorts.yml
name: Generate sermon shorts
on:
  workflow_dispatch:
    inputs:
      videoId:
        description: 'YouTube video ID (비우면 최신 영상 자동 선택)'
        required: false
  schedule:
    - cron: '0 17 * * 0'  # 일요일 17:00 UTC = 월요일 02:00 KST

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Install yt-dlp
        run: pipx install yt-dlp
      - run: npm ci
      - name: Run shorts pipeline
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE: ${{ secrets.SUPABASE_SERVICE_ROLE }}
          YT_REFRESH_TOKEN: ${{ secrets.YT_REFRESH_TOKEN }}
          IG_LONG_LIVED_TOKEN: ${{ secrets.IG_LONG_LIVED_TOKEN }}
        run: npm run shorts:generate -- --videoId="${{ inputs.videoId }}"
```

### 5.5 영상 파일 처리
- 작업 산출물(쇼츠 mp4)은 **GitHub Artifact에 저장하지 않는다** (90일 보관 + 외부에서 접근 불가).
- IG가 발행 시 public URL을 요구하므로 → **Supabase Storage 공개 버킷에 잠깐만 업로드** → YT/IG 발행 완료 → **즉시 삭제**.
- GitHub Actions 러너는 작업 종료와 함께 사라지므로 별도 정리 불필요.

### 5.6 Admin UI에서 트리거하는 방법
사이트는 Vercel에 그대로 두고, "쇼츠 생성" 버튼은 GitHub REST API의 `POST /repos/{owner}/{repo}/actions/workflows/sermon-shorts.yml/dispatches`를 호출해서 Actions를 깨운다. 즉, **무거운 작업만 GitHub Actions로 위임**하고 사이트 본체는 그대로.

---

## 5.A 선결 작업 — 인프라 소유권 이전 (⚠️ 코드 작성 보류 사유)

GitHub Actions를 운영 환경으로 쓰기로 한 이상, 워크플로우와 시크릿이 **개인 계정**에 묶이면 안 된다. 담당자 변경 시 권한 이전 부담, 토큰이 개인 계정에 남는 보안 리스크, 인수인계 부담이 모두 발생한다. 그래서 GitHub 뿐 아니라 **이 프로젝트가 의존하는 모든 외부 인프라**를 교회 공용 계정으로 이전한 후에 쇼츠 자동화 코드 작성을 시작한다.

### 결정 사항 (확정)
- **배포 플랫폼**: Vercel 단일화. Cloudflare Pages는 폐기. 도메인은 미사용 (`msvch.vercel.app` 기본 URL 사용)
- **시크릿 회전 시점**: 이전 작업 완료 직후 일괄 회전 (저장소가 PRIVATE이라 노출 범위가 본인 GitHub 계정 안으로 한정 — 이 기간 동안 저장소를 public으로 만들거나 협업자 추가 금지)
- **교회 Google 계정**: 이미 발급받음 → 모든 신규 계정 가입 시 이 계정 사용

### 이전 대상 (4개)

| # | 항목 | 방법 | 비고 |
|---|---|---|---|
| 1 | GitHub 저장소 | Org 생성 후 transfer | Secrets 자동 이관 |
| 2 | Vercel 프로젝트 | `Settings → Transfer project` | 환경변수 자동 이관, GitHub 재연결 필요 |
| 3 | Supabase 프로젝트 | `Settings → Transfer project to organization` | URL/key 그대로 유지 → 무중단 |
| 4 | Google Cloud 프로젝트 | IAM에 교회 Google 계정 Owner 추가 | Gemini/YouTube/Maps API 키 그대로 |

### 부가 정리 (이전 작업 시작 전 완료) ✅
이 항목들은 **이미 처리 완료**:
- [x] `.github/workflows/deploy.yml` 삭제 (Cloudflare Pages 의존 — Vercel은 자체 GitHub 연동으로 배포)
- [x] `next.config.ts`에서 Notion 이미지 호스트(`*.notion.so`, `prod-files-secure.s3...`) 제거
- [x] `.env.local`에서 `NOTION_*` 환경변수 4개 제거
- [x] `docs/DEPLOY-GUIDE.md` 삭제 (시크릿 평문 포함 + Vercel/Cloudflare 혼동 + 옛날 문서)
- [x] git history에서 `docs/DEPLOY-GUIDE.md` 흔적 완전 제거 (`git filter-repo`)

### 이전 순서 (8단계)
1. **교회 Google 계정으로 신규 가입** — GitHub Org / Vercel / Supabase (3개)
2. **Supabase 프로젝트 transfer** (URL/key 유지 → 무중단, 가장 안전한 항목부터)
3. **Google Cloud IAM에 교회 계정 Owner 추가** (기존 키 그대로 동작 → 무중단)
4. **GitHub 저장소 transfer**
   - Secrets 자동 이관 확인
   - 로컬 `git remote set-url origin ...`
5. **Vercel 프로젝트 transfer** (또는 신규 생성 + 환경변수 재입력)
   - GitHub 연결을 새 Org/저장소로 갱신
   - `msvch.vercel.app` URL이 새 계정 아래로 따라오는지 확인 (대부분 따라옴)
6. **운영 검증**
   - 사이트 접속 OK
   - `/admin` 로그인 OK
   - Gemini 설교 요약 OK
   - 갤러리/주보 이미지 로딩 OK
7. **시크릿 일괄 회전** (이전 완료 후)
   - Supabase service role key
   - Gemini API key
   - YouTube API key
   - Google Maps key
   - `REVALIDATE_SECRET`
   - Vercel 환경변수 + GitHub Secrets 모두 갱신
8. **본인 개인 계정에서 권한 정리** (선택)
   - GitHub: 본인을 Org member로만 남기고 owner는 교회 계정
   - Vercel/Supabase: 본인을 collaborator로 남길지, 완전 제거할지 결정
   - Google Cloud: 본인 owner 권한 유지(개발자) 또는 editor로 강등

### 이전 후에 추가할 시크릿 (쇼츠 자동화 신규)
- `OPENAI_API_KEY` (Whisper용)
- `SUPABASE_SERVICE_ROLE` (워커가 RLS 우회해서 `shorts_jobs` 쓰기 위함 — 이미 `SUPABASE_SERVICE_ROLE_KEY`로 존재)
- `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (쇼츠 업로드용 — 기존 `YOUTUBE_API_KEY`와 별개)
- `IG_APP_ID`, `IG_APP_SECRET`, `IG_LONG_LIVED_TOKEN`, `IG_USER_ID`

---

## 6. 데이터 모델 (Supabase)

### `shorts_jobs` — 작업 단위
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| sermon_video_id | text | YouTube videoId |
| sermon_title | text | |
| sermon_published_at | timestamptz | |
| status | text | `pending`/`transcribing`/`selecting`/`editing`/`ready_for_review`/`approved`/`published`/`failed` |
| error | text | 실패 시 메시지 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `shorts_clips` — 생성된 쇼츠 후보
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| job_id | uuid FK → shorts_jobs.id | |
| start_sec | numeric | |
| end_sec | numeric | |
| title | text | LLM 생성 제목 |
| hook | text | 첫 3초용 훅 |
| caption_yt | text | 유튜브 설명 |
| caption_ig | text | 인스타 캡션 |
| video_path | text | Supabase Storage 경로 |
| review_status | text | `pending`/`approved`/`rejected` |
| reviewer_note | text | |
| youtube_video_id | text | 발행 후 채워짐 |
| instagram_media_id | text | 발행 후 채워짐 |
| published_at | timestamptz | |

### `shorts_settings` — 글로벌 설정
- 자동 발행 on/off
- 일일 발행 상한
- 사용 모델
- 프롬프트 템플릿 (수정 가능)

---

## 7. 비용 추정 (월 4편 설교 기준)

| 항목 | 단가 | 월 비용 |
|------|------|---------|
| Whisper API (60분 × 4편) | $0.006/min | **$1.44** |
| Gemini API (하이라이트 + 메타) | ~$0.01/편 | **$0.04** |
| Supabase Storage 임시 (1GB) | 무료 한도 | $0 |
| YouTube Data API | 무료 | $0 |
| Instagram Graph API | 무료 | $0 |
| FFmpeg 컴퓨팅 (로컬 또는 Cloud Run 무료 한도) | - | $0 |
| **합계** | | **약 $1.5/월** |

> 사실상 무료. 비용 관점에서 막을 이유가 없음.

---

## 8. 단계별 로드맵

### Phase 0 — 선결 작업 (코드 작성 전)
- [ ] **GitHub 저장소를 개인 계정 → 교회 공용 계정/Org로 이전** (§5.A 체크리스트)
- [ ] 이전 후 기존 시크릿 재등록 + Cloudflare Pages 빌드 정상 확인
- [ ] OpenAI 결제 계정 생성 + `OPENAI_API_KEY` 발급
- [ ] YouTube 채널 소유 Google 계정으로 OAuth 동의 화면 + 클라이언트 생성, refresh token 1회 발급
- [ ] 인스타 계정을 Business로 전환 + Facebook 페이지 연결, 장기 토큰 발급

### Phase 1 — GitHub Actions 위에서 종단 검증 (목표: 설교 1편 → 쇼츠 1개를 YT에 private으로 발행)
- [ ] `scripts/shorts/` 디렉토리 생성, 단일 진입점 `run.ts` (`--videoId` 인자)
- [ ] `.github/workflows/sermon-shorts.yml` 작성 (`workflow_dispatch` 우선, cron은 Phase 2)
- [ ] yt-dlp 다운로드 단계 (Actions 러너에서 동작 확인)
- [ ] OpenAI Whisper API 호출 + 단어 단위 타임스탬프 저장
- [ ] 하이라이트 선정 프롬프트 + Gemini 호출 (`src/lib/gemini.ts` 확장 또는 `scripts/shorts/highlight.ts`로 분리)
- [ ] FFmpeg 컷 + 9:16 크롭 + ASS 자막 번인
- [ ] Supabase 마이그레이션: `shorts_jobs`, `shorts_clips`, `shorts_settings`
- [ ] 결과 mp4를 Supabase Storage 임시 버킷에 업로드
- [ ] YouTube `videos.insert` 호출 (privacyStatus=private)
- [ ] Admin 페이지 `/admin/shorts` — 후보 리스트 + 미리보기 + 승인/반려 버튼
- [ ] 승인 시 `private` → `public` 전환 API 라우트
- [ ] **종단 테스트**: workflow_dispatch로 수동 실행 → 쇼츠 1개 private 발행 → Admin에서 승인 → public 전환 성공

### Phase 2 — 인스타 + 자동 트리거
- [ ] Instagram `media` + `media_publish` 2단계 발행 구현
- [ ] 새 설교 자동 감지: cron 스케줄 (`0 17 * * 0`) + 기존 `src/lib/youtube.ts` 활용
- [ ] 한 설교당 쇼츠 5개 일괄 생성
- [ ] 검수 알림 (이메일 또는 카카오톡 알림톡)
- [ ] Admin UI에 "지금 생성" 버튼 → GitHub REST API로 `workflow_dispatch` 호출

### Phase 3 — 품질·운영 개선
- [ ] 자막 스타일링 고도화 (단어 강조, 색상)
- [ ] 화자 얼굴 추적 크롭 (multi-cam 영상 대응)
- [ ] 썸네일 자동 생성 (DALL-E 3 또는 첫 프레임 + 텍스트 오버레이)
- [ ] 발행 후 분석: 조회수/도달/좋아요를 다시 끌어와 어떤 유형의 쇼츠가 잘되는지 학습
- [ ] 프롬프트 자동 튜닝 (성과 좋은 쇼츠의 패턴을 반영)

---

## 9. 위험과 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| **신학적 맥락 훼손** | 설교 의도 왜곡, 교인 항의 | 사람 검수 게이트 필수, 자동 발행 기본 OFF |
| 외부 영상 저작권 | 법적 분쟁 | 본 교회 채널 영상에만 적용 (정책 코드화) |
| YouTube 쿼터 초과 | 발행 실패 | 일일 6개 상한, 초과 시 다음 날로 큐잉 |
| Instagram 토큰 만료 | 발행 실패 | 60일 토큰 자동 갱신 cron, 만료 7일 전 알림 |
| Whisper 한국어 오인식 | 자막 오타 → 발행물 품질 저하 | 검수 단계에서 자막 텍스트 표시, 수정 UI 제공 |
| FFmpeg 처리 시간 | 워커 과부하 | 한 작업당 timeout, 동시 실행 1개로 제한 |
| 발행 후 문제 발견 | 이미 노출된 영상 회수 | API로 즉시 unlist 가능, Admin UI에 "긴급 비공개" 버튼 |

---

## 10. 결정해야 할 것들

### 결정된 것 ✅
- **실행 환경**: GitHub Actions (§5)
- **개발 시작 시점**: 저장소 소유권 이전 완료 후 (§5.A)

### 아직 결정 필요
1. **자동 발행을 어디까지 허용할 것인가?**
   - (a) 항상 사람 검수 필수 — 가장 안전
   - (b) 검수 후 자동 발행
   - (c) 완전 자동, 사후 검수 — 비권장
   → **(a) 또는 (b)** 권장

2. **인스타 계정 상태**
   - 이미 Business 계정인가? Personal이면 전환 필요

3. **YouTube 채널 OAuth 인증 권한**
   - 채널 소유 구글 계정 접근 가능한가?

4. **하이라이트 개수**
   - 설교 1편당 몇 개? (권장: 3~5개, 너무 많으면 검수 부담)

5. **GitHub 공용 계정 형태**
   - 단일 사용자 계정 vs Organization
   - 권장: **Organization** (멤버/권한 관리, 감사 로그, 무료 plan에서도 충분)

---

## 11. 다음 액션

**현재 상태**: 코드 작성 보류 중. 사용자가 진행 중인 **GitHub 저장소 소유권 이전(개인 → 교회 공용 계정)**이 먼저 끝나야 한다.

### 이전이 끝난 후 재개 순서
1. §5.A 체크리스트 완료 확인 (Cloudflare Pages 빌드 정상 동작 검증)
2. §10의 미결 결정사항 4개에 대한 답을 전략 문서에 기록
3. Phase 0의 나머지 항목(OpenAI/YT/IG 토큰 발급) 진행
4. Phase 1 첫 항목(`scripts/shorts/run.ts` + 워크플로우 골격) 작성 시작
