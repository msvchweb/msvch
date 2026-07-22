# Mobile Digital Bulletin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종이 주보 4면 축소판을 예배별 순서·라이브/지난 영상·예배자료·다음 주 섬김·교회소식으로 구성된 운영 가능한 모바일 디지털 주보로 교체한다.

**Architecture:** 인쇄 컴포넌트는 그대로 두고 `weeklies.mobile_services` JSONB와 `worship_resources` 테이블을 추가한다. 공개 페이지는 Server Component에서 주보와 관계 데이터를 조회하고, 예배 자동 선택·탭·자료 시트만 작은 Client Component 경계로 전달한다. 관리자 주보 폼에는 별도 모바일 편집기와 공용 예배자료 관리 화면을 추가한다.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4, Supabase/Postgres/RLS, Zod 4, Vitest 4.1.10, React Testing Library 16.3.2, jsdom 29.1.1

## Global Constraints

- 코드를 작성하기 전에 설치된 Next.js 가이드 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `06-fetching-data.md`, `10-error-handling.md`, `node_modules/next/dist/docs/01-app/02-guides/videos.md`를 다시 확인한다.
- 인쇄 경로와 `src/components/bulletin/BulletinFront.tsx`, `BulletinBack.tsx`의 잠긴 레이아웃·스타일·구조를 변경하지 않는다.
- 공개 모바일 화면은 최대 800px 중앙 열이며, 가로 스크롤과 고정 높이 잘라내기를 만들지 않는다.
- 클라이언트 경계는 자동 탭 선택, 탭 전환, 자료 시트, 영상 전환에만 둔다. DB 조회는 Server Component 또는 기존 관리자 Supabase 클라이언트 패턴을 따른다.
- 서비스 활성 구간은 KST 기준 시작 15분 전부터 종료 30분 후까지다.
- 자동 선택 우선순위는 활성 구간의 시작 시각 근접도, `primary`, 배열 순서다. 활성 예배가 없으면 오늘의 다음 예배, 이후 기본 예배 순이다.
- 라이브 URL은 YouTube HTTPS URL만, 자료 외부 URL은 HTTPS만 허용한다.
- 사도신경은 초기 자료로 등록한다. 성경·찬송가 전문은 출처와 권리 메모가 있을 때만 활성 저장한다.
- `dangerouslySetInnerHTML`을 사용하지 않는다. 모든 본문은 구조화된 일반 텍스트로 렌더링한다.
- 새 public 테이블에는 RLS와 최소 권한 `GRANT`를 같은 마이그레이션에 포함한다.
- 기존 `mobile_services`가 없거나 유효하지 않으면 기존 주일·수요 데이터, 그 다음 사진형 주보 순으로 폴백한다.
- 기존 홈페이지 전역 레이아웃, 인쇄 주보, 다른 콘텐츠는 수정하지 않는다.

---

## File Structure

### 새 파일

- `vitest.config.ts` — Vitest 별칭과 jsdom 설정
- `src/test/setup.ts` — jest-dom 및 `<dialog>` 테스트 폴리필
- `src/types/mobile-bulletin.ts` — 모바일 예배·순서·자료·관계 데이터 타입
- `src/lib/mobile-bulletin.ts` — 검증 이후 사용하는 순수 도메인 함수와 기존 데이터 어댑터
- `src/lib/mobile-bulletin.test.ts` — 시간 선택, 변환, 날짜 이동, URL 파싱 단위 테스트
- `src/lib/mobile-bulletin-data.ts` — Server Component용 자료·영상 관계 조회
- `src/components/mobile-bulletin/MobileBulletin.tsx` — 공개 서버 경계와 폴백 조합
- `src/components/mobile-bulletin/MobileBulletin.test.tsx` — 디지털 우선·사진·준비 중 폴백 테스트
- `src/components/mobile-bulletin/MobileServiceExperience.tsx` — 예배 헤더·영상·탭·순서 클라이언트 경계
- `src/components/mobile-bulletin/WorshipResourceSheet.tsx` — 접근성 있는 네이티브 dialog 하단 시트
- `src/components/mobile-bulletin/MobileBulletinSections.tsx` — 다음 주 섬김·소식·하단 링크
- `src/components/mobile-bulletin/MobileServiceExperience.test.tsx` — 탭·라이브·자료 시트 상호작용 테스트
- `src/components/mobile-bulletin/MobileBulletinSections.test.tsx` — 빈 섹션 숨김과 소식 기본 펼침 테스트
- `src/components/weekly/masters/WorshipResourceForm.tsx` — 예배자료 단일 항목 검증 폼
- `src/components/weekly/masters/WorshipResourcesEditor.tsx` — 예배자료 목록·검색·저장·비활성화
- `src/components/weekly/masters/WorshipResourceForm.test.tsx` — 전문 권리정보 검증 테스트
- `src/app/admin/masters/worship-resources/page.tsx` — 예배자료 관리자 라우트
- `src/components/weekly/mobile/MobileBulletinEditor.tsx` — 예배·순서 편집 프레젠테이션
- `src/components/weekly/mobile/MobileBulletinEditorLoader.tsx` — 자료·설교 선택 데이터 조회
- `src/components/weekly/mobile/MobileBulletinPreview.tsx` — 공개 컴포넌트를 재사용하는 모바일 미리보기
- `src/components/weekly/mobile/MobileBulletinEditor.test.tsx` — 예배 추가·순서 이동·초안 생성 테스트
- Supabase CLI가 생성하는, 파일명이 `_mobile_digital_bulletin.sql`로 끝나는 타임스탬프 마이그레이션 — 컬럼·자료 테이블·RLS·초기 사도신경

### 수정 파일

- `package.json`, `package-lock.json` — 테스트 도구와 `test` 스크립트
- `src/types/notice.ts` — `Weekly.mobile_services`
- `src/lib/validation.ts` — 모바일 서비스·예배자료 Zod 스키마와 빈 입력 기본값
- `src/app/(public)/weekly/page.tsx` — 최신 디지털 주보와 보관 목록
- `src/app/(public)/weekly/[id]/page.tsx` — 같은 디지털 상세 컴포넌트
- `src/app/admin/masters/page.tsx` — 예배자료 관리 진입점
- `src/components/weekly/WeeklyForm.tsx` — 모바일 주보 탭과 저장 데이터
- `src/components/weekly/WeeklyEditorWithPreview.tsx` — 모바일 탭에서 모바일 미리보기 전환
- `src/app/admin/weeklies/new/page.tsx` — 새 주보용 모바일 일정 재배치
- `src/app/admin/weeklies/[id]/edit/page.tsx` — 기존 모바일 서비스 편집 매핑

---

### Task 1: Test Harness and Mobile Bulletin Domain

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/types/mobile-bulletin.ts`
- Create: `src/lib/mobile-bulletin.ts`
- Create: `src/lib/mobile-bulletin.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/notice.ts`
- Modify: `src/lib/validation.ts`

**Interfaces:**
- Produces: `MobileService`, `MobileServiceItem`, `WorshipResource`, `MobileBulletinRelations`
- Produces: `MobileServiceSchema`, `MobileServicesSchema`, `WorshipResourceInputSchema`
- Produces: `resolveMobileServices(weekly)`, `legacyWeeklyToMobileServices(weekly)`, `createMobileService(type, date)`, `createDefaultMobileServices(date)`, `rebaseMobileServices(services, fromDate, toDate)`, `selectMobileServiceId(services, now)`, `isServiceLive(service, now)`, `extractYouTubeVideoId(url)`, `collectRelationIds(services)`, `collectStoredResourceIds(services)`, `collectStoredVideoIds(services)`

- [ ] **Step 1: Install the pinned test dependencies**

Run:

```powershell
npm.cmd install --save-dev vitest@4.1.10 jsdom@29.1.1 @testing-library/react@16.3.2 @testing-library/dom@10.4.1 @testing-library/jest-dom@6.9.1
```

Expected: exit 0; `package-lock.json` records exact resolved versions. Add `"test": "vitest run"` to `scripts`.

- [ ] **Step 2: Add the Vitest configuration and DOM setup**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
```

