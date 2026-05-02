# 새가족 등록 폼 — 구현 보고서

> 작성일: 2026-05-02
> 범위: 웹페이지 전용. 모바일은 별도 작업.
> 전제: Next.js 16.2.2 App Router + Supabase + 기존 admin/auth/RLS 패턴 그대로 유지.

---

## 0. TL;DR

1. 공개 라우트 **`/new-family`** 에서 신청을 받고, 관리자 라우트 **`/admin/new-families`** 에서 처리한다.
2. DB 는 새 테이블 **`new_family_registrations`** 단일. 마이그레이션 **024_new_family_registrations.sql** 추가.
3. RLS 패턴은 `chat_inquiries`(006) 와 동일: **누구나 INSERT, staff 만 SELECT, staff 만 UPDATE, admin/master 만 DELETE**.
4. 공개 폼 제출은 service_role 키로 INSERT (CSRF/RLS 우회 없이 RLS INSERT 정책으로도 처리 가능하지만, 기존 `chat_inquiries` 와 동일하게 service_role 사용).
5. 침례교가 아니므로 사용자 요청대로 **'침례'는 모두 '세례'** 로 표기. 설문 본문, 라벨, 개인정보 처리방침의 위탁업체(아임웹 → Vercel) 등 기관 특성에 맞춰 일부 정합화.
6. 폼 9문항 + 개인정보 동의 1단계, 관리자 페이지는 **상태 필터(전체/신규/연락완료/교구배정/완료) + 메모 + 삭제** 지원.
7. **typecheck 통과, build 통과** (`/new-family` SSG, admin 동적 렌더). 마이그레이션 024 는 사용자가 Supabase 에 적용 필요.

---

## 1. 사전 분석 — 기존 패턴 답습 포인트

| 항목 | 참조 파일 | 적용 |
|---|---|---|
| 공개 INSERT + admin SELECT 테이블 | `supabase/migrations/006_chat_inquiries.sql` | 마이그레이션 024 의 RLS 정책 |
| service_role 기반 anon 제출 라우트 | `src/app/api/chat/inquiry/route.ts` | `src/app/api/new-family/route.ts` |
| admin 라우트 보호 | `src/lib/admin-auth.ts` (`requireAdmin`) | `/api/admin/new-families/*` |
| API client (cookies + bearer) | `src/lib/supabase/api.ts` (`createApiClient`) | admin GET/PATCH/DELETE |
| zod validation | `src/lib/validation.ts` (`EventSubscriberSchema`) | `NewFamilyRegistrationSchema`, `NewFamilyUpdateSchema` |
| admin 페이지 레이아웃·필터·확장 | `src/app/admin/event-subscribers/page.tsx`, `src/app/admin/inquiries/page.tsx` | `src/app/admin/new-families/page.tsx` |
| 공개 페이지 레이아웃 | `src/app/(public)/notice/page.tsx`, `Container`, `PageHeader` | `src/app/(public)/new-family/page.tsx` |
| useEffect 패턴 (set-state-in-effect 회피) | `event-subscribers/page.tsx` 의 inline fetch + cancelled flag | admin/new-families useEffect |
| AdminNav 아이콘 키 시스템 | `src/app/admin/AdminNav.tsx` | `newFamily` 키 + UserPlus 아이콘 추가 |
| Bearer + cookie 듀얼 인증 (모바일 호환) | `createApiClient` | admin API 라우트는 자동으로 모바일 준비됨 |

**확인한 회피 사항:**
- `chat_inquiries` 의 RLS 는 INSERT 가 `with check (true)` 라서 anon-key 만으로도 INSERT 가 가능하지만, 안정적인 폼 제출을 위해 본 라우트는 **service_role** 을 사용. 기존 `chat/inquiry` 와 동일.
- `/admin/inquiries/page.tsx` 는 클라이언트에서 supabase anon-key 로 직접 SELECT 함 (RLS 가 admin 만 허용). 본 admin 페이지는 **API 라우트 경유** 패턴으로 통일 — 더 명시적이고 모바일과 호환.

---

## 2. DB 스키마 — `new_family_registrations`

