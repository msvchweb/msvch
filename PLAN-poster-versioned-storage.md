# PLAN: 포스터 저장, 버전 이력, 이어 수정

## 목표

포스터 도구를 세 탭으로 정리한다.

1. 이미지 만들기
2. 추천도서자동화
3. 저장된 포스터

이미지 만들기 또는 추천도서자동화에서 완성본을 다운로드하면, 사용자의 로컬 다운로드와 동시에 Supabase Storage에 최종본을 저장한다. 저장된 포스터 탭에서는 최신 저장본 목록을 보고, 특정 포스터를 클릭해 최신 버전을 기준으로 수정 프롬프트를 이어갈 수 있게 한다. 별도의 "업로드하여 이어가기" 버튼으로 사용자가 가진 이미지 파일도 새 포스터 작업으로 등록하고 수정 흐름에 진입할 수 있게 한다.

포스터 도구 상단 타이틀 옆에는 OpenAI API의 해당 월 총 사용 금액을 표시한다. 예: `총 사용량 $0.00 / 7월`.

## 현재 상태

- `PostersTabs`는 현재 `prompt`, `book` 두 탭만 가진다.
- `PromptBuilder`의 이미지 만들기 흐름은 생성/수정 결과를 `imageHistory` 상태에만 보관한다. 페이지를 닫으면 사라진다.
- `PromptBuilder`의 다운로드는 `data:image/...` URL을 브라우저 다운로드로만 처리한다.
- `BookRecommendationAutomation`의 다운로드는 `renderToBlob(ratio)` 결과를 브라우저 다운로드로만 처리한다.
- `poster-images` Storage 버킷과 `posters` 테이블은 이미 존재하지만 현재 앱 흐름과 연결되어 있지 않다.
- `/api/posters/generate-image`의 수정 API는 `sourceImageDataUrls`로 data URL만 받아 처리한다.
- 포스터 도구 페이지 상단에는 현재 OpenAI API 월간 총 사용 금액 표시가 없다.

## 최종 데이터 모델

기존 `posters` 테이블은 "포스터 작업" 단위로 사용한다. 새 `poster_versions` 테이블은 "저장된 결과물" 단위로 사용한다.

### `posters`

기존 컬럼을 최대한 유지하되 최신 버전 참조를 추가한다.

- `id`
- `created_at`
- `updated_at`
- `created_by`
- `created_by_name`
- `category`
- `title`
- `body_text`
- `prompt_used`
- `ratio`
- `ai_image_url`
- `final_image_url`
- `current_version_id`
- `linked_event_id`
- `linked_notice_id`
- `cost_cents`

`ai_image_url`, `final_image_url`은 기존 스키마 호환을 위해 유지한다. 새 저장 흐름에서는 최신 버전의 이미지 URL을 `final_image_url`에도 동기화한다.

### `poster_versions`

새 마이그레이션으로 추가한다.

- `id uuid primary key default gen_random_uuid()`
- `poster_id uuid not null references public.posters(id) on delete cascade`
- `version_no int not null`
- `created_at timestamptz not null default now()`
- `created_by uuid references auth.users(id) on delete set null`
- `created_by_name text`
- `source_type text not null`
  - `generated`
  - `revised`
  - `uploaded`
  - `book_recommendation`
- `image_url text not null`
- `thumbnail_url text`
- `storage_path text not null`
- `thumbnail_storage_path text`
- `prompt_used text`
- `revision_instruction text`
- `input_version_id uuid references public.poster_versions(id) on delete set null`
- `mime_type text not null default 'image/png'`
- `width int`
- `height int`
- `file_size_bytes int`

제약:

- `unique (poster_id, version_no)`
- `source_type` CHECK
- `version_no > 0`
- `revision_instruction` 길이 제한

인덱스:

- `idx_poster_versions_poster_created_at (poster_id, created_at desc)`
- `idx_poster_versions_created_at (created_at desc)`