- [ ] **Step 3: Write the failing domain tests**

Create `src/lib/mobile-bulletin.test.ts` with deterministic KST fixtures:

```ts
import { describe, expect, it } from "vitest";
import {
  APOSTLES_CREED_RESOURCE_ID,
  collectRelationIds,
  createDefaultMobileServices,
  createMobileService,
  extractYouTubeVideoId,
  isServiceLive,
  legacyWeeklyToMobileServices,
  rebaseMobileServices,
  resolveMobileServices,
  selectMobileServiceId,
} from "@/lib/mobile-bulletin";
import { createEmptyWeeklyInput, MobileServicesSchema } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";
import type { Weekly } from "@/types/notice";

const services: MobileService[] = [
  {
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "",
    liveUrl: "https://www.youtube.com/live/live123",
    videoId: "past123",
    items: [{ id: "creed", label: "신앙고백", summary: "사도신경", assignees: [], emphasized: false, visible: true, resourceId: APOSTLES_CREED_RESOURCE_ID, externalUrl: null }],
  },
  {
    id: "wed",
    type: "wednesday",
    label: "수요예배",
    startsAt: "2026-07-29T19:30:00+09:00",
    endsAt: "2026-07-29T21:00:00+09:00",
    primary: false,
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: null,
    items: [],
  },
];

const legacyWeekly: Weekly = {
  ...createEmptyWeeklyInput(),
  id: "legacy",
  title: "기존 주보",
  date: "2026-07-26",
  created_at: "2026-07-20T00:00:00Z",
  worship_leader: "인도자",
  worship_items: [
    {
      marker: "",
      label: "신앙고백",
      content: "사도신경",
      assignees: [],
      subRows: [],
      emphasize: false,
    },
  ],
  wednesday_service: {
    leader: "인도자",
    scripture: "요한복음 3:16",
    title: "하나님의 사랑",
    pastor: "담임목사",
    hymn: "310장",
    benediction: "담임목사",
  },
  mobile_services: [],
};

describe("selectMobileServiceId", () => {
  it("selects a service from 15 minutes before start through 30 minutes after end", () => {
    expect(selectMobileServiceId(services, new Date("2026-07-25T22:45:00Z"))).toBe("sun");
    expect(isServiceLive(services[0], new Date("2026-07-26T05:00:00Z"))).toBe(true);
    expect(isServiceLive(services[0], new Date("2026-07-25T22:44:59.999Z"))).toBe(false);
    expect(isServiceLive(services[0], new Date("2026-07-26T05:00:00.001Z"))).toBe(false);
  });

  it("selects today's next service, then falls back to the primary service", () => {
    expect(selectMobileServiceId(services, new Date("2026-07-29T08:00:00Z"))).toBe("wed");
    expect(selectMobileServiceId(services, new Date("2026-07-30T03:00:00Z"))).toBe("sun");
  });

  it("compares calendar days in KST across UTC midnight", () => {
    const midnightService: MobileService = {
      ...services[1],
      id: "midnight",
      startsAt: "2026-07-27T00:30:00+09:00",
      endsAt: "2026-07-27T01:30:00+09:00",
    };
    expect(selectMobileServiceId([midnightService], new Date("2026-07-26T15:00:00Z"))).toBe("midnight");
  });
});

it("rebases copied services by the bulletin date delta", () => {
  const shifted = rebaseMobileServices(services, "2026-07-26", "2026-08-02");
  expect(shifted[1].startsAt).toBe("2026-08-05T19:30:00+09:00");
});

it("creates Sunday and Wednesday defaults for a bulletin date", () => {
  const created = createDefaultMobileServices("2026-07-26");
  expect(created.map((service) => service.type)).toEqual(["sunday", "wednesday"]);
  expect(createMobileService("friday", "2026-07-26").startsAt).toBe(
    "2026-07-31T20:30:00+09:00",
  );
});

it("extracts supported YouTube URLs and rejects unrelated hosts", () => {
  expect(extractYouTubeVideoId("https://youtu.be/abc_123-xyZ")).toBe("abc_123-xyZ");
  expect(extractYouTubeVideoId("https://example.com/watch?v=abc")).toBeNull();
});

it("deduplicates relation IDs", () => {
  expect(collectRelationIds(services)).toEqual({
    resourceIds: [APOSTLES_CREED_RESOURCE_ID],
    videoIds: ["past123"],
  });
});

it("maps legacy Sunday and Wednesday content and links the creed", () => {
  const mapped = legacyWeeklyToMobileServices(legacyWeekly);
  expect(mapped.map((service) => service.type)).toEqual(["sunday", "wednesday"]);
  expect(mapped[0].items[0].resourceId).toBe(APOSTLES_CREED_RESOURCE_ID);
});

it("falls back to legacy content when stored mobile JSON is invalid", () => {
  const invalid = {
    ...legacyWeekly,
    mobile_services: [{ id: "broken" }] as unknown as MobileService[],
  };
  expect(resolveMobileServices(invalid).map((service) => service.type)).toEqual([
    "sunday",
    "wednesday",
  ]);
});

it("rejects duplicate IDs, multiple primary services, bad URLs, and reversed time", () => {
  const invalid = structuredClone(services);
  invalid[1].id = invalid[0].id;
  invalid[1].primary = true;
  invalid[1].liveUrl = "http://example.com/live";
  invalid[1].endsAt = invalid[1].startsAt;
  const result = MobileServicesSchema.safeParse(invalid);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "예배 ID가 중복되었습니다",
        "기본 예배는 하나만 지정할 수 있습니다",
        "YouTube HTTPS 라이브 주소만 사용할 수 있습니다",
        "종료 시각은 시작 시각 이후여야 합니다",
      ]),
    );
  }
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/lib/mobile-bulletin.test.ts
```

Expected: FAIL because `@/lib/mobile-bulletin` and the mobile types do not exist.

- [ ] **Step 5: Add the mobile types and validation contracts**

Create `src/types/mobile-bulletin.ts` with these exact public shapes:

```ts
export type MobileServiceType = "sunday" | "wednesday" | "friday" | "other";
export type WorshipResourceKind = "creed" | "hymn" | "scripture" | "text" | "link";

export interface MobileServiceItem {
  id: string;
  label: string;
  summary: string;
  assignees: string[];
  emphasized: boolean;
  visible: boolean;
  resourceId: string | null;
  externalUrl: string | null;
}

export interface MobileService {
  id: string;
  type: MobileServiceType;
  label: string;
  startsAt: string;
  endsAt: string;
  primary: boolean;
  visible: boolean;
  leader: string;
  liveUrl: string | null;
  videoId: string | null;
  items: MobileServiceItem[];
}

export interface WorshipResource {
  id: string;
  kind: WorshipResourceKind;
  title: string;
  reference: string;
  content: string;
  external_url: string | null;
  source_label: string | null;
  rights_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MobileBulletinRelations {
  resourcesById: Record<string, WorshipResource>;
  validVideoIds: string[];
}
```

Add `mobile_services: MobileService[]` to `Weekly` in `src/types/notice.ts`.

In `src/lib/validation.ts`, add schemas with these limits: at most 8 services, 32 items per service, service/item IDs 1–64 characters, `resourceId` UUID, labels 1–60, summaries 500, assignees 8×80, leader 120, video ID pattern `[A-Za-z0-9_-]{6,50}`, URL 2,000. Start/end strings must match exact KST form `YYYY-MM-DDTHH:mm:ss+09:00`. `MobileServicesSchema.superRefine` must reject duplicate service/item IDs, more than one primary service, live hosts outside the exact allowlist `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, non-HTTPS item links, and `endsAt <= startsAt`. Use the exact four Korean messages asserted in Step 3 for the corresponding aggregate checks. Add `mobile_services: MobileServicesSchema.default([])` to `WeeklyContentSchema` and `mobile_services: []` to `createEmptyWeeklyInput()`.

Add and export `WorshipResourceInputSchema` plus `WorshipResourceInput = z.infer<typeof WorshipResourceInputSchema>`. Limits are title 120, reference/source 200, content 30,000, rights note 2,000, and HTTPS URL 2,000; normalize blank nullable fields to `null`. When `kind` is `hymn` or `scripture` and `content.trim()` is non-empty, require non-empty `source_label` and `rights_note`.

- [ ] **Step 6: Implement the pure domain functions**

Create `src/lib/mobile-bulletin.ts`. Use only serializable types and no Supabase imports. Export:

```ts
export const APOSTLES_CREED_RESOURCE_ID = "00000000-0000-4000-8000-000000000001";
export const LIVE_LEAD_MS = 15 * 60 * 1000;
export const LIVE_TAIL_MS = 30 * 60 * 1000;

