# 새가족 등록 폼 구현 계획

> 작성일: 2026-05-02
> 범위: 웹 전용 (모바일 앱은 백엔드 무수정 호환을 전제로 설계)
> 전제: Next.js 16.2.2 App Router + Supabase + 기존 admin/RLS 패턴 그대로 유지

## 진행 상태

- [x] PLAN 작성
- [x] Step 1: 마이그레이션 024 (`new_family_registrations` 테이블 + RLS + 트리거)
- [x] Step 2: 타입 + 라벨 매핑 (`src/types/new-family.ts`)
- [x] Step 3: Validation (`NewFamilyRegistrationSchema`, `NewFamilyUpdateSchema`)
- [x] Step 4: 공개 제출 API (`POST /api/new-family`)
- [x] Step 5: 관리자 API (`GET/PATCH/DELETE /api/admin/new-families/*`)
- [x] Step 6: 공개 페이지 (`/new-family` + `NewFamilyForm`)
- [x] Step 7: 개인정보 처리방침 본문 분리
- [x] Step 8: 관리자 페이지 (`/admin/new-families`) + AdminNav 메뉴 추가
- [x] Step 9: 진입점 노출 (`교회소개` 메뉴 + 풋터 `바로가기`)
- [x] typecheck + build 검증
- [x] research.md 보고서
- [x] 문서 최신화 (DB_SCHEMA.md / API_SPEC.md / ARCHIT.md)
- [ ] 마이그레이션 024 운영 DB 적용 (사용자 측 작업 — Supabase SQL Editor)

---

## 목표

1. **자유로운 새가족 신청 접수** — 9문항 + 개인정보 동의를 거친 익명 제출
2. **관리자 워크플로우** — 신규/연락완료/교구배정/완료 4단계 상태 관리 + 메모 + 삭제
3. **개인정보 적법성** — 동의 시각 컬럼 보관, 보호법 30조 준수 본문 게재, "침례교가 아니므로 침례 → 세례" 기관 정합화
4. **모바일 앱 호환** — `/api/new-family`, `/api/admin/new-families/*` DTO 가 추후 RN 앱에서 그대로 재사용 가능. Bearer 토큰 인증 자동 지원
5. **중복 추상화 회피** — 기존 `chat_inquiries`(006) / `event_subscribers`(023) 패턴을 답습. 새 헬퍼/추상화 도입 0건

---

## 설계 원칙

1. **DTO 안정성** — 클라이언트 응답은 camelCase DTO 로 일관 (snake_case 컬럼명 노출 금지). API 라우트 내부에서 `toDto()` 1회 변환. 모바일 앱은 DTO 모양만 의존하면 됨.
2. **3계층 검증** — (a) 클라이언트 폼 즉시 피드백, (b) 서버 zod 스키마 + 기타 옵션 룰, (c) DB CHECK + RLS. 어느 한 층이 우회되어도 다음 층이 막음.
3. **익명 INSERT, 권한 SELECT** — `chat_inquiries` 와 동일한 RLS 패턴. INSERT 정책 `with check (true)`, SELECT 는 `is_staff()`. 신청자는 회원이 아님.
4. **service_role 로 서버 INSERT** — 익명 제출이지만 안정성을 위해 API 라우트에서 service_role 키를 사용 (`/api/chat/inquiry` 와 동일). 클라이언트가 RLS 정책을 우회할 수 있는 경로는 없음.
5. **권한 모델은 015/019 헬퍼 재사용** — `is_staff()`, `is_admin_or_master()` 그대로 호출. 신규 함수 0개.
6. **외부 라이브러리 회피** — 폼은 React 표준 input + zod. 기존 메모리 선호도(외부 lib 회피) 준수.
7. **타입 엄격** — `any` / `unknown` 금지 (DB row 만 명시 인터페이스 → DTO 변환). enum 은 `as const` 배열 + `Record<EnumKey, Label>` 라벨.
8. **시키지 않은 것은 손대지 않음** — `/new-family` 라우트의 진입점(네비게이션·풋터·홈) 노출은 **의도적으로 하지 않음**. 사용자가 위치를 정해줄 때 별도 작업.

---

## 현재 코드베이스 분석

### 답습할 기존 패턴