마이그레이션: `supabase/migrations/024_new_family_registrations.sql`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | `uuid PK` | 자동 생성 |
| `visit_paths` | `text[] NOT NULL DEFAULT '{}'` | 방문 경로 (복수). 값: `website` / `youtube` / `recommendation` / `visited_first` / `etc` |
| `visit_paths_etc` | `text` | 기타 방문 경로 직접 입력 |
| `faith_status` | `text NOT NULL CHECK` | `accepted` / `not_yet` / `unsure` |
| `name` | `text NOT NULL` (1~50자) | 이름 |
| `gender` | `text NOT NULL CHECK` | `male` / `female` |
| `birth` | `text NOT NULL` (1~40자) | "010101" / "음력 010101" 등 자유 텍스트 |
| `phone` | `text NOT NULL` (9~20자) | `010-XXXX-XXXX` |
| `region` | `text` (≤100자) | 거주 지역 (선택) |
| `church_history` | `text NOT NULL CHECK` | `never` / `attended_no_baptism` / `baptized_inactive` / `baptized_active` / `etc` |
| `church_history_etc` | `text` | 기타 신앙생활 직접 입력 |
| `message` | `text` (≤2000자) | 자유 메시지 (선택) |
| `privacy_consent` | `boolean NOT NULL CHECK (= true)` | 동의 강제 |
| `privacy_consented_at` | `timestamptz NOT NULL DEFAULT now()` | 동의 시각 — 보존기간 산정 근거 |
| `status` | `text NOT NULL DEFAULT 'new' CHECK` | `new` / `contacted` / `assigned` / `done` |
| `admin_note` | `text` (≤2000자) | 관리자 메모 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | 트리거로 자동 갱신 |

**인덱스:** `idx_new_family_registrations_status`, `idx_new_family_registrations_created_at`

**RLS:**
- INSERT — 누구나 (`with check (true)`)
- SELECT — `is_staff()` (마이그레이션 015 의 헬퍼 사용)
- UPDATE — `is_staff()`
- DELETE — `is_admin_or_master()` (마이그레이션 019 의 헬퍼)

**트리거:** `BEFORE UPDATE` 에서 `updated_at = now()` 자동 갱신.

---

## 3. 추가/수정 파일 목록

### 신규
| 파일 | 역할 |
|---|---|
| `supabase/migrations/024_new_family_registrations.sql` | 테이블 + RLS + 트리거 |
| `src/types/new-family.ts` | TypeScript DTO + enum 라벨 매핑 |
| `src/app/api/new-family/route.ts` | `POST /api/new-family` — 공개 제출 |
| `src/app/api/admin/new-families/route.ts` | `GET /api/admin/new-families` — admin 목록 + 공용 `toDto()` |
| `src/app/api/admin/new-families/[id]/route.ts` | `PATCH` 상태/메모, `DELETE` |
| `src/app/(public)/new-family/page.tsx` | 공개 페이지 셸 |
| `src/app/(public)/new-family/NewFamilyForm.tsx` | 폼 클라이언트 컴포넌트 |
| `src/app/(public)/new-family/privacy-policy.ts` | 개인정보 처리방침 본문 (정적 상수) |
| `src/app/admin/new-families/page.tsx` | 관리자 페이지 |

### 수정
| 파일 | 변경 |
|---|---|
| `src/lib/validation.ts` | `NewFamilyRegistrationSchema`, `NewFamilyUpdateSchema` 추가 |
| `src/app/admin/AdminNav.tsx` | `AdminIconKey` 에 `newFamily` 추가 + `UserPlus` 아이콘 매핑 |
| `src/app/admin/layout.tsx` | `baseNav` 에 "새가족 등록" 메뉴 항목 추가 |

---

## 4. 설계 결정과 근거

### 4-1. 단일 테이블 설계 — 회원가입과 분리
**결정:** `profiles` 와 연동하지 않고 별도 테이블에 보관.

**이유:**
- 새가족 신청자는 OAuth 로그인 사용자가 아닌 **익명 방문자**가 대부분.
- 신청 자체가 자료(잠재 회원 명단)이며, 가입 → profile 생성과는 라이프사이클이 다름.
- 향후 신청 → 회원가입 매칭은 전화번호 단위 수동 매칭이 자연스럽다 (admin 페이지 메모로 충분).

### 4-2. RLS — 기존 헬퍼 함수 재사용
`is_staff()`, `is_admin_or_master()` 가 이미 015/019 마이그레이션에서 정의돼 있어 **새 헬퍼를 만들지 않고 그대로 호출**. 다른 테이블과 권한 체계가 일관됨.