export function extractYouTubeVideoId(raw: string | null): string | null;
export function createMobileService(type: MobileServiceType, date: string): MobileService;
export function createDefaultMobileServices(date: string): MobileService[];
export function legacyWeeklyToMobileServices(weekly: Weekly): MobileService[];
export function resolveMobileServices(weekly: Weekly): MobileService[];
export function rebaseMobileServices(services: MobileService[], fromDate: string, toDate: string): MobileService[];
export function selectMobileServiceId(services: MobileService[], now: Date): string | null;
export function isServiceLive(service: MobileService, now: Date): boolean;
export function collectRelationIds(services: MobileService[]): { resourceIds: string[]; videoIds: string[] };
export function collectStoredResourceIds(services: MobileService[]): string[];
export function collectStoredVideoIds(services: MobileService[]): string[];
```

Implementation rules:

- Calendar-day addition must use `Date.UTC` and rebuild `YYYY-MM-DDTHH:mm:ss+09:00`, avoiding host timezone drift.
- Same-day selection must derive both calendar dates in `Asia/Seoul`, never from the host timezone or a raw UTC date slice.
- `createMobileService` defaults: Sunday on bulletin date 08:00–13:30, Wednesday +3 days 19:30–21:00, Friday +5 days 20:30–22:00, and other on bulletin date 11:00–12:00. Only Sunday is primary by default; `createDefaultMobileServices` returns Sunday and Wednesday.
- Legacy Sunday uses `worship_leader` as leader and maps non-empty `worship_items` in order. An item whose label or summary contains `신앙고백` or `사도신경` receives `APOSTLES_CREED_RESOURCE_ID`. If no mapped item represents 말씀/설교, append `sermon_title`/`sermon_pastor` as a `말씀` item; if no mapped item represents the closing hymn, append non-empty `closing_hymn` as a `찬송` item.
- Legacy Wednesday is created only when one of its fields is non-empty. Set its leader from `wednesday_service.leader` and build non-empty items in this order: hymn → scripture → title/pastor → benediction.
- `resolveMobileServices` returns a validated non-empty `mobile_services`; otherwise it returns the legacy adapter result.
- YouTube parsing accepts HTTPS URLs on the exact allowlist above with `youtube.com/watch?v=`, `youtube.com/live/`, `youtube.com/embed/`, and `youtu.be/`; video IDs match `[A-Za-z0-9_-]{6,50}`.
- Sorting for overlapping active windows uses distance to start, primary first, then original index.
- `collectRelationIds` loads only visible public relations; the two `collectStored*Ids` helpers inspect all stored services/items so admin saves can reject dangling resource or video IDs even when hidden.

- [ ] **Step 7: Run focused and static verification**

Run:

```powershell
npm.cmd test -- src/lib/mobile-bulletin.test.ts
npm.cmd run typecheck
```

Expected: all domain tests PASS; typecheck exits 0.

- [ ] **Step 8: Commit the domain layer**

```powershell
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/types/mobile-bulletin.ts src/types/notice.ts src/lib/validation.ts src/lib/mobile-bulletin.ts src/lib/mobile-bulletin.test.ts
git commit -m "feat: add mobile bulletin domain model"
```

---

### Task 2: Supabase Schema, RLS, and Apostles' Creed Seed

**Files:**
- Create via CLI: `supabase/config.toml`
- Create via CLI: `supabase/migrations` 아래에서 파일명이 `_mobile_digital_bulletin.sql`로 끝나는 단일 타임스탬프 마이그레이션

**Interfaces:**
- Produces: `public.weeklies.mobile_services jsonb`
- Produces: `public.worship_resources`
- Consumes: existing `public.is_admin_or_master()` authorization function

- [ ] **Step 1: Re-check current official Supabase guidance**

Open the current database changelog and confirm no relevant breaking change, then read the current RLS and API security pages:

```text
https://supabase.com/changelog?tags=database
https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/guides/api/securing-your-api
```

Run CLI discovery before using it:

```powershell
npx.cmd supabase@latest --help
npx.cmd supabase@latest migration --help
npx.cmd supabase@latest db --help
npx.cmd supabase@latest db lint --help
npx.cmd supabase@latest start --help
```

- [ ] **Step 2: Initialize the local Supabase config and create the migration through the CLI**

Run:

```powershell
npx.cmd supabase@latest init
npx.cmd supabase@latest migration new mobile_digital_bulletin
$mobileMigrationFiles = @(Get-ChildItem -LiteralPath supabase/migrations -Filter '*_mobile_digital_bulletin.sql')
if ($mobileMigrationFiles.Count -ne 1) { throw "Expected exactly one mobile bulletin migration" }
$mobileMigrationPath = $mobileMigrationFiles[0].FullName
$mobileMigrationPath
```

Expected: `supabase/config.toml` exists and the CLI prints the exact timestamped migration path.

- [ ] **Step 3: Write the migration**

Put the following schema in the generated migration, retaining the generated filename:

```sql
alter table public.weeklies
  add column if not exists mobile_services jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weeklies_mobile_services_array'
      and conrelid = 'public.weeklies'::regclass
  ) then
    alter table public.weeklies
      add constraint weeklies_mobile_services_array
      check (jsonb_typeof(mobile_services) = 'array');
  end if;
end $$;

create table if not exists public.worship_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('creed', 'hymn', 'scripture', 'text', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  reference text not null default '',
  content text not null default '',
  external_url text,
  source_label text,
  rights_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worship_resources_reference_length
    check (char_length(reference) <= 200),
  constraint worship_resources_content_length
    check (char_length(content) <= 30000),
  constraint worship_resources_external_url_length
    check (external_url is null or char_length(external_url) <= 2000),
  constraint worship_resources_source_length
    check (source_label is null or char_length(source_label) <= 200),
  constraint worship_resources_rights_length
    check (rights_note is null or char_length(rights_note) <= 2000),
  constraint worship_resources_https_url
    check (external_url is null or external_url ~ '^https://'),
  constraint worship_resources_rights_for_full_text
    check (
      kind not in ('hymn', 'scripture')
      or btrim(content) = ''
      or (nullif(btrim(source_label), '') is not null and nullif(btrim(rights_note), '') is not null)
    )
);

create index if not exists worship_resources_active_kind_idx
  on public.worship_resources (is_active, kind, title);

create or replace function public.worship_resources_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists worship_resources_updated_at on public.worship_resources;
create trigger worship_resources_updated_at
  before update on public.worship_resources
  for each row execute function public.worship_resources_set_updated_at();

alter table public.worship_resources enable row level security;

drop policy if exists "Public can read worship resources" on public.worship_resources;
create policy "Public can read worship resources"
  on public.worship_resources for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin can insert worship resources" on public.worship_resources;
create policy "Admin can insert worship resources"
  on public.worship_resources for insert
  to authenticated
  with check (public.is_admin_or_master());

drop policy if exists "Admin can update worship resources" on public.worship_resources;
create policy "Admin can update worship resources"
  on public.worship_resources for update
  to authenticated
  using (public.is_admin_or_master())
  with check (public.is_admin_or_master());