| 패턴 | 참조 파일 | 본 작업에서의 적용 |
|------|----------|-------------------|
| 익명 INSERT + admin SELECT 테이블 | `supabase/migrations/006_chat_inquiries.sql` | 마이그레이션 024 RLS |
| service_role 기반 익명 제출 라우트 | `src/app/api/chat/inquiry/route.ts` | `src/app/api/new-family/route.ts` |
| API 라우트 권한 검증 | `src/lib/admin-auth.ts:requireAdmin` | `/api/admin/new-families/*` |
| 듀얼 인증 (cookie + Bearer) | `src/lib/supabase/api.ts:createApiClient` | admin API — 모바일 자동 호환 |
| 영속 데이터 admin 페이지 | `src/app/admin/event-subscribers/page.tsx` | `src/app/admin/new-families/page.tsx` (필터 pill + 펼침 행) |
| useEffect set-state-in-effect 회피 | `event-subscribers/page.tsx` 의 inline fetch + cancelled flag | `admin/new-families/page.tsx` |
| zod 검증 집약 | `src/lib/validation.ts` | `NewFamilyRegistrationSchema`, `NewFamilyUpdateSchema` 추가 |
| AdminNav 아이콘 키 시스템 | `src/app/admin/AdminNav.tsx` | `newFamily` 키 + `UserPlus` 매핑 |
| 공개 페이지 셸 | `src/app/(public)/notice/page.tsx`, `Container`, `PageHeader` | `(public)/new-family/page.tsx` |
| 개인정보 본문 정합화 | `src/components/layout/Footer.tsx` 의 `msvch01@naver.com`, `02-534-0691` | `privacy-policy.ts` |

### 기존 RLS 헬퍼 (재사용)

| 함수 | 정의 위치 | 본 작업 사용처 |
|------|----------|---------------|
| `public.is_staff()` | 마이그레이션 015 | SELECT/UPDATE 정책 |
| `public.is_admin_or_master()` | 마이그레이션 019 | DELETE 정책 |

신규 RLS 헬퍼 도입 없음.

---

## 변경 파일 목록

### 신규

| 파일 | 역할 |
|------|------|
| `supabase/migrations/024_new_family_registrations.sql` | 테이블 + RLS + `updated_at` 트리거 |
| `src/types/new-family.ts` | DTO + enum + 라벨 매핑 (폼·관리자 공용) |
| `src/app/api/new-family/route.ts` | `POST` — 공개 익명 제출 (service_role) |
| `src/app/api/admin/new-families/route.ts` | `GET` 목록 + 공용 `toDto()` |
| `src/app/api/admin/new-families/[id]/route.ts` | `PATCH` 상태/메모, `DELETE` |
| `src/app/(public)/new-family/page.tsx` | 페이지 셸 (서버 컴포넌트) |
| `src/app/(public)/new-family/NewFamilyForm.tsx` | 폼 (클라이언트 컴포넌트) |
| `src/app/(public)/new-family/privacy-policy.ts` | 개인정보 처리방침 정적 상수 |
| `src/app/admin/new-families/page.tsx` | 관리자 페이지 |

### 수정

| 파일 | 변경 |
|------|------|
| `src/lib/validation.ts` | `NewFamilyRegistrationSchema`, `NewFamilyUpdateSchema` 추가 |
| `src/app/admin/AdminNav.tsx` | `AdminIconKey` 에 `newFamily` 추가 + `UserPlus` 매핑 |
| `src/app/admin/layout.tsx` | `baseNav` 에 "새가족 등록" 메뉴 항목 추가 |
| `src/components/layout/nav-config.ts` | `교회소개` 서브메뉴에 "새가족 등록" 추가 (인사말 다음) |
| `src/components/layout/Footer.tsx` | `바로가기` 섹션에 "새가족 등록" 추가 |

---

## Step 1 — 마이그레이션 024

### `supabase/migrations/024_new_family_registrations.sql`

DB 가 진실의 원천. 길이 제약과 enum 값 무결성은 CHECK 로 한 번 더 못박는다.