RLS:

- SELECT: `public.is_staff()`
- INSERT: `public.is_staff()` and created_by is null or auth.uid()
- UPDATE/DELETE: admin/master 또는 작성자

## Storage 설계

기존 `poster-images` 버킷을 사용한다.

경로:

- 원본/최종 버전: `posters/{posterId}/versions/v{versionNo}.png`
- 썸네일: `posters/{posterId}/thumbs/v{versionNo}.webp`

업로드 규칙:

- 최종본은 `image/png`로 저장한다.
- 썸네일은 `image/webp`, 긴 변 기준 480px 정도로 저장한다.
- `poster-images` 버킷의 10MB 제한을 넘는 경우, 클라이언트에서 PNG 대신 JPEG/WebP 저장으로 fallback 하거나 사용자에게 이미지 크기 축소 안내를 한다.

## API/유틸 설계

### 공통 클라이언트 유틸

새 파일 후보:

- `src/lib/poster-storage.ts`

역할:

- `dataUrlToBlob(dataUrl)`
- `blobToDataUrl(blob)`
- `imageUrlToDataUrl(url)`
- `createPosterThumbnail(blob | dataUrl)`
- `downloadBlob(blob, filename)`
- `uploadPosterVersion(input)`

주의:

- Storage 업로드와 DB insert/update는 순차 처리한다.
- 버전 row insert 실패 시 이미 업로드된 파일은 가능한 경우 삭제한다.
- 다운로드 UX는 저장 실패와 분리한다. 사용자는 로컬 다운로드를 항상 받을 수 있어야 한다.

### 서버 API 추가 여부

MVP가 아니라 최종 구현이므로, 저장/버전 생성은 서버 Route Handler로 감싸는 편이 더 안전하다.

추가 후보:

- `POST /api/posters/save-version`
- `GET /api/posters/saved`
- `POST /api/posters/upload-seed`

권장:

- 클라이언트가 Supabase Storage에 직접 업로드하지 않고 API route가 인증, 프로필 조회, DB 쓰기, Storage 경로 생성을 책임진다.
- 단, 현재 프로젝트는 관리자 UI에서 클라이언트 Supabase 업로드를 이미 사용한다. 구현 난이도와 일관성을 비교해 결정한다.

최종 권장안:

- Storage 업로드는 클라이언트 Supabase로 처리
- DB insert/update도 클라이언트 Supabase로 처리
- 복잡한 파일 정리/트랜잭션은 추후 서버 API로 이동 가능하게 유틸 경계를 분리

이유:

- 기존 관리자 업로드 패턴과 일치한다.
- RLS와 Storage 정책이 이미 staff 기준으로 잡혀 있다.
- 이번 변경의 핵심은 UX와 버전 이력이며, 서버 API를 과도하게 늘리지 않아도 된다.

### OpenAI 월간 사용 금액 조회

새 서버 route를 추가한다.

- `GET /api/admin/openai/monthly-spend`

역할:

- `requireAdmin()`으로 staff/admin/master만 접근 허용
- 서버 환경 변수 `OPENAI_ADMIN_KEY` 사용
- 현재 월의 시작/끝을 Unix seconds로 계산
- OpenAI Costs API 호출
- `bucket.results[].amount.value`를 합산해 반환

응답 예시:

```json
{
  "totalUsd": 0,
  "currency": "usd",
  "monthLabel": "7월",
  "startTime": 1782831600
}
```

OpenAI 호출:

```text
GET https://api.openai.com/v1/organization/costs
  ?start_time={monthStart}
  &end_time={monthEnd}
  &bucket_width=1d
  &limit=31
```

주의:

- 일반 `OPENAI_API_KEY`가 아니라 조직 Admin API key가 필요하다.
- `OPENAI_ADMIN_KEY`는 절대 `NEXT_PUBLIC_`로 만들지 않는다.
- 같은 OpenAI 조직에서 다른 프로젝트도 함께 쓰면 조직 총액이 섞인다.
- 포스터 도구 상단의 `총 사용량`은 조직 전체 월 비용으로 표시한다. 프로젝트별 비용은 OpenAI 대시보드에서 별도로 확인한다.
- API 실패 시 UI 전체를 깨뜨리지 않고 `총 사용량 - / 7월` 또는 작은 오류 상태로 표시한다.

## UX 설계

### 탭

`PostersTabs`의 탭 타입을 확장한다.

- `prompt`
- `book`
- `saved`

탭 라벨:

- 이미지 만들기
- 추천도서자동화
- 저장된 포스터

### 상단 월간 사용량 표시

위치:

- `src/app/admin/posters/page.tsx`
- `h1`의 `포스터 도구` 텍스트 바로 옆

표시:

- 정상: `총 사용량 $0.00 / 7월`
- 로딩: `총 사용량 불러오는 중`
- 실패: `총 사용량 - / 7월`

구현 후보:

- 서버 컴포넌트에서 직접 조회하지 않는다.
- 작은 클라이언트 컴포넌트 `OpenAIMonthlySpendBadge`를 만들어 `/api/admin/openai/monthly-spend`를 호출한다.

이유:

- OpenAI Admin Key 조회 실패가 포스터 도구 페이지 렌더 실패로 이어지지 않는다.
- 로딩/실패 상태를 타이틀 옆에서 자연스럽게 처리할 수 있다.
- staff 화면에서만 보이는 값이므로 기존 admin page 권한과 API route 권한으로 이중 방어한다.

### 저장된 포스터 목록

새 컴포넌트:

- `src/app/admin/posters/SavedPosters.tsx`

목록 카드 표시:

- 썸네일
- 제목
- 작성자
- 작성일시

쿼리:

- `posters`에서 `created_at desc` 또는 `updated_at desc`
- 최신 이미지: `posters.final_image_url`
- 썸네일은 `current_version_id` 조인 또는 `poster_versions.thumbnail_url`

클릭 시:

- 상세/수정 패널을 같은 탭 안에 표시한다.
- 최신 버전 이미지를 기준 이미지로 로드한다.
- 수정 프롬프트 textarea와 전송 버튼을 보여준다.
- 수정 결과가 생성되면 미리보기와 버전 이력을 갱신한다.

### 업로드하여 이어가기

위치:

- 저장된 포스터 탭 상단

흐름:

1. 이미지 파일 선택
2. 제목 입력. 기본값은 파일명에서 확장자 제거
3. 비율 선택. 기본값 `a4`
4. 새 `posters` row 생성
5. 업로드 이미지를 `poster_versions` v1로 저장
6. `posters.current_version_id`, `posters.final_image_url` 갱신
7. 바로 이어 수정 패널 진입

### 이미지 만들기 다운로드

기존 `handleDownloadGeneratedImage`를 변경한다.

1. 현재 선택 이미지 data URL을 Blob으로 변환
2. 로컬 다운로드 실행
3. 같은 Blob으로 `poster-images`에 저장
4. 신규 포스터 또는 기존 작업의 새 버전으로 DB 저장

초기 생성/수정 흐름에서는 아직 `poster_id`가 없을 수 있다. 첫 다운로드 시 새 `posters` row를 만들고, 이후 같은 화면에서 추가 다운로드하면 같은 `poster_id`에 새 버전을 추가한다.

### 추천도서자동화 다운로드

기존 `handleDownloadPoster`를 변경한다.

1. `renderToBlob(ratio)`로 최종본 생성
2. 로컬 다운로드 실행
3. 같은 Blob으로 `poster-images`에 저장
4. 새 `posters` row 또는 기존 작업의 새 버전 생성

추천도서 포스터는 `category = notice`, `source_type = book_recommendation`로 저장한다.

## 수정 요청 처리