drop policy if exists "Admin can delete worship resources" on public.worship_resources;
revoke all privileges on table public.worship_resources from anon, authenticated;
grant select on table public.worship_resources to anon, authenticated;
grant insert, update on table public.worship_resources to authenticated;
grant select, insert, update, delete on table public.worship_resources to service_role;

insert into public.worship_resources (
  id, kind, title, reference, content, source_label, rights_note, is_active
)
values (
  '00000000-0000-4000-8000-000000000001',
  'creed',
  '사도신경',
  '신앙고백',
  E'전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며,\n그 외아들 우리 주 예수 그리스도를 믿사오니,\n이는 성령으로 잉태하사 동정녀 마리아에게 나시고,\n본디오 빌라도에게 고난을 받으사 십자가에 못 박혀 죽으시고,\n장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며,\n하늘에 오르사 전능하신 하나님 우편에 앉아 계시다가,\n저리로서 산 자와 죽은 자를 심판하러 오시리라.\n성령을 믿사오며, 거룩한 공회와 성도가 서로 교통하는 것과,\n죄를 사하여 주시는 것과, 몸이 다시 사는 것과,\n영원히 사는 것을 믿사옵나이다. 아멘.',
  '명성비전교회 예배문',
  '교회 예배용 고백문',
  true
)
on conflict (id) do nothing;
```

The `using (true)` read policy is intentional: old published bulletins must still resolve a resource after an administrator deactivates it. There is no public resource-list route, and the public loader queries only IDs referenced by the selected weekly. The admin chooser hides inactive rows for new links.

- [ ] **Step 4: Verify the migration locally**

Run:

```powershell
npx.cmd supabase@latest start
npx.cmd supabase@latest db reset --local
npx.cmd supabase@latest db lint --local
npx.cmd supabase@latest migration list --local
```

Expected: reset and lint exit 0; the new migration appears in the local list. If Docker is already running, `start` reports the existing local stack rather than failing.

- [ ] **Step 5: Commit the schema**

```powershell
$mobileMigrationFiles = @(Get-ChildItem -LiteralPath supabase/migrations -Filter '*_mobile_digital_bulletin.sql')
if ($mobileMigrationFiles.Count -ne 1) { throw "Expected exactly one mobile bulletin migration" }
git add -- supabase/config.toml $mobileMigrationFiles[0].FullName
git commit -m "feat: add mobile bulletin database schema"
```

---

### Task 3: Server-Side Relation Loader

**Files:**
- Create: `src/lib/mobile-bulletin-data.ts`
- Modify: `src/lib/mobile-bulletin.test.ts`

**Interfaces:**
- Consumes: `collectRelationIds(services)` from Task 1
- Produces: `loadMobileBulletinRelations(supabase, services): Promise<MobileBulletinRelations>`

- [ ] **Step 1: Extend the failing relation-ID tests**

Add cases to `src/lib/mobile-bulletin.test.ts` proving hidden items do not request public resources, hidden services do not request public relations, duplicate IDs are returned once in first-seen order, and stored hidden references remain available for admin save validation.

Add `collectStoredResourceIds` and `collectStoredVideoIds` to the existing import from `@/lib/mobile-bulletin`, then append:

```ts
it("ignores a hidden item while retaining its stored reference", () => {
  const hidden = structuredClone(services);
  hidden[0].items[0].visible = false;
  expect(collectRelationIds(hidden)).toEqual({ resourceIds: [], videoIds: ["past123"] });
  expect(collectStoredResourceIds(hidden)).toEqual([APOSTLES_CREED_RESOURCE_ID]);
});

it("ignores hidden services publicly but validates their stored relations", () => {
  const hidden = structuredClone(services);
  hidden[0].visible = false;
  expect(collectRelationIds(hidden)).toEqual({ resourceIds: [], videoIds: [] });
  expect(collectStoredResourceIds(hidden)).toEqual([APOSTLES_CREED_RESOURCE_ID]);
  expect(collectStoredVideoIds(hidden)).toEqual(["past123"]);
});
```

Run `npm.cmd test -- src/lib/mobile-bulletin.test.ts` and expect the new tests to FAIL until public visibility filtering and stored-ID collection are implemented.

- [ ] **Step 2: Implement the server-only loader**

Create `src/lib/mobile-bulletin-data.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectRelationIds } from "@/lib/mobile-bulletin";
import type { MobileBulletinRelations, MobileService, WorshipResource } from "@/types/mobile-bulletin";

export async function loadMobileBulletinRelations(
  supabase: SupabaseClient,
  services: MobileService[],
): Promise<MobileBulletinRelations> {
  const { resourceIds, videoIds } = collectRelationIds(services);
  const resourcesQuery = resourceIds.length
    ? supabase
        .from("worship_resources")
        .select("id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at")
        .in("id", resourceIds)
    : Promise.resolve({ data: [], error: null });
  const videosQuery = videoIds.length
    ? supabase.from("sermon_videos").select("video_id").in("video_id", videoIds)
    : Promise.resolve({ data: [], error: null });
  const [resourcesResult, videosResult] = await Promise.all([resourcesQuery, videosQuery]);

  if (resourcesResult.error) console.error("mobile bulletin resources:", resourcesResult.error.message);
  if (videosResult.error) console.error("mobile bulletin videos:", videosResult.error.message);

  const resources = (resourcesResult.data ?? []) as WorshipResource[];
  return {
    resourcesById: Object.fromEntries(resources.map((resource) => [resource.id, resource])),
    validVideoIds: (videosResult.data ?? []).map((row) => (row as { video_id: string }).video_id),
  };
}
```

Update `collectRelationIds` to inspect only visible services/items while retaining a visible service's `videoId`.

- [ ] **Step 3: Run verification**

```powershell
npm.cmd test -- src/lib/mobile-bulletin.test.ts
npm.cmd run typecheck
```

Expected: PASS and exit 0.

- [ ] **Step 4: Commit the loader**

```powershell
git add src/lib/mobile-bulletin.ts src/lib/mobile-bulletin.test.ts src/lib/mobile-bulletin-data.ts
git commit -m "feat: load mobile bulletin relations"
```

---

### Task 4: Public Mobile Bulletin Components

**Files:**
- Create: `src/components/mobile-bulletin/MobileServiceExperience.tsx`
- Create: `src/components/mobile-bulletin/WorshipResourceSheet.tsx`
- Create: `src/components/mobile-bulletin/MobileBulletinSections.tsx`
- Create: `src/components/mobile-bulletin/MobileServiceExperience.test.tsx`
- Create: `src/components/mobile-bulletin/MobileBulletinSections.test.tsx`

**Interfaces:**
- Consumes: `MobileService[]`, `MobileBulletinRelations`, `selectMobileServiceId`, `isServiceLive`, `extractYouTubeVideoId`
- Produces: `MobileServiceExperience`, `NextWeekServing`, `ChurchNews`, `BulletinFooterLinks`

- [ ] **Step 1: Write failing interaction tests**

Create `src/components/mobile-bulletin/MobileServiceExperience.test.tsx` covering five user-visible behaviors:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileServiceExperience } from "./MobileServiceExperience";
import { APOSTLES_CREED_RESOURCE_ID } from "@/lib/mobile-bulletin";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";

const services: MobileService[] = [
  {
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "담임목사",
    liveUrl: "https://www.youtube.com/live/live123",
    videoId: "past123",
    items: [
      {
        id: "creed",
        label: "신앙고백",
        summary: "사도신경",
        assignees: [],
        emphasized: false,
        visible: true,
        resourceId: APOSTLES_CREED_RESOURCE_ID,
        externalUrl: null,
      },
    ],
  },
  {
    id: "wed",
    type: "wednesday",
    label: "수요예배",
    startsAt: "2026-07-29T19:30:00+09:00",
    endsAt: "2026-07-29T21:00:00+09:00",
    primary: false,
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: "wed123",
    items: [
      {
        id: "word",
        label: "말씀",
        summary: "요한복음 3:16",
        assignees: ["담임목사"],
        emphasized: true,
        visible: true,
        resourceId: null,
        externalUrl: null,
      },
    ],
  },
];

const creed = {
  id: APOSTLES_CREED_RESOURCE_ID,
  kind: "creed",
  title: "사도신경",
  reference: "신앙고백",
  content: "전능하사 천지를 만드신",
  external_url: null,
  source_label: null,
  rights_note: null,
  is_active: true,
  created_at: "",
  updated_at: "",
} satisfies WorshipResource;

describe("MobileServiceExperience", () => {
  it("selects the active service and marks it LIVE", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T23:00:00Z"));
    try {
      render(<MobileServiceExperience title="7월 넷째주 주보" date="2026-07-26" liturgyLabel="성령강림 후" services={services} resourcesById={{}} validVideoIds={[]} initialNowIso="2026-07-25T23:00:00Z" />);
      expect(screen.getByRole("tab", { name: "주일예배" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a manual tab selection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T00:00:00Z"));
    try {
      render(<MobileServiceExperience title="주보" date="2026-07-26" liturgyLabel="성령강림 후" services={services} resourcesById={{}} validVideoIds={[]} initialNowIso="2026-07-25T23:00:00Z" />);
      fireEvent.click(screen.getByRole("tab", { name: "수요예배" }));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("tab", { name: "수요예배" })).toHaveAttribute("aria-selected", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves between tabs with arrow keys", () => {
    render(<MobileServiceExperience title="주보" date="2026-07-26" liturgyLabel="성령강림 후" services={services} resourcesById={{}} validVideoIds={[]} initialNowIso="2026-07-25T23:00:00Z" />);
    const sunday = screen.getByRole("tab", { name: "주일예배" });
    fireEvent.keyDown(sunday, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "수요예배" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "수요예배" })).toHaveAttribute("aria-selected", "true");
  });

  it("changes both the order and the recording with the selected service", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T03:00:00Z"));
    try {
      render(<MobileServiceExperience title="주보" date="2026-07-26" liturgyLabel="성령강림 후" services={services} resourcesById={{}} validVideoIds={["past123", "wed123"]} initialNowIso="2026-07-30T03:00:00Z" />);
      expect(screen.getByTitle("주일예배 영상")).toHaveAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/past123",
      );
      fireEvent.click(screen.getByRole("tab", { name: "수요예배" }));
      expect(screen.getByTitle("수요예배 영상")).toHaveAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/wed123",
      );
      expect(screen.getByText("요한복음 3:16")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens and closes the linked creed in a named dialog", () => {
    render(<MobileServiceExperience title="주보" date="2026-07-26" liturgyLabel="성령강림 후" services={services} resourcesById={{ [creed.id]: creed }} validVideoIds={[]} initialNowIso="2026-07-25T23:00:00Z" />);
    const trigger = screen.getByRole("button", { name: "사도신경 내용 보기" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "사도신경" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "사도신경" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
```