```sql
CREATE TABLE IF NOT EXISTS public.new_family_registrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 1. 방문 경로 (복수 선택)
  visit_paths             text[] NOT NULL DEFAULT '{}',
  visit_paths_etc         text,
  -- 2. 예수님 영접 여부
  faith_status            text NOT NULL CHECK (faith_status IN ('accepted','not_yet','unsure')),
  -- 3-7. 인적사항
  name                    text NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  gender                  text NOT NULL CHECK (gender IN ('male','female')),
  birth                   text NOT NULL CHECK (length(birth) BETWEEN 1 AND 40),
  phone                   text NOT NULL CHECK (length(phone) BETWEEN 9 AND 20),
  region                  text CHECK (region IS NULL OR length(region) <= 100),
  -- 8. 신앙생활 여부
  church_history          text NOT NULL CHECK (church_history IN (
    'never','attended_no_baptism','baptized_inactive','baptized_active','etc'
  )),
  church_history_etc      text,
  -- 9. 자유 메시지
  message                 text CHECK (message IS NULL OR length(message) <= 2000),
  -- 개인정보 동의
  privacy_consent         boolean NOT NULL CHECK (privacy_consent = true),
  privacy_consented_at    timestamptz NOT NULL DEFAULT now(),
  -- 처리 상태
  status                  text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','assigned','done')),
  admin_note              text CHECK (admin_note IS NULL OR length(admin_note) <= 2000),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_family_registrations_status
  ON public.new_family_registrations (status);
CREATE INDEX IF NOT EXISTS idx_new_family_registrations_created_at
  ON public.new_family_registrations (created_at DESC);

ALTER TABLE public.new_family_registrations ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT (공개 폼)
CREATE POLICY "Anyone can submit new family" ON public.new_family_registrations
  FOR INSERT WITH CHECK (true);

-- staff 만 SELECT
CREATE POLICY "Staff can read new family" ON public.new_family_registrations
  FOR SELECT USING (public.is_staff());

-- staff 만 UPDATE
CREATE POLICY "Staff can update new family" ON public.new_family_registrations
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- admin/master 만 DELETE
CREATE POLICY "Admin can delete new family" ON public.new_family_registrations
  FOR DELETE USING (public.is_admin_or_master());

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.new_family_registrations_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_family_registrations_updated_at
  BEFORE UPDATE ON public.new_family_registrations
  FOR EACH ROW EXECUTE FUNCTION public.new_family_registrations_set_updated_at();
```

**왜 이 컬럼 구성인가:**
- `visit_paths`(text[]) + `visit_paths_etc`(text) — 복수 선택 + 기타. 정규화 테이블 분리는 과설계.
- `birth`(text) — "010101" 또는 "음력 010101" 자유 텍스트 허용. date 타입은 음력/연도 추정 정보를 잃음.
- `phone`(text) — 9~20자. `event_subscribers`(023) 와 동일한 정책. 사용자 친숙도 우선해 `010-XXXX-XXXX` 표시 형태로 저장.
- `privacy_consent` CHECK 필수 true — false 가 들어오면 DB 단에서 거부.
- `privacy_consented_at` 별도 — 향후 보존기간 산정·증빙용.
- `status` enum — 새가족부 워크플로우 4단계.

---

## Step 2 — 타입 + 라벨 매핑

### `src/types/new-family.ts`

DB row 와 무관하게 **클라이언트가 의존할 안정 인터페이스**. 모바일 앱이 그대로 임포트해도 무방하도록 enum 라벨까지 포함.

```ts
export type NewFamilyVisitPath =
  | "website" | "youtube" | "recommendation" | "visited_first" | "etc";

export type NewFamilyFaithStatus = "accepted" | "not_yet" | "unsure";
export type NewFamilyGender = "male" | "female";
export type NewFamilyChurchHistory =
  | "never" | "attended_no_baptism" | "baptized_inactive" | "baptized_active" | "etc";
export type NewFamilyStatus = "new" | "contacted" | "assigned" | "done";

/** 공개 폼 → 서버 전송 페이로드 */
export interface NewFamilyRegistrationInput {
  visitPaths: NewFamilyVisitPath[];
  visitPathsEtc?: string;
  faithStatus: NewFamilyFaithStatus;
  name: string;
  gender: NewFamilyGender;
  birth: string;
  phone: string;
  region?: string;
  churchHistory: NewFamilyChurchHistory;
  churchHistoryEtc?: string;
  message?: string;
  privacyConsent: true;
}

/** admin UI / DB row → DTO (camelCase) */
export interface NewFamilyRegistration {
  id: string;
  visitPaths: NewFamilyVisitPath[];
  visitPathsEtc: string | null;
  faithStatus: NewFamilyFaithStatus;
  name: string;
  gender: NewFamilyGender;
  birth: string;
  phone: string;
  region: string | null;
  churchHistory: NewFamilyChurchHistory;
  churchHistoryEtc: string | null;
  message: string | null;
  privacyConsent: boolean;
  privacyConsentedAt: string;
  status: NewFamilyStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 한국어 라벨 — 폼·관리자 공유 */
export const VISIT_PATH_LABELS: Record<NewFamilyVisitPath, string> = {
  website: "웹사이트 검색을 통해서",
  youtube: "유튜브 검색을 통해서",
  recommendation: "지인의 추천에 의해서",
  visited_first: "직접 방문해 본 후에 새가족으로 등록하고 싶어서",
  etc: "기타",
};

// FAITH_STATUS_LABELS / GENDER_LABELS / CHURCH_HISTORY_LABELS / STATUS_LABELS 동일 패턴
```