저장된 포스터에서 이어 수정할 때:

1. 최신 버전 `image_url`을 불러온다.
2. CORS 문제가 없도록 same-origin proxy 또는 Storage public URL을 `fetch`해서 Blob으로 받는다.
3. Blob을 data URL로 변환한다.
4. 기존 `/api/posters/generate-image`에 `mode: "revise"`로 전달한다.
5. 수정 결과를 data URL로 받아 미리보기한다.
6. 사용자가 다운로드하면 새 버전으로 저장한다.

주의:

- `/api/posters/generate-image`는 현재 data URL만 지원하므로 URL을 직접 넘기지 않는다.
- reference image로 로고/QR을 함께 보내는 기존 패턴은 유지한다.
- 수정 결과는 즉시 저장하지 않고, 기존 요구 기준에 맞춰 다운로드 버튼을 기준으로 저장한다.

## 비용 기록

`poster_versions`에 `cost_cents`를 두거나 별도 usage log를 확장할 수 있다. 현재는 `poster_usage_logs`가 action 단위만 기록한다.

최종 구현에서는 다음 중 하나를 선택한다.

1. `poster_versions.cost_cents` 추가
2. `poster_usage_logs`에 estimated cost 필드 추가

권장:

- `poster_versions.estimated_cost_cents`
- `poster_versions.model`
- `poster_versions.quality`
- `poster_versions.size`

실제 API가 상세 비용을 반환하지 않는 경우, 현재 요청 파라미터 기준 추정치를 저장한다.

## 오류 방지 체크리스트

- 새 마이그레이션은 기존 `posters` row가 없어도 안전해야 한다.
- `current_version_id` FK는 순환 참조가 생기므로 `ALTER TABLE`로 나중에 추가한다.
- 기존 `posters`의 `ai_image_url`, `final_image_url`, `prompt_used`는 NOT NULL이므로 새 row 생성 시 항상 채운다.
- Storage 업로드 성공 후 DB 실패 시 업로드 파일 삭제를 시도한다.
- DB 성공 후 `posters.current_version_id` 갱신 실패 시 버전 row는 남기고 사용자에게 재시도 안내한다.
- 같은 화면에서 다운로드를 여러 번 눌러도 version_no 충돌이 나지 않게, 저장 직전 최신 version_no를 조회한다.
- 업로드 파일은 확장자와 MIME을 모두 검증한다.
- 10MB 초과 파일은 업로드 전에 차단하거나 압축한다.
- 썸네일 생성 실패가 최종본 저장 실패로 이어지지 않게 한다.
- 저장 실패가 로컬 다운로드 실패로 이어지지 않게 한다.
- 저장된 포스터 목록 로딩 실패는 탭 전체 crash가 아니라 오류 메시지로 처리한다.
- 수정 요청 중 버튼 중복 클릭을 막는다.
- data URL 변환 실패, CORS 실패, proxy 실패를 구분해 메시지를 낸다.
- OpenAI 월간 사용량 조회 실패는 포스터 도구 페이지 렌더 실패로 이어지지 않게 한다.
- `OPENAI_ADMIN_KEY`가 없으면 서버 route는 500을 반환하되, UI는 `총 사용량 - / N월`로 degraded 표시한다.
- 월 경계는 서버 기준으로 계산한다. UI 표기는 한국 사용자를 위해 `ko-KR` 월 라벨을 사용한다.
- Cost API 응답에 빈 bucket/result가 있어도 합산 결과는 0으로 처리한다.

## 구현 순서

1. 새 마이그레이션 작성
   - `poster_versions`
   - `posters.current_version_id`
   - 관련 RLS, 인덱스

2. 타입/유틸 추가
   - 포스터 저장 타입
   - Blob/data URL 변환
   - 썸네일 생성
   - Storage path 생성
   - 포스터 row/version row 생성

3. 탭 추가
   - `PostersTabs`에 `saved` 추가
   - `SavedPosters` 기본 목록 UI 추가