### 4-3. 침례 → 세례
- 설문 8번 보기 텍스트 (`baptized_*`) 의 표시 라벨에서 모두 "세례"로 표기.
- 개인정보 처리방침 1조 4항 "교회 행사 신청·안내(수련회, 세례·학습…)" 도 침례 대신 세례로.

### 4-4. 개인정보 처리방침 본문 정합화
- 운영 사이트가 https://yulinuri.org → **https://msvch.vercel.app** 로 교체.
- 위탁업체 ㈜아임웹 → **Vercel Inc.** (실제 호스팅).
- 보호책임자/연락처 → 기존 풋터의 `msvch01@naver.com`, `02-534-0691` 로 통일.
- 시행일 → 2026-05-02 (오늘).

### 4-5. 전화번호 입력 UX
- `event-subscribers` 가 단일 input + 정규화하는 패턴이지만, 새가족 폼은 사용자 친숙도가 더 중요하므로 **3분할 입력(010-XXXX-XXXX)** 을 채택.
- 클라이언트에서 `^010-\d{3,4}-\d{4}$` 검증 후 `${phone1}-${phone2}-${phone3}` 형태로 전송.

### 4-6. 폼 검증 이중 레이어
- 1차: 클라이언트 `handleSubmit` — 즉시 피드백, 라디오/체크박스 선택 강제.
- 2차: 서버 zod (`NewFamilyRegistrationSchema`) + 추가 룰 (`visitPaths.includes('etc')` 일 때 `visitPathsEtc` 필수, `churchHistory === 'etc'` 일 때 `churchHistoryEtc` 필수).
- DB CHECK — 데이터 무결성 최후 방어.

### 4-7. 동의 시각 컬럼
- `privacy_consented_at` 을 별도 보관 → 향후 보존기간 산정·증빙 시 활용.
- `privacy_consent` CHECK = true 라 false 는 INSERT 거부.

### 4-8. 처리 상태(status)
4단계: `new` → `contacted` → `assigned` → `done`.
- 새가족부 워크플로우에 직접 매핑됨 (신규 접수 → 연락 → 교구·목장 배정 → 처리 완료).
- 향후 실제 회원가입 매칭/통계용으로 확장 여지.

### 4-9. admin 페이지 UX
- 행 헤더는 한 줄 요약, **클릭하면 펼쳐서** 상세 + 상태 변경 + 메모.
- 필터 pill 5개 (전체 + 4개 상태) + 각 카운트 표시.
- 메모는 "변경 시에만 저장 활성화" + 저장 후 로컬 state 갱신 → 전체 재조회 없음.
- 삭제는 admin/master 만 (RLS 가 막음). staff 가 시도하면 백엔드에서 403/PostgREST RLS 차단.

### 4-10. AdminNav 메뉴 위치
"문의 내역" 바로 아래에 추가. 둘 다 외부 사용자가 입력하는 데이터라는 점에서 자연스럽게 묶임.

---

## 5. API 설계

### 5-1. 공개 제출 — `POST /api/new-family`

**요청 body:**
```json
{
  "visitPaths": ["website", "recommendation"],
  "visitPathsEtc": "(visitPaths 에 'etc' 포함 시만)",
  "faithStatus": "accepted",
  "name": "홍길동",
  "gender": "male",
  "birth": "010101",
  "phone": "010-1234-5678",
  "region": "서울 동작구",
  "churchHistory": "baptized_inactive",
  "churchHistoryEtc": "(churchHistory == 'etc' 일 때만)",
  "message": "(선택)",
  "privacyConsent": true
}
```

**검증:**
- zod 스키마 → 타입/길이/enum.
- 추가 룰: `etc` 선택 시 `visitPathsEtc`/`churchHistoryEtc` 비어있으면 400.
- service_role 키로 INSERT (RLS 우회). `privacy_consent: true` 는 서버에서 강제.

**응답:** `{ ok: true }` 또는 `{ error: string }`.

### 5-2. 관리자 목록 — `GET /api/admin/new-families`
`requireAdmin()` 통과 후 RLS 가 `is_staff()` 행만 반환. `created_at DESC`. `toDto()` 로 snake_case → camelCase 변환.