**모바일 호환 포인트:**
- 모바일은 `NewFamilyRegistrationInput` 그대로 직렬화해서 `POST /api/new-family` 보내면 됨.
- `NewFamilyRegistration` 은 `GET /api/admin/new-families` 응답 그대로.
- 침례→세례 라벨 변경은 라벨 객체 한 줄만 고치면 됨.

---

## Step 3 — Validation

### `src/lib/validation.ts` 에 추가

기존 파일 하단(`EventSubscriberSchema` 위)에 삽입.

```ts
/** 새가족 등록 폼 (공개 페이지 → POST /api/new-family) */
export const NewFamilyRegistrationSchema = z.object({
  visitPaths: z
    .array(z.enum(["website","youtube","recommendation","visited_first","etc"]))
    .max(5),
  visitPathsEtc: z.string().max(200).optional(),
  faithStatus: z.enum(["accepted","not_yet","unsure"]),
  name: z.string().min(1, "이름을 입력하세요").max(50),
  gender: z.enum(["male","female"]),
  birth: z.string().min(1, "생년월일을 입력하세요").max(40),
  phone: z.string().min(1, "연락처를 입력하세요").max(20),
  region: z.string().max(100).optional(),
  churchHistory: z.enum(["never","attended_no_baptism","baptized_inactive","baptized_active","etc"]),
  churchHistoryEtc: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  privacyConsent: z.literal(true, {
    message: "개인정보 수집 및 이용에 동의해야 합니다.",
  }),
});

/** PATCH /api/admin/new-families/[id] */
export const NewFamilyUpdateSchema = z.object({
  status: z.enum(["new","contacted","assigned","done"]).optional(),
  adminNote: z.string().max(2000).optional(),
});
```

`z.literal(true)` 로 `privacyConsent: false` 자동 거부. `etc` 선택 시 기타 입력 강제는 라우트 핸들러에서 추가 검증 (zod refine 으로도 가능하지만 핸들러 단에서 명시적인 게 가독성↑).

---

## Step 4 — 공개 제출 API

### `src/app/api/new-family/route.ts`