Run `npm.cmd test -- src/components/mobile-bulletin/MobileServiceExperience.test.tsx`; expect module-not-found failure.

- [ ] **Step 2: Implement the accessible resource sheet**

`WorshipResourceSheet` uses a native `<dialog>` and the React 19 ref rule:

```tsx
"use client";

const dialogRef = useRef<HTMLDialogElement>(null);
const triggerRef = useRef<HTMLButtonElement>(null);

function close() {
  dialogRef.current?.close();
  triggerRef.current?.focus();
}
```

Requirements:

- `aria-labelledby` points to the resource title.
- Content is rendered with `whitespace-pre-wrap` as a text node.
- The source and rights note are secondary text.
- An `external_url` link uses `target="_blank" rel="noopener noreferrer"`.
- Clicking the dialog backdrop or the named close button closes it.
- The trigger accessible name ends in `본문 보기` for scripture, `찬송가 보기` for hymns, and `내용 보기` for every other kind; the visible label uses the same wording.
- The panel is fixed to the bottom on mobile and centered/max-width on larger screens.

- [ ] **Step 3: Implement the service experience**

`MobileServiceExperience` must:

1. Initialize selection from `selectMobileServiceId(services, new Date(initialNowIso))`.
   Filter out hidden services before selection and tab rendering; if none remain, render the prepared-empty state instead of an empty tablist.
2. On mount, refresh to the browser's current time and then every 60 seconds.
3. Stop automatic selection after a user clicks a tab, but keep updating the clock so the selected service's `LIVE` badge can enter/leave its time window.
4. Render a unique `h1`, date, liturgy label, selected service label, and text `LIVE` when `isServiceLive` and a valid live video ID both hold.
5. Render responsive `iframe` whose `title` value is formed as `` `${service.label} 영상` ``, with `loading="lazy"`, `allowFullScreen`, and a URL formed as ``https://www.youtube-nocookie.com/embed/${videoId}``.
6. When not live, render only a `videoId` present in `validVideoIds`.
7. With no playable video, show links to `/sermons` and `https://www.youtube.com/@msvchphoto` instead of an empty player.
8. Use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and a matching tabpanel ID. ArrowLeft/ArrowRight wraps through visible tabs, Home/End jumps to the first/last tab, and keyboard changes stop automatic selection just like pointer clicks.
9. Render visible items as a numbered vertical timeline with label, summary, assignees, and a resource trigger only when the resource resolves. If an item has a validated `externalUrl`, render a named HTTPS link with `target="_blank" rel="noopener noreferrer"`; never render a disabled or broken action for a missing relation.
10. Apply weekly liturgical colors through the nearest wrapper's `data-season` in Task 5; use existing `text-liturgy-brand`, `bg-liturgy-brand-soft`, and `border-liturgy-brand` tokens.

Visual rules from the approved design:

- Use white and the existing `church-cream` background, thin borders, generous vertical spacing, and no heavy card shadows.
- Keep body copy at least 16px and supporting text at least 13px; interactive tab, link, and button hit areas are at least 44×44px.
- Keep the player at `aspect-video`; long labels and text wrap instead of clipping or forcing horizontal page scroll.
- Limit transitions to short tab/sheet opacity or transform changes and disable them under `motion-reduce`.
- At desktop widths retain the same 720–800px reading column; do not switch back to paper faces.

- [ ] **Step 4: Implement the server-safe lower sections**

In `MobileBulletinSections.tsx` export:

```ts
export function NextWeekServing(props: {
  prayer: string[];
  offering: { p1: string; p2: string; p3: string };
  guides: GuideCommitteeRow[];
}): React.ReactNode;

export function ChurchNews({ news }: { news: NewsItem[] }): React.ReactNode;
export function BulletinFooterLinks(): React.ReactNode;
```

Rules:

- Hide each empty subsection and hide the whole serving section if all are empty.
- Use semantic headings and rows/cards, not a horizontally compressed table.
- Use native `<details>` for news; the first non-empty item has `open`.
- Strip empty news titles/items before rendering.
- Footer links point to `/weekly` and `/sermons`.

Create `src/components/mobile-bulletin/MobileBulletinSections.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChurchNews, NextWeekServing } from "./MobileBulletinSections";

describe("MobileBulletinSections", () => {
  it("hides completely empty serving and news sections", () => {
    render(
      <>
        <NextWeekServing
          prayer={[]}
          offering={{ p1: "", p2: "", p3: "" }}
          guides={[]}
        />
        <ChurchNews news={[]} />
      </>,
    );
    expect(screen.queryByRole("heading", { name: "다음 주 섬김" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "교회소식" })).not.toBeInTheDocument();
  });

  it("opens the first non-empty news group", () => {
    render(
      <ChurchNews
        news={[
          { title: "", items: [""] },
          { title: "이번 주 안내", items: ["새가족 환영회가 있습니다."] },
        ]}
      />,
    );
    expect(screen.getByText("이번 주 안내").closest("details")).toHaveAttribute("open");
  });
});
```

- [ ] **Step 5: Run component and static verification**

```powershell
npm.cmd test -- src/components/mobile-bulletin/MobileServiceExperience.test.tsx
npm.cmd test -- src/components/mobile-bulletin/MobileBulletinSections.test.tsx
npm.cmd run typecheck
npm.cmd run lint
```