3-1. 월간 사용량 표시 추가
   - `GET /api/admin/openai/monthly-spend` 추가
   - `OpenAIMonthlySpendBadge` 추가
   - `page.tsx`의 `포스터 도구` 타이틀 옆에 배치

4. 저장된 포스터 목록 구현
   - 최신 포스터 조회
   - 썸네일/제목/작성자/작성일시 표시
   - 빈 상태/오류 상태

5. 이미지 만들기 다운로드 저장 연결
   - 기존 로컬 다운로드 유지
   - 저장 성공/실패 상태 표시
   - 같은 작업 내 version_no 증가

6. 추천도서자동화 다운로드 저장 연결
   - 기존 로컬 다운로드 유지
   - 최종 Blob 저장
   - `book_recommendation` source_type 기록

7. 저장된 포스터 이어 수정 구현
   - 최신 버전 선택
   - 이미지 URL을 data URL로 변환
   - 기존 수정 API 호출
   - 결과 미리보기
   - 다운로드 시 새 버전 저장

8. 업로드하여 이어가기 구현
   - 파일 선택/제목/비율
   - 새 포스터 + v1 생성
   - 이어 수정 패널 진입

9. 버전 이력 UI
   - 상세 패널 안에 버전 목록 표시
   - 버전 클릭 시 기준 이미지 변경
   - 최신 버전 표시

10. 문서 업데이트
    - `API_SPEC.md`
    - `DB_SCHEMA.md`
    - 필요 시 `ARCHIT.md`

## 검증 계획

로컬 수동 검증:

- 이미지 만들기에서 생성 후 다운로드하면 파일이 내려받아지고 `poster-images`에 저장된다.
- 같은 포스터를 다시 다운로드하면 같은 `poster_id`에 v2가 생긴다.
- 추천도서자동화 다운로드도 저장된다.
- 저장된 포스터 탭 목록에 제목/썸네일/작성자/작성일시가 보인다.
- 저장된 포스터 클릭 후 수정 요청이 성공한다.
- 수정 결과 다운로드 시 새 버전이 생긴다.
- 업로드하여 이어가기가 새 포스터 v1을 만들고 수정 가능 상태로 열린다.
- 10MB 초과 파일은 안내된다.
- 네트워크/Storage 실패 시 로컬 다운로드는 유지된다.
- 포스터 도구 타이틀 옆에 `총 사용량 $0.00 / 7월` 형식의 월간 OpenAI 비용이 표시된다.
- `OPENAI_ADMIN_KEY`가 없거나 Cost API가 실패해도 포스터 도구 페이지는 계속 열린다.

가능한 자동 검증:

- `npm run lint`
- `npm run build`
- Supabase 타입이 없다면 최소 TypeScript build로 쿼리 타입 오류 확인

## 비용 기준

현재 프로젝트 기본값은 `gpt-image-2`, `quality = medium`, `output_format = jpeg`이다.

OpenAI 공식 문서의 GPT Image 2 예시 비용 기준:

- 1024x1024 medium: 약 $0.053
- 1024x1536 medium: 약 $0.041
- 1536x1024 medium: 약 $0.041

수정 요청은 여기에 입력 이미지 토큰 비용이 추가된다. 포스터 수정은 기준 이미지 + 로고 + QR 이미지를 함께 넣는 경우가 많으므로, 단순 신규 생성보다 비싸질 수 있다.

운영 추정:

- 신규 생성 1회: 대략 $0.04~$0.06
- 수정 1회: 입력 이미지 비용 포함으로 대략 $0.05~$0.12 범위로 보는 것이 보수적
- 포스터 1장에 생성 1회 + 수정 2회면 대략 $0.15~$0.30 수준으로 추정

정확한 금액은 요청 size, quality, 입력 이미지 수, 입력 이미지 토큰량에 따라 달라진다.