`/api/chat/inquiry` 와 동일한 골격: zod → service_role → INSERT.

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NewFamilyRegistrationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = NewFamilyRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // etc 선택 시 직접 입력 강제
  if (data.visitPaths.includes("etc") && !data.visitPathsEtc?.trim()) {
    return NextResponse.json(
      { error: "방문 경로 '기타'는 직접 입력 내용이 필요합니다." },
      { status: 400 },
    );
  }
  if (data.churchHistory === "etc" && !data.churchHistoryEtc?.trim()) {
    return NextResponse.json(
      { error: "신앙생활 '기타'는 직접 입력 내용이 필요합니다." },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("new_family_registrations").insert({
    visit_paths: data.visitPaths,
    visit_paths_etc: data.visitPaths.includes("etc")
      ? data.visitPathsEtc?.trim() ?? null : null,
    faith_status: data.faithStatus,
    name: data.name.trim(),
    gender: data.gender,
    birth: data.birth.trim(),
    phone: data.phone.trim(),
    region: data.region?.trim() || null,
    church_history: data.churchHistory,
    church_history_etc: data.churchHistory === "etc"
      ? data.churchHistoryEtc?.trim() ?? null : null,
    message: data.message?.trim() || null,
    privacy_consent: true, // 서버에서 강제 (zod literal 통과한 경우만 도달)
  });

  if (error) {
    console.error("new-family insert error", error);
    return NextResponse.json(
      { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
```

**모바일 호환 포인트:**
- 인증 헤더 불필요(익명 INSERT).
- 응답 `{ ok: true }` / `{ error: string }` 단순 형태 — 모바일에서도 동일하게 처리.

---

## Step 5 — 관리자 API

### `src/app/api/admin/new-families/route.ts`

`requireAdmin(request)` 으로 cookie/Bearer 양쪽 인증. RLS 가 한 번 더 검증.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import type {
  NewFamilyRegistration, NewFamilyVisitPath, NewFamilyFaithStatus,
  NewFamilyGender, NewFamilyChurchHistory, NewFamilyStatus,
} from "@/types/new-family";

export const dynamic = "force-dynamic";

interface NewFamilyRow {
  id: string;
  visit_paths: NewFamilyVisitPath[];
  visit_paths_etc: string | null;
  faith_status: NewFamilyFaithStatus;
  name: string;
  gender: NewFamilyGender;
  birth: string;
  phone: string;
  region: string | null;
  church_history: NewFamilyChurchHistory;
  church_history_etc: string | null;
  message: string | null;
  privacy_consent: boolean;
  privacy_consented_at: string;
  status: NewFamilyStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

// snake_case → camelCase 1회 변환
export function toDto(row: NewFamilyRow): NewFamilyRegistration {
  return {
    id: row.id,
    visitPaths: row.visit_paths ?? [],
    visitPathsEtc: row.visit_paths_etc,
    faithStatus: row.faith_status,
    name: row.name,
    gender: row.gender,
    birth: row.birth,
    phone: row.phone,
    region: row.region,
    churchHistory: row.church_history,
    churchHistoryEtc: row.church_history_etc,
    message: row.message,
    privacyConsent: row.privacy_consent,
    privacyConsentedAt: row.privacy_consented_at,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = "id, visit_paths, visit_paths_etc, faith_status, name, gender, birth, phone, region, church_history, church_history_etc, message, privacy_consent, privacy_consented_at, status, admin_note, created_at, updated_at";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("new_family_registrations")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("new-families list error", error);
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
    return NextResponse.json(((data ?? []) as NewFamilyRow[]).map(toDto));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
```

### `src/app/api/admin/new-families/[id]/route.ts`

PATCH 는 부분 업데이트, DELETE 는 RLS 가 admin/master 차단.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { requireAdmin, AuthError } from "@/lib/admin-auth";
import { NewFamilyUpdateSchema } from "@/lib/validation";
import { toDto } from "../route";

export const dynamic = "force-dynamic";

const SELECT_COLS = /* 위와 동일 */;
type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const parsed = NewFamilyUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.adminNote !== undefined) {
      update.admin_note = parsed.data.adminNote.trim() || null;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
    }

    const supabase = await createApiClient(request);
    const { data, error } = await supabase
      .from("new_family_registrations")
      .update(update).eq("id", id)
      .select(SELECT_COLS).single();
    if (error || !data) {
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    return NextResponse.json(toDto(data as Parameters<typeof toDto>[0]));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const supabase = await createApiClient(request);
    const { error } = await supabase
      .from("new_family_registrations").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
```

**모바일 호환 포인트:**
- `createApiClient(request)` 가 `Authorization: Bearer <jwt>` 자동 인식 → 모바일 앱은 Supabase JS 의 `session.access_token` 만 헤더에 실으면 동일 라우트 사용.
- 응답 DTO 가 camelCase 로 통일돼 RN UI 가 그대로 렌더링.

---

## Step 6 — 공개 페이지

### `src/app/(public)/new-family/page.tsx`

서버 컴포넌트는 메타데이터 + 셸만. 폼은 클라이언트로 분리.

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewFamilyForm } from "./NewFamilyForm";

export const metadata: Metadata = {
  title: "새가족 등록",
  description: "명성비전교회 새가족 등록 페이지입니다. 환영합니다.",
};

export default function NewFamilyPage() {
  return (
    <>
      <PageHeader
        title="새가족 등록"
        description="명성비전교회를 찾아주신 여러분을 환영합니다."
      />
      <Container className="py-10">
        <div className="mx-auto max-w-2xl">
          <NewFamilyForm />
        </div>
      </Container>
    </>
  );
}
```

빌드 결과: `○ /new-family (Static)` — 정적 생성됨.

### `src/app/(public)/new-family/NewFamilyForm.tsx`

폼 핵심부.

```tsx
"use client";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  type NewFamilyVisitPath, type NewFamilyFaithStatus,
  type NewFamilyGender, type NewFamilyChurchHistory,
  VISIT_PATH_LABELS, FAITH_STATUS_LABELS, CHURCH_HISTORY_LABELS,
} from "@/types/new-family";
import { PRIVACY_POLICY_TEXT } from "./privacy-policy";

type SubmitState = "idle" | "submitting" | "done";

export function NewFamilyForm() {
  const [consent, setConsent] = useState(false);
  const [visitPaths, setVisitPaths] = useState<NewFamilyVisitPath[]>([]);
  const [visitPathsEtc, setVisitPathsEtc] = useState("");
  const [faithStatus, setFaithStatus] = useState<NewFamilyFaithStatus | "">("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<NewFamilyGender | "">("");
  const [birth, setBirth] = useState("");
  // 전화번호: 사용자 친숙도를 위해 3분할
  const [phone1, setPhone1] = useState("010");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");
  const [region, setRegion] = useState("");
  const [churchHistory, setChurchHistory] = useState<NewFamilyChurchHistory | "">("");
  const [churchHistoryEtc, setChurchHistoryEtc] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) { setError("개인정보 수집 및 이용에 동의해 주세요."); return; }
    if (visitPaths.length === 0) { setError("방문 경로를 한 가지 이상 선택해 주세요."); return; }
    if (visitPaths.includes("etc") && !visitPathsEtc.trim()) {
      setError("방문 경로 '기타'에 직접 입력해 주세요."); return;
    }
    // ... 나머지 필수 검증 ...
    const phone = `${phone1}-${phone2}-${phone3}`;
    if (!/^010-\d{3,4}-\d{4}$/.test(phone)) {
      setError("연락처를 010-XXXX-XXXX 형식으로 입력해 주세요."); return;
    }

    setState("submitting");
    const res = await fetch("/api/new-family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitPaths,
        visitPathsEtc: visitPaths.includes("etc") ? visitPathsEtc.trim() : undefined,
        faithStatus, name: name.trim(), gender, birth: birth.trim(), phone,
        region: region.trim() || undefined,
        churchHistory,
        churchHistoryEtc: churchHistory === "etc" ? churchHistoryEtc.trim() : undefined,
        message: message.trim() || undefined,
        privacyConsent: true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      setState("idle"); return;
    }
    setState("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-green-100 bg-white p-10 text-center shadow-sm">
        <CheckCircle2 size={56} className="mx-auto mb-4 text-green-500" />
        <h2 className="text-xl font-semibold text-gray-900">등록이 완료되었습니다.</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          새가족부에서 곧 입력하신 연락처로 안내드리겠습니다.<br />
          명성비전교회를 찾아주셔서 감사합니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <Section title="개인정보 수집 및 이용 동의" required>
        <div className="h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          {PRIVACY_POLICY_TEXT}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={consent}
            onChange={(e) => setConsent(e.target.checked)} />
          <span><strong>[필수]</strong> 개인정보 수집 및 이용에 동의합니다.</span>
        </label>
      </Section>

      {/* 1. 방문 경로 (체크박스 복수) — VISIT_PATH_LABELS 매핑 */}
      {/* 2. 영접 여부 (라디오) — FAITH_STATUS_LABELS */}
      {/* 3. 이름 (text) */}
      {/* 4. 성별 (라디오) */}
      {/* 5. 생년월일 (text — 음력 포함 자유 형식) */}
      {/* 6. 연락처 (3분할 input + 정규식 검증) */}
      {/* 7. 거주 지역 (text, 선택) */}
      {/* 8. 신앙생활 여부 (라디오) — CHURCH_HISTORY_LABELS, 'etc' 시 직접입력 */}
      {/* 9. 메시지 (textarea, 선택) */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button type="submit" disabled={state === "submitting"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
        {state === "submitting" && <Loader2 size={18} className="animate-spin" />}
        등록 신청
      </button>
    </form>
  );
}
```

**전화번호 분할 입력의 안전장치:**
```tsx
onChange={(e) => setPhone1(e.target.value.replace(/\D/g, "").slice(0, 3))}
```
숫자 외 입력 자동 제거 + 길이 자동 잘림.

---

## Step 7 — 개인정보 처리방침 본문 분리

### `src/app/(public)/new-family/privacy-policy.ts`

폼·관리자·향후 PDF 출력에서도 재사용 가능하도록 정적 상수.

```ts
export const PRIVACY_POLICY_TEXT = `본 방침은 「개인정보 보호법」 제30조에 따라 명성비전교회(이하 "교회")가 운영하는 웹사이트 https://msvch.vercel.app (이하 "사이트")에서 처리하는 개인정보의 보호 및 권익 보호와 고충 처리 절차를 규정함을 목적으로 합니다.

제1조 (개인정보의 처리 목적)
... (생략) — 본문 내 모든 "침례"는 "세례"로 대체

제4조 (개인정보 처리의 위탁)
- Vercel Inc. : 사이트 호스팅·시스템 운영
- 카카오톡 : 알림톡·문자 발송
... 

제10조 (개인정보 보호책임자)
- 개인정보 보호책임자 : 담임 목사
- 연락처 : msvch01@naver.com / 02-534-0691
...
제12조 (개인정보 처리방침 변경)
이 방침은 2026년 5월 2일부터 적용됩니다. ...`;
```

**원문 대비 변경점:**
- 사이트 URL: `yulinuri.org` → `https://msvch.vercel.app`
- 위탁업체: ㈜아임웹 → Vercel Inc.
- 보호책임자 연락처: 푸터의 `msvch01@naver.com` / `02-534-0691` 로 통일
- "침례" → "세례" 전수 치환 (요청)
- 시행일: 2026-05-02 (오늘)
- 수집 항목 6조 — 실제 수집 항목과 일치하도록 정리

---

## Step 8 — 관리자 페이지 + Nav 메뉴

### `src/app/admin/AdminNav.tsx` 수정

```ts
import { /* 기존 */, UserPlus, type LucideIcon } from "lucide-react";

export type AdminIconKey =
  | "dashboard" | "notices" | "weeklies" | "masters" | "gallery"
  | "calendar" | "sermons" | "shorts" | "inquiries" | "members"
  | "subscribers" | "newFamily";

const ICONS: Record<AdminIconKey, LucideIcon> = {
  /* 기존 */, newFamily: UserPlus,
};
```

### `src/app/admin/layout.tsx` 의 `baseNav` 수정

```ts
const baseNav: AdminNavItem[] = [
  // 기존 항목들
  { label: "문의 내역", href: "/admin/inquiries", icon: "inquiries" },
  { label: "새가족 등록", href: "/admin/new-families", icon: "newFamily" },
];
```

### `src/app/admin/new-families/page.tsx`

`event-subscribers/page.tsx` 의 인라인 fetch + cancelled flag 패턴.

```tsx
"use client";
import { useEffect, useState } from "react";
import { Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  type NewFamilyRegistration, type NewFamilyStatus,
  VISIT_PATH_LABELS, FAITH_STATUS_LABELS, GENDER_LABELS,
  CHURCH_HISTORY_LABELS, STATUS_LABELS,
} from "@/types/new-family";

const STATUS_KEYS: NewFamilyStatus[] = ["new", "contacted", "assigned", "done"];

const STATUS_BADGE: Record<NewFamilyStatus, string> = {
  new: "bg-rose-50 text-rose-700",
  contacted: "bg-amber-50 text-amber-700",
  assigned: "bg-blue-50 text-blue-700",
  done: "bg-gray-100 text-gray-600",
};

export default function AdminNewFamiliesPage() {
  const [items, setItems] = useState<NewFamilyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NewFamilyStatus | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // set-state-in-effect 회피: cancelled 플래그 + .finally
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/new-families", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<NewFamilyRegistration[]>) : null))
      .then((data) => { if (!cancelled && data) setItems(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function changeStatus(id: string, status: NewFamilyStatus) {
    const res = await fetch(`/api/admin/new-families/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { alert("상태 변경 실패"); return; }
    const updated = (await res.json()) as NewFamilyRegistration;
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  async function saveNote(id: string, note: string) { /* PATCH adminNote, 동일 패턴 */ }
  async function remove(id: string) { /* confirm → DELETE → 로컬 필터 */ }

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((i) => i.status === "new").length,
    contacted: items.filter((i) => i.status === "contacted").length,
    assigned: items.filter((i) => i.status === "assigned").length,
    done: items.filter((i) => i.status === "done").length,
  };

  return (
    <div>
      <h1>새가족 등록</h1>
      {/* 필터 pill (전체 + 4개 상태) */}
      <div className="mb-5 flex flex-wrap gap-2">
        <FilterPill label={`전체 ${counts.all}`} active={filter === "all"} onClick={() => setFilter("all")} />
        {STATUS_KEYS.map((s) => (
          <FilterPill key={s} label={`${STATUS_LABELS[s]} ${counts[s]}`}
            active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>
      {/* 리스트: 행 클릭 → 펼침. 펼침 영역에 상세/상태버튼/메모/삭제 */}
    </div>
  );
}
```

**UX 결정:**
- 행 헤더는 [상태 뱃지 | 이름 | 성별·생년 | 등록 시각]. 클릭으로 펼침.
- 펼침 영역에 9문항 전체 + 상태 4버튼 + 메모 textarea + 저장/삭제.
- 상태 변경/메모 저장 시 **전체 재조회 없이** 응답 DTO 로 로컬 state 만 갱신 (네트워크 1회).
- 메모는 dirty(변경됨) 상태일 때만 "저장" 버튼 활성화.

---

## Step 9 — 진입점 노출

방문자가 `/new-family` 라우트에 도달할 수 있는 경로 2곳 추가.

### `src/components/layout/nav-config.ts` — 데스크톱/모바일 공통 상단 메뉴

`교회소개` 드롭다운의 "인사말" 다음에 추가. 새가족이 가장 먼저 찾는 항목이라 상단 위치.

```ts
{
  label: "교회소개",
  href: "/greetings",
  children: [
    { label: "인사말", href: "/greetings" },
    { label: "새가족 등록", href: "/new-family" },  // 추가
    { label: "공지사항", href: "/notice", badgeKey: "notices" },
    // ...
  ],
},
```

### `src/components/layout/Footer.tsx` — 풋터 `바로가기`

```tsx
{[
  { href: "/notice", label: "공지사항" },
  { href: "/sermons", label: "설교 영상" },
  { href: "/gallery", label: "갤러리" },
  { href: "/new-family", label: "새가족 등록" },  // 추가
  { href: "/map", label: "오시는 길" },
].map(...)}
```

홈 카드/배너 노출은 디자인 결정 사항이라 v2 로 보류.

---

## 모바일 앱 호환성 — 백엔드 무수정 보장

추후 RN 앱이 본 백엔드를 **수정 없이** 사용 가능한 이유:

| 측면 | 보장 메커니즘 |
|------|--------------|
| 인증 | `createApiClient` 가 `Authorization: Bearer` 자동 인식 → RN 의 `supabase.auth.getSession().access_token` 헤더로 모든 admin 라우트 호출 가능 |
| 응답 형태 | `toDto()` 가 snake_case → camelCase 변환을 1곳에 집중. DB 컬럼명을 노출하지 않으므로 향후 컬럼 rename 도 DTO 만 유지하면 무영향 |
| 입력 형태 | `NewFamilyRegistrationInput` / `NewFamilyUpdateSchema` 가 인터페이스 계약. RN 도 동일 페이로드 직렬화 |
| RLS | `is_staff()` / `is_admin_or_master()` 헬퍼가 JWT 의 `auth.uid()` 만 의존 → 클라이언트 종류 무관 |
| 라벨 | `*_LABELS` 객체를 RN 도 임포트 가능 (TypeScript only — 번들 1KB 미만). 서버에서 enum value 만 받고 라벨은 클라이언트 단 책임 |
| 익명 제출 | `/api/new-family` 는 토큰 불필요 → RN 비로그인 화면에서도 동일 호출 |
| 전화번호 형식 | `010-XXXX-XXXX` 표시 형태로 저장 (DB 저장 형식 안정) → RN 도 동일 정규식 사용 |

**RN 가이드 (참고):**
```ts
// RN 측 예시
const session = (await supabase.auth.getSession()).data.session;
const res = await fetch(`${API_URL}/api/admin/new-families`, {
  headers: { Authorization: `Bearer ${session?.access_token}` },
});
const list: NewFamilyRegistration[] = await res.json();
```

---

## 검증 체크리스트

```
$ npm run typecheck    # ✅ 통과
$ npm run build        # ✅ 통과 (○ /new-family Static, ƒ /admin/new-families Dynamic)
$ npx eslint <new files>  # ✅ 0 error / 0 warning
```

수동 테스트 시나리오 (마이그레이션 적용 후):
1. 비로그인으로 `/new-family` 진입 → 폼 노출 확인
2. 동의 미체크로 제출 → 클라이언트 검증 차단
3. `etc` 선택 후 직접입력 미입력 → 차단
4. 정상 제출 → "등록이 완료되었습니다" 화면 + DB row 1건 추가
5. master 계정으로 `/admin/new-families` 접속 → 목록 표시
6. 상태 4단계 변경 → 뱃지 색 변화 + 카운트 갱신
7. 메모 입력 후 저장 → 새로고침해도 유지
8. 삭제 → confirm → 행 제거

---

## 후속 작업 (사용자 측)

| 작업 | 비고 |
|------|------|
| 마이그레이션 024 적용 | Supabase SQL Editor 에 `024_new_family_registrations.sql` 실행. `TODO.md` 의 016/021/022/023 흐름과 동일 |
| `/new-family` 진입점 | 위치 결정 후 별도 PR (네비 `교회소개` 메뉴, 풋터 "바로가기", 홈 카드 등). AGENTS.md 의 "시키지 않은 것은 하지 않는다" 원칙으로 본 작업 범위에서 제외 |
| 카톡/이메일 알림 | `chat/inquiry` 의 Resend 패턴 답습 가능. 운영 측 요청 시 추가 |
| Rate limit | 챗봇의 `chat_rate_limit`(008) 패턴 참고. 신청 빈도 모니터링 후 필요 시 도입 |
| 자동 파기 | 보유기간 정책 운영 후 cron 으로 자동 삭제 (v2) |