Expected: tests PASS, typecheck/lint exit 0.

- [ ] **Step 6: Commit the public components**

```powershell
git add src/components/mobile-bulletin
git commit -m "feat: build interactive mobile bulletin view"
```

---

### Task 5: Public Routes and Legacy/Photo Fallback

**Files:**
- Create: `src/components/mobile-bulletin/MobileBulletin.tsx`
- Create: `src/components/mobile-bulletin/MobileBulletin.test.tsx`
- Modify: `src/app/(public)/weekly/page.tsx`
- Modify: `src/app/(public)/weekly/[id]/page.tsx`

**Interfaces:**
- Consumes: `resolveMobileServices`, `loadMobileBulletinRelations`, public components from Task 4
- Produces: `MobileBulletin({ weekly })`

- [ ] **Step 1: Write failing public-boundary fallback tests**

Create `src/components/mobile-bulletin/MobileBulletin.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileBulletin } from "./MobileBulletin";
import { createDefaultMobileServices } from "@/lib/mobile-bulletin";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";
import type { Weekly } from "@/types/notice";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/mobile-bulletin-data", () => ({
  loadMobileBulletinRelations: vi.fn(async () => ({ resourcesById: {}, validVideoIds: [] })),
}));
vi.mock("./MobileServiceExperience", () => ({
  MobileServiceExperience: ({ services }: { services: MobileService[] }) => (
    <div data-testid="digital-service">{services[0].label}</div>
  ),
}));
vi.mock("@/components/bulletin/WeeklyPhotoView", () => ({
  WeeklyPhotoView: ({ title }: { title: string }) => <div data-testid="photo-weekly">{title}</div>,
}));

const baseWeekly: Weekly = {
  ...createEmptyWeeklyInput(),
  id: "weekly",
  title: "테스트 주보",
  date: "2026-07-26",
  created_at: "2026-07-20T00:00:00Z",
  mobile_services: [],
};

describe("MobileBulletin", () => {
  it("prefers valid digital services even when photos exist", async () => {
    const weekly = {
      ...baseWeekly,
      mobile_services: createDefaultMobileServices("2026-07-26"),
      photo_images: ["https://example.com/weekly.jpg"],
    };
    render(await MobileBulletin({ weekly }));
    expect(screen.getByTestId("digital-service")).toBeInTheDocument();
    expect(screen.queryByTestId("photo-weekly")).not.toBeInTheDocument();
  });

  it("uses photos when neither saved nor legacy services can be resolved", async () => {
    render(await MobileBulletin({ weekly: { ...baseWeekly, photo_images: ["https://example.com/weekly.jpg"] } }));
    expect(screen.getByTestId("photo-weekly")).toBeInTheDocument();
  });

  it("shows the prepared-empty state when every source is empty", async () => {
    render(await MobileBulletin({ weekly: baseWeekly }));
    expect(screen.getByText("주보 내용이 준비 중입니다.")).toBeInTheDocument();
  });
});
```

Run `npm.cmd test -- src/components/mobile-bulletin/MobileBulletin.test.tsx` and expect module-not-found failure.

- [ ] **Step 2: Implement the server boundary**

Create async `MobileBulletin` as a Server Component:

```tsx
export async function MobileBulletin({ weekly }: { weekly: Weekly }) {
  const services = resolveMobileServices(weekly);
  const photoImages = weekly.photo_images ?? [];
  if (services.length === 0 && photoImages.length > 0) {
    return <WeeklyPhotoView images={photoImages} title={weekly.title} />;
  }
  if (services.length === 0) {
    return <p className="rounded-2xl bg-white p-8 text-center text-gray-500">주보 내용이 준비 중입니다.</p>;
  }

  const supabase = await createClient();
  const relations = await loadMobileBulletinRelations(supabase, services);
  const liturgicalDate = weekly.date
    ? new Date(`${weekly.date}T00:00:00+09:00`)
    : new Date();
  const day = getLiturgicalDay(liturgicalDate);

  return (
    <article data-season={day.season} className="mx-auto max-w-[800px] space-y-6">
      <MobileServiceExperience
        title={weekly.title}
        date={weekly.date ?? ""}
        liturgyLabel={formatLiturgyLabel(day)}
        services={services}
        {...relations}
        initialNowIso={new Date().toISOString()}
      />
      <NextWeekServing prayer={weekly.next_week_prayer} offering={weekly.offering_members} guides={weekly.guide_committee} />
      <ChurchNews news={weekly.news} />
      <BulletinFooterLinks />
    </article>
  );
}
```

If `weekly.date` is absent, derive the liturgical day from the current date as shown above.

- [ ] **Step 3: Replace only the public web rendering**

In `/weekly`:

- Remove `PageHeader`, `Bulletin`, and `loadBulletinMaster` imports and query.
- Keep latest-20 published ordering.
- Preserve the existing `등록된 주보가 없습니다` state when no published row exists.
- Render `<MobileBulletin weekly={latest} />` in a `Container` with `className="py-6 sm:py-10"`.
- Keep the archive below the new bulletin, restyled to the same max-width but with existing links and dates.

In `/weekly/[id]`:

- Keep async `params`, metadata query, published guard, and back link.
- Remove bulletin master loading.
- Render the same `<MobileBulletin weekly={weekly} />`.

Do not modify `Bulletin`, `BulletinWebView`, `BulletinFront`, `BulletinBack`, or the print route in this task.

- [ ] **Step 4: Verify fallback and route compilation**

```powershell
npm.cmd test
npm.cmd test -- src/components/mobile-bulletin/MobileBulletin.test.tsx
npm.cmd run typecheck
npm.cmd run build
```

Expected: test suite PASS; build lists `/weekly` and `/weekly/[id]` without error.

- [ ] **Step 5: Commit the route switch**

```powershell
git add src/components/mobile-bulletin/MobileBulletin.tsx src/components/mobile-bulletin/MobileBulletin.test.tsx 'src/app/(public)/weekly/page.tsx' 'src/app/(public)/weekly/[id]/page.tsx'
git commit -m "feat: serve digital bulletin on public routes"
```

---

### Task 6: Worship Resource Admin

**Files:**
- Create: `src/components/weekly/masters/WorshipResourceForm.tsx`
- Create: `src/components/weekly/masters/WorshipResourcesEditor.tsx`
- Create: `src/components/weekly/masters/WorshipResourceForm.test.tsx`
- Create: `src/app/admin/masters/worship-resources/page.tsx`
- Modify: `src/app/admin/masters/page.tsx`

**Interfaces:**
- Consumes: `WorshipResource`, `WorshipResourceInputSchema`, existing browser Supabase client
- Produces: searchable active/inactive resource manager

- [ ] **Step 1: Write the failing rights-validation test**

Test the form as a user:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorshipResourceForm } from "./WorshipResourceForm";
import type { WorshipResourceInput } from "@/lib/validation";

const emptyHymn: WorshipResourceInput = {
  kind: "hymn",
  title: "테스트 찬송",
  reference: "",
  content: "",
  external_url: null,
  source_label: null,
  rights_note: null,
  is_active: true,
};