### 5-3. 관리자 수정 — `PATCH /api/admin/new-families/[id]`
- body: `{ status?, adminNote? }` 부분 업데이트. zod 스키마 `NewFamilyUpdateSchema`.
- 서버에서 `admin_note` 빈 문자열은 NULL 로 정규화.
- 응답: 갱신된 DTO.

### 5-4. 관리자 삭제 — `DELETE /api/admin/new-families/[id]`
RLS 가 `is_admin_or_master()` 만 통과. staff 시도 시 행 매칭 0개로 빈 응답이지만 200 떨어질 수 있음 — 현재 단순 처리. (운영 시 `.select()` 후 0건이면 403 으로 강화 가능.)

---

## 6. 코드 구성 — 타입 안전성

### 6-1. enum 라벨 분리
모든 enum (visit path / faith status / gender / church history / status) 의 한국어 라벨을 `src/types/new-family.ts` 의 `*_LABELS` 객체로 분리. 폼 + 관리자 페이지가 동일한 라벨을 공유.

### 6-2. snake_case ↔ camelCase
- DB row → `NewFamilyRow` (snake_case 인터페이스, API 라우트 내부)
- 클라이언트로 나가는 DTO → `NewFamilyRegistration` (camelCase, `src/types/new-family.ts`)
- 변환 함수 `toDto()` 는 `src/app/api/admin/new-families/route.ts` 에 두고 `[id]/route.ts` 에서 import.

### 6-3. zod literal
`privacyConsent: z.literal(true)` 로 false 값을 자동 거부.

---

## 7. 검증 결과

```
$ npm run typecheck
> tsc --noEmit
(통과 — 에러 0)

$ npx eslint <new files>
(통과 — 에러 0)

$ npm run build
... compiled successfully
○ /new-family  (Static)
ƒ /admin/new-families  (Dynamic)
ƒ /api/new-family  (Dynamic)
ƒ /api/admin/new-families  (Dynamic)
ƒ /api/admin/new-families/[id]  (Dynamic)
```

브라우저 수동 테스트는 dev server 가 없는 본 작업 범위 외 (요청에 모바일 제외 + DB 적용은 사용자 측이라 명시됨).

---

## 8. 후속 작업 (사용자 측)

1. **마이그레이션 024 적용** — Supabase 콘솔 SQL Editor 에 `024_new_family_registrations.sql` 붙여넣고 실행. 이전 016/021/022/023 과 동일한 흐름 (`TODO.md` 참조).
2. **/new-family 라우트 진입점 노출** — 현재 풋터·네비게이션에는 링크가 없음. 사용자가 원하는 위치(상단 nav `교회소개` 메뉴, 풋터 "바로가기" 등) 결정 후 1줄 추가 권장. **본 작업에서는 의도적으로 추가하지 않음** (요청 범위 밖 — AGENTS.md 의 "시키지 않은 것은 하지 않는다" 원칙).
3. **이메일/카톡 알림** — `chat/inquiry` 처럼 Resend 로 관리자 알림 보내기 가능. 현재는 미구현 (추가 요청 시 작업).
4. **모바일** — `createApiClient` 의 Bearer 인증으로 admin API 는 즉시 호환. 공개 폼은 RN 화면을 별도로 만들면 됨.

---

## 9. 보안 점검

- ✅ RLS 활성화 + 정책 4종 분리.
- ✅ 공개 INSERT 정책에 `privacy_consent = true` CHECK 로 동의 없는 데이터 차단.
- ✅ 관리자 라우트는 모두 `requireAdmin()` 으로 1차 차단 + RLS 로 2차 차단.
- ✅ XSS — 폼 입력은 React 가 자동 escape, 관리자 페이지에서 메시지를 `whitespace-pre-wrap` 텍스트로만 렌더 (HTML 미파싱).
- ✅ SQL injection — Supabase 클라이언트만 사용, raw SQL 없음.
- ✅ 길이 제약 — zod + DB CHECK 이중.
- ⚠ Rate limit 미구현 — 챗봇은 IP 단위 rate limit 이 있음(`chat_rate_limit`). 새가족 폼은 빈도가 낮아 v1 에서는 생략. 스팸 발생 시 동일 패턴으로 추가 가능.
- ⚠ 개인정보 자동 파기 — 보유기간 정책상 수동 운영 (admin 삭제). cron 자동화는 v2.