describe("WorshipResourceForm", () => {
it("requires source and rights notes for hymn full text", () => {
  const onSave = vi.fn();
  render(<WorshipResourceForm initial={emptyHymn} onSave={onSave} saving={false} />);
  fireEvent.change(screen.getByLabelText("본문"), { target: { value: "찬송가 가사" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(screen.getByText("전문을 저장하려면 출처를 입력하세요")).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
});
```

Run `npm.cmd test -- src/components/weekly/masters/WorshipResourceForm.test.tsx` and expect module-not-found failure.

- [ ] **Step 2: Implement the presentational validated form**

`WorshipResourceForm` props:

```ts
interface WorshipResourceFormProps {
  initial: WorshipResourceInput;
  saving: boolean;
  onSave: (value: WorshipResourceInput) => Promise<void> | void;
  onCancel?: () => void;
}
```

Use labeled controls for kind, title, reference, content, external URL, source, rights note, and active status. Submit through `WorshipResourceInputSchema.safeParse`; display field/path messages in an `aria-live="polite"` error region. Never render or preview content as HTML.

- [ ] **Step 3: Implement list loading and writes**

`WorshipResourcesEditor` must:

- Create the Supabase client with `useMemo`.
- Select explicit columns from `worship_resources`, ordered by `kind`, then `title`.
- Filter locally by title/reference and active state.
- Insert new rows and update existing rows through the validated form.
- Set `is_active=false` instead of deleting.
- Reload the authoritative row after save.
- Model expected database errors as visible messages, not thrown render errors.
- Label inactive resources and exclude them from the default active filter.
- Show the selected resource's content, source, and rights note as a `whitespace-pre-wrap` text preview; never interpret it as HTML.
- The deactivate action explains that existing past bulletins keep their link and asks for confirmation before updating `is_active`.

- [ ] **Step 4: Add the route and hub entry**

Create the page with heading `예배자료` and description `사도신경·찬송가·성경 본문과 출처를 관리합니다.`. Add a hub card at `/admin/masters` linking to `/admin/masters/worship-resources`. Do not alter other master cards.

- [ ] **Step 5: Verify and commit**

```powershell
npm.cmd test -- src/components/weekly/masters/WorshipResourceForm.test.tsx
npm.cmd run typecheck
npm.cmd run lint
git add src/components/weekly/masters/WorshipResourceForm.tsx src/components/weekly/masters/WorshipResourcesEditor.tsx src/components/weekly/masters/WorshipResourceForm.test.tsx src/app/admin/masters/worship-resources/page.tsx src/app/admin/masters/page.tsx
git commit -m "feat: add worship resource administration"
```

Expected: focused test PASS; typecheck/lint exit 0; commit contains only resource administration.

---

### Task 7: Mobile Bulletin Admin Editor and Preview

**Files:**
- Create: `src/components/weekly/mobile/MobileBulletinEditor.tsx`
- Create: `src/components/weekly/mobile/MobileBulletinEditorLoader.tsx`
- Create: `src/components/weekly/mobile/MobileBulletinPreview.tsx`
- Create: `src/components/weekly/mobile/MobileBulletinEditor.test.tsx`
- Modify: `src/components/weekly/WeeklyForm.tsx`
- Modify: `src/components/weekly/WeeklyEditorWithPreview.tsx`
- Modify: `src/app/admin/weeklies/new/page.tsx`
- Modify: `src/app/admin/weeklies/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `MobileService[]`, `WorshipResource[]`, sermon option rows, Task 1 date/legacy helpers
- Produces: `onChange(next: MobileService[])`

- [ ] **Step 1: Write failing editor behavior tests**

Create tests using a presentational editor with injected resource/video options:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileBulletinEditor } from "./MobileBulletinEditor";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";

const legacyInput = {
  ...createEmptyWeeklyInput(),
  title: "테스트 주보",
  date: "2026-07-26",
  worship_items: [
    {
      marker: "",
      label: "찬송",
      content: "21장",
      assignees: [],
      subRows: [],
      emphasize: false,
    },
  ],
  wednesday_service: {
    leader: "인도자",
    scripture: "요한복음 3:16",
    title: "하나님의 사랑",
    pastor: "담임목사",
    hymn: "310장",
    benediction: "담임목사",
  },
};

const orderedServices: MobileService[] = [
  {
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: null,
    items: [
      { id: "hymn", label: "찬송", summary: "21장", assignees: [], emphasized: false, visible: true, resourceId: null, externalUrl: null },
      { id: "offering", label: "봉헌", summary: "", assignees: [], emphasized: false, visible: true, resourceId: null, externalUrl: null },
    ],
  },
];

describe("MobileBulletinEditor", () => {
it("generates Sunday and Wednesday services from the existing weekly input", () => {
  const onChange = vi.fn();
  render(<MobileBulletinEditor value={[]} weekly={legacyInput} resources={[]} videos={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "기존 주보 내용으로 생성" }));
  expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ type: "sunday" }),
    expect.objectContaining({ type: "wednesday" }),
  ]));
});

it("adds a Friday service", () => {
  const onChange = vi.fn();
  render(<MobileBulletinEditor value={[]} weekly={legacyInput} resources={[]} videos={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "금요기도회 추가" }));
  expect(onChange).toHaveBeenLastCalledWith(
    expect.arrayContaining([expect.objectContaining({ type: "friday" })]),
  );
});

it("moves an order item up", () => {
  const onChange = vi.fn();
  render(<MobileBulletinEditor value={orderedServices} weekly={legacyInput} resources={[]} videos={[]} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "봉헌 위로" }));
  const next = onChange.mock.calls.at(-1)?.[0] as MobileService[];
  expect(next[0].items.map((item) => item.id)).toEqual(["offering", "hymn"]);
});
});
```

Run `npm.cmd test -- src/components/weekly/mobile/MobileBulletinEditor.test.tsx` and expect module-not-found failure.

- [ ] **Step 2: Implement the data loader wrapper**

`MobileBulletinEditorLoader` queries:

```text
worship_resources: id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at ordered kind,title
sermon_videos: video_id,title,published_at,category ordered published_at desc limit 100
```

Pass plain arrays to `MobileBulletinEditor`. New resource choices show active rows only; an inactive row already referenced by this weekly remains visible, selected, and marked `비활성`. A missing referenced ID renders a warning and is never silently cleared. On query failure, render a warning but keep the editor usable without selectable options.

- [ ] **Step 3: Implement the mobile editor**

For every service provide:

- Visible toggle, label, type, primary radio, start/end `datetime-local`, leader, live URL.
- A title-search field and sermon select: first optgroup matches the service type (`sunday`, `wednesday`, `friday`; `other` has no category preference), second optgroup contains every title/date match. Automatic recommendation never writes `videoId`; only an explicit selection does.
- Add/remove service controls for 주일·수요·금요·기타; additions call `createMobileService(type, weekly.date)` so KST dates and the approved default times are shared with the domain layer.
- Item controls for label, summary, assignees, emphasized, visible, resource select, external URL.
- Add/remove item and explicit `위로`/`아래로` buttons; touch drag is not required.
- `기존 주보 내용으로 생성` calls the legacy adapter over the current `WeeklyContentInput` converted to a `Weekly`-compatible value.
- At most one primary service; choosing one clears the others.
- All IDs are created with `crypto.randomUUID()`.
- Datetime-local values are converted to and from ISO strings with `+09:00` without using the host timezone.
- An inactive resource already referenced by the current item can remain selected; it cannot be selected for a new item.

Use Korean accessible names such as `${service.label} 삭제`, `${item.label} 위로`, and `${item.label} 자료 선택`.

- [ ] **Step 4: Add the tab to `WeeklyForm`**

Add this tab immediately after `페이지1(주일예배)`:

```tsx
{
  key: "mobile",
  label: "모바일 주보",
  description: "예배별 모바일 순서·라이브·지난 설교·상세자료를 관리합니다.",
  content: (
    <MobileBulletinEditorLoader
      value={form.mobile_services}
      weekly={form}
      onChange={(mobile_services) => set("mobile_services", mobile_services)}
    />
  ),
}
```

When `form.date` changes, call `rebaseMobileServices` with the previous date and new date so all service calendar dates shift by the same number of days while times remain intact.

- [ ] **Step 5: Add the shared mobile preview**

`MobileBulletinPreview` loads only referenced resources and video IDs from the browser Supabase client, then renders `MobileServiceExperience`, `NextWeekServing`, `ChurchNews`, and `BulletinFooterLinks` inside a 390px-wide preview shell. It passes a fixed current time derived from the previewed bulletin date only for display, applies the same `data-season`, and labels the shell `모바일 미리보기`.

In `WeeklyEditorWithPreview`:

- Add `activePreview` state.
- `handleTabChange("mobile")` sets mobile mode and does not scroll print pages.
- Non-mobile tabs keep the existing print preview and scroll behavior unchanged.
- Add `mobile_services: input.mobile_services` to `inputToWeekly`.
- Render `<MobileBulletinPreview weekly={previewWeekly} />` only while the mobile tab is active.

- [ ] **Step 6: Preserve new/edit form round trips**

In edit mapping, add:

```ts
mobile_services: w.mobile_services ?? [],
```

In new prefill mapping, add:

```ts
mobile_services: rebaseMobileServices(
  w.mobile_services ?? [],
  w.date ?? date,
  date,
).map((service) => ({ ...service, videoId: null })),
```

If the previous weekly has no mobile services, leave the field empty so the administrator explicitly uses `기존 주보 내용으로 생성`. Keep live URLs and structure, clear past `videoId`, and preserve item/resource links.

Before either new-page insert or edit-page update, call `collectStoredResourceIds(parsed.data.mobile_services)` and `collectStoredVideoIds(parsed.data.mobile_services)`. Query those exact IDs from `worship_resources` and `sermon_videos` in parallel and compare both returned sets. If a query fails or any ID is absent, stop before the mutation and show a Korean save error listing the missing resource/video IDs. When loading an older weekly whose video was removed later, show the public-fallback warning and require the administrator to clear or replace that video before the next save.

- [ ] **Step 7: Verify the admin flow**

```powershell
npm.cmd test -- src/components/weekly/mobile/MobileBulletinEditor.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: all tests PASS; typecheck/lint/build exit 0.

- [ ] **Step 8: Commit the admin integration**

```powershell
git add src/components/weekly/mobile src/components/weekly/WeeklyForm.tsx src/components/weekly/WeeklyEditorWithPreview.tsx src/app/admin/weeklies/new/page.tsx 'src/app/admin/weeklies/[id]/edit/page.tsx'
git commit -m "feat: add mobile bulletin administration"
```

---

### Task 8: Database Application, Full Verification, and Regression Audit

**Files:**
- Modify only if verification finds a defect: files already listed in Tasks 1–7

**Interfaces:**
- Consumes: all completed tasks
- Produces: applied additive schema, evidence for public/admin/print behavior

- [ ] **Step 1: Run the full automated verification from a clean process**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: all tests PASS with zero failures; lint/typecheck/build/diff-check exit 0.

- [ ] **Step 2: Run React and Next.js quality review**

Invoke `vercel:react-best-practices` because multiple TSX components changed. Confirm:

- No large page-level `use client` boundary.
- Supabase queries are not duplicated unnecessarily.
- Effects do not cause loops or overwrite manual tab selection.
- Interactive elements have stable keys and accessible names.
- No unrelated components or global layouts changed.

Fix only findings within the mobile bulletin scope, then rerun Step 1.

- [ ] **Step 3: Apply the additive migration to the connected project**

Use the connected Supabase app to list projects, match the project reference to the hostname in `NEXT_PUBLIC_SUPABASE_URL` without printing any keys, and apply the committed migration with name `mobile_digital_bulletin`. Do not reset, drop, or rewrite existing tables.

Verify with read-only queries:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'weeklies'
  and column_name = 'mobile_services';

select id, kind, title, is_active
from public.worship_resources
where id = '00000000-0000-4000-8000-000000000001';
```

Expected: one `jsonb` column row and one active `사도신경` row.

- [ ] **Step 4: Run Supabase security and performance advisors**

Run both advisor types against the matched project. Treat a new finding tied to `worship_resources` or `mobile_services` as a blocker. Existing unrelated findings are reported but not changed.

Expected: no new missing-RLS, overly permissive policy, or missing-index finding caused by this migration.

- [ ] **Step 5: Start the app and run browser verification**

Before opening the browser, use a read-only query on the matched project to identify published regression candidates without changing them:

```sql
select
  id,
  title,
  date,
  jsonb_array_length(mobile_services) as mobile_service_count,
  jsonb_array_length(coalesce(worship_items, '[]'::jsonb)) as legacy_order_count,
  cardinality(photo_images) as photo_count
from public.weeklies
where is_published = true
order by date desc
limit 20;
```

Choose returned literal IDs for one legacy structured row and one photo row when those candidates exist. Do not edit them. If a candidate class does not exist, record that fact and rely on the Task 1/Task 5 fixture tests for that branch.

Start:

```powershell
npm.cmd run dev
```

Invoke `vercel:agent-browser-verify` for the dev server, then inspect:

1. `/weekly` at 375×812 and 390×844: no horizontal scroll; header, tabs, order, serving, and news read naturally.
2. A prior `/weekly/[id]`: Sunday defaults, linked recording or fallback link appears, and archive link works.
3. Manual 주일→수요→금요 tab changes: order and video change together and selection remains stable.
4. Keyboard-only tab use: ArrowLeft/ArrowRight/Home/End move and select as specified; focus remains visible.
5. 사도신경: opens in a named dialog, multiline text is readable, Tab remains trapped, and Escape/close/backdrop returns focus.
6. Open the selected legacy structured and photo candidate IDs from the read-only query; confirm digital legacy conversion and final photo fallback respectively.
7. Browser zoom at 200% and reduced-motion emulation: content remains readable, no required information clips or depends on animation.
8. `/admin/weeklies/new`: mobile tab creates legacy draft, adds Friday, moves items, picks a resource/video, and saves a draft.
9. Reopen the saved draft: all mobile data round-trips.
10. `/admin/masters/worship-resources`: create a text resource, reject hymn full text without rights fields, save after fields are supplied, and deactivate without deletion.
11. Open `/weekly-print/` followed by the exact disposable draft UUID captured when reopening it in step 9; the four print faces remain in the same structure.
12. Desktop width 1280: public bulletin stays within the central reading column.

Use a disposable draft weekly for admin verification and delete it through the existing admin UI after the test; do not alter an existing published weekly.

- [ ] **Step 6: Re-run final verification after any browser fix**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
git status --short
```

Expected: all commands pass; status contains only intentional verification fixes or is clean.

- [ ] **Step 7: Commit verification fixes, if any**

If Step 5 required in-scope fixes:

```powershell
git add package.json package-lock.json vitest.config.ts src/test/setup.ts
git add src/types/mobile-bulletin.ts src/types/notice.ts
git add src/lib/validation.ts src/lib/mobile-bulletin.ts src/lib/mobile-bulletin.test.ts src/lib/mobile-bulletin-data.ts
git add src/components/mobile-bulletin
git add src/components/weekly/masters/WorshipResourceForm.tsx src/components/weekly/masters/WorshipResourcesEditor.tsx src/components/weekly/masters/WorshipResourceForm.test.tsx
git add src/components/weekly/mobile src/components/weekly/WeeklyForm.tsx src/components/weekly/WeeklyEditorWithPreview.tsx
git add 'src/app/(public)/weekly/page.tsx' 'src/app/(public)/weekly/[id]/page.tsx'
git add src/app/admin/masters/page.tsx src/app/admin/masters/worship-resources/page.tsx src/app/admin/weeklies/new/page.tsx 'src/app/admin/weeklies/[id]/edit/page.tsx'
$mobileMigrationFiles = @(Get-ChildItem -LiteralPath supabase/migrations -Filter '*_mobile_digital_bulletin.sql')
if ($mobileMigrationFiles.Count -ne 1) { throw "Expected exactly one mobile bulletin migration" }
git add -- supabase/config.toml $mobileMigrationFiles[0].FullName
git diff --cached --name-only
git commit -m "fix: address mobile bulletin verification findings"
```

Confirm the cached name list contains only files from Tasks 1–7. If no files changed, do not run the staging block or create an empty commit.

---

## Completion Evidence

Before reporting completion, provide:

- Full `npm.cmd test` pass count.
- Exit-0 evidence for lint, typecheck, and production build.
- Supabase migration identifier and the two read-only verification query results.
- Security/performance advisor result summary with links for any unrelated existing findings.
- Browser verification summary for 375px, 390px, desktop, keyboard/200% zoom/reduced motion, legacy/photo fallbacks, admin round-trip, resource dialog, and print regression.
- `git status --short` and the task commit list.
