# 주보 DB 연동 및 Admin 주보 생성 폼 개선 — 리서치 보고서

> 작성일: 2026-04-23
> 목적: 현재 하드코딩 DEFAULT 상수로 채워지는 주보 4페이지 데이터를 Supabase DB와 완전히 연동하고, admin 주보 생성 폼을 전면 개편하기 위한 기반 조사.
> 범위: 웹 전용(모바일 별도). 주보 레이아웃 컴포넌트(`BulletinFront.tsx`, `BulletinBack.tsx`) **절대 수정 금지** — 데이터 매핑 함수(`weeklyToFrontData`, `weeklyToBackData`)와 DB/폼만 변경.

---

## 0. 핵심 결론 요약 (TL;DR)

1. **현재 DB/타입은 주보 렌더링 데이터의 약 5%만 커버**. 나머지 95%는 `BulletinFront.tsx` / `BulletinBack.tsx`의 `DEFAULT` 상수로 하드코딩돼 있다. DB 스키마 확장이 필수.
2. **데이터는 3계층으로 재분류**해야 한다: (A) 매주 변하는 주보 전용 필드, (B) 특정일에만 바뀌는 마스터 데이터(목장·섬기는분·후원분·표어·교회공동체기도제목), (C) 거의 변하지 않는 정적 상수(주소·전화·비전·주일시간·계좌번호).
3. **마스터 데이터는 별도 테이블**로 관리하고 주보는 "작성 시점 스냅샷"을 선택할지 "실시간 참조"할지 전략을 명확히 해야 함 → 본 보고서는 **실시간 참조(Live Reference)** 방식을 권장(사용자 요구와 일치: "DB 수정 시 주보에도 자동 반영").
4. **기존 admin 주보 폼**(`src/components/weekly/WeeklyForm.tsx`, 690 lines)은 현재 필드에 대해선 완성도가 높지만, **신규 50+개 필드 + 동적 배열 입력 + 탭 네비게이션**이 필요하므로 구조적 재설계가 필요.
5. **레이아웃 불변 원칙**: 모든 매핑 함수(`weeklyToFrontData` / `weeklyToBackData`)는 slice 상한(news≤9, meetings≤6, dawn≤8, prayer≤7, schedule≤6, mokjang≤40, offerings≤11, newMembers≤4, servants≤9, supports≤3)을 반드시 유지. DB 레이어에서도 CHECK 제약 또는 admin UI 레벨에서 상한 강제.

---

## 1. 기술 스택 & 프로젝트 구조 (재확인)

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 16.2.2 (App Router, Turbopack) |
| UI | React 19 + TypeScript 5 + Tailwind 4 |
| DB/Auth | Supabase (@supabase/ssr 0.10) |
| 검증 | Zod (`src/lib/validation.ts`) |
| Admin 폼 | "use client" + useState (React Hook Form 미사용) |
| PDF | 자체 구현(`/api/weeklies/generate-pdf`) — 본 리팩터와 무관 |

**핵심 경로**
- 레이아웃(읽기전용·LAYOUT LOCKED): [BulletinFront.tsx](src/components/bulletin/BulletinFront.tsx), [BulletinBack.tsx](src/components/bulletin/BulletinBack.tsx)
- 매핑 함수(수정 대상): [BulletinFront.tsx:258](src/components/bulletin/BulletinFront.tsx:258) `weeklyToFrontData`, [BulletinBack.tsx:170](src/components/bulletin/BulletinBack.tsx:170) `weeklyToBackData`
- 타입: [src/types/notice.ts](src/types/notice.ts), [src/types/supabase.ts](src/types/supabase.ts)
- Admin 폼: [src/app/admin/weeklies/](src/app/admin/weeklies), [src/components/weekly/WeeklyForm.tsx](src/components/weekly/WeeklyForm.tsx)
- 검증: [src/lib/validation.ts](src/lib/validation.ts)
- Supabase: [src/lib/supabase/server.ts](src/lib/supabase/server.ts), [src/lib/supabase/client.ts](src/lib/supabase/client.ts)
- 마이그레이션: [supabase/migrations/003_notices_weeklies.sql](supabase/migrations/003_notices_weeklies.sql), [010_weeklies_content.sql](supabase/migrations/010_weeklies_content.sql)

---

## 2. 현재 DB / Weekly 타입 상태

### 2-1. `weeklies` 테이블 (현재)

003 + 010 마이그레이션 병합 결과 24개 컬럼:

| 컬럼 | 타입 | 용도 | 주보에서 사용중 |
|---|---|---|---|
| id | uuid PK | — | — |
| title | text | 주보 제목 | ✗ (폼 전용) |
| date | date | 발행일 | ✓ `dateStr` |
| pdf_url | text | PDF | 공개페이지 |
| created_at | timestamptz | — | — |
| volume | int | 권 | ✓ `volume` |
| issue | int | 호 | ✓ `issue` |
| hymn_number | text | 개회찬송 | ✗ (현재 미매핑) |
| scripture | text | 찬양 스크립처 | ✗ |
| special_praise | jsonb `{part1:{song,choir}, part2:{...}}` | 특별찬양 | ✗ |
| sermon_title | text | 설교 제목 | ✗ (worship.items에 별도) |
| sermon_pastor | text | 담당 목사 | ✗ |
| closing_hymn | text | 결단찬송 | ✗ |
| weekly_verse | text | 금주 암송말씀 | ✗ |
| afternoon_service | jsonb `{scripture,title,pastor}` | 오후예배 | ✓ `afternoonService.contents` |
| wednesday_service | jsonb `{scripture,title}` | 수요예배 | ✓ `wednesdayService.contents` |
| dawn_readings | jsonb `[{date,passage}]` | 새벽 | ✓ `dawnReadings` (slice 8) |
| offering_members | jsonb `{p1,p2,p3}` | 헌금위원 | ✓ `offeringCommittee` |
| prayer_items | jsonb `[{text}]` | 기도제목 | ✓ `prayerItems` (slice 7) |
| announcements | jsonb `[{text}]` | 공지 | ✗ |
| servants_text | text | 섬기는 분(문자열) | ✗ (컴포넌트는 구조체 요구) |
| offering_list_text | text | 헌금목록(문자열) | ✗ |
| is_published | bool | 발행상태 | — |
| publish_channels | jsonb `{website,alimtalk,instagram}` | 발행채널 | — |

### 2-2. `Weekly` 타입 ([src/types/notice.ts:59](src/types/notice.ts:59))
DB 컬럼과 1:1 대응. 추가로 `sogroup_text?: string | null`이 타입에만 있고 DB 컬럼 없음(레거시·제거 권장).

---

## 3. 주보 컴포넌트가 요구하는 전체 데이터 인벤토리

### 3-1. `FrontData` (페이지 1·4, `BulletinFront.tsx:72~96`)

사용자 분류에 맞춰 **[매주] / [마스터] / [정적]** 태깅:

| 필드 | 분류 | 현재 매핑 | 비고 |
|---|---|---|---|
| `volume`, `issue`, `dateStr` | 매주 | ✓ | 기본 |
| `vision[]` (5대 비전) | **정적** | DEFAULT | 사실상 불변 |
| `topicOfYear` (2026년 표어: "복음의 열매") | **마스터** | DEFAULT | 사용자 요구: 별도 DB, 연중 변경 가능 |
| `sundayTimes`, `address`, `phone`, `website` | 정적 | DEFAULT | 사이트 설정 |
| `news[]` (1~9번 교회소식: `{title, items[]}`) | **매주** | ✗ | 사용자 요구: 제목-내용 + 자동 번호 시퀀스 |
| `meetings[]` (9.모임표: `{group, when, place}`, MAX 6) | **매주** | ✗ | — |
| `northKoreaNote` | **매주** | ✗ | 북한선교부 문구 |
| `bibleReading` (10.성경 통독 현황) | **매주** | ✗ | — |
| `newMembers[]` (11.지난주 새가족: `{no, regNo, name, inviter, dept}`, MAX 4) | **매주** | ✗ | — |
| `mealDutyNote`, `volunteerNote` (12.식당봉사·봉사센터) | **매주** | ✗ | — |
| `servants[]` (섬기는 분: `{role, names}`, MAX 9) | **마스터** | ✗ | 연중 변경 시 자동 반영 |
| `supports[]` (후원분들: `{heading, lines[]}`, MAX 3섹션) | **마스터** | ✗ | 해외·국내·방송문화 3블록 |
| `worship.leader` | **매주** | ✗ | 1부/2부/3부 인도자 |
| `worship.items[]` (예배 순서 16항목: `{marker, label, content, assignees, subRows, emphasize}`) | **매주** | 부분 | 대표기도·성경봉독·찬양(subRows)·말씀 제목·결단찬송 모두 포함 |
| `worship.items[].subRows[]` | **매주** | ✗ | 찬양 1부/2부 분리 (content, assignee) |
| `worship.memorizeVerse` (`{ref, text}`) | **매주** | ✗ | 금주 암송말씀 |

### 3-2. `BulletinBackData` (페이지 2·3, `BulletinBack.tsx:14~43`)

| 필드 | 분류 | 현재 매핑 | 비고 |
|---|---|---|---|
| `afternoonService.time, leader` | **정적** | DEFAULT | "오후 2시 30분 / 이양재 목사" |
| `afternoonService.contents[]` (`{label, value, subValue?, mergeNextValue?}`) | **매주** | 부분 | scripture/title/pastor 매핑 중 |
| `wednesdayService.time, leader, contents[]` | **매주+정적** | 부분 | 동일 |
| `nextWeekPrayer[]` (다음주 기도 1부/2부/3부 이름, MAX 3) | **매주** | ✗ | — |
| `offeringCommittee[]` (`{part, names}`, MAX 3) | **매주** | ✓ | 1부/2부/3부 이름 |
| `guideCommittee[]` (`{part, indoor, outdoor}`, MAX 3) | **매주** | ✗ | — |
| `dawnReadings[]` (`{date, passage}`, MAX 8) | **매주** | ✓ | pairRows 4행 |
| `prayerItems[]` (교회공동체 기도제목, MAX 7) | **마스터** | ✓ (현재 weekly에 저장) | 사용자 요구: 마스터 이전 |
| `serviceSchedule[]` (예배모임 안내, MAX 6) | **정적** | DEFAULT | 사실상 불변 |
| `mokjangList[]` (`{id, name, sub}`, MAX 40) | **마스터** | ✗ | 연중 교체 |
| `offerings[]` (향기로운 예물, `{label, names}`, MAX 11) | **매주** | ✗ | 십일조·감사 등 |
| `weekTotal`, `cumulativeTotal` | **매주** | DEFAULT | 이번주/누계 금액 |
| `accountNote` | 정적 | DEFAULT | 계좌번호 안내 |

### 3-3. 신규 필드 총량
- **매주 변하는 신규 필드 세트**: `news, meetings, northKoreaNote, bibleReading, newMembers, mealDutyNote, volunteerNote, worship(leader+items+memorizeVerse), nextWeekPrayer, guideCommittee, offerings, weekTotal, cumulativeTotal` — 약 13개 필드 그룹
- **마스터 데이터 테이블**: `topicOfYear, servants, supports, prayerItems(교회공동체), mokjangList` — 5개 마스터
- **정적 상수(코드 유지)**: `vision, sundayTimes, address, phone, website, serviceSchedule, afternoonService.time/leader, accountNote`

---

## 4. DB 스키마 설계안

### 4-1. 설계 원칙
1. **주보 전용 필드는 `weeklies` 본 테이블 확장 + 배열은 자식 테이블 또는 JSONB로**. 접근 패턴(조회는 주보 단위, 갱신도 단위)을 보면 JSONB가 구현 단순함 — **권장: JSONB + Zod 타입검증**.
2. **마스터 데이터는 별도 테이블**로 분리. 주보는 마스터 ID를 **참조하지 않고**, 렌더 시점에 조회(Live Reference). 이유: 사용자가 "마스터 수정 시 과거 주보도 자동 반영"을 원함.
3. **상한(슬라이스) 강제**: DB는 배열 길이를 자체 제약하기 어려우므로 Zod + admin UI에서 강제. 레이아웃은 어쨌든 `.slice(0, N)`로 자체 방어.

### 4-2. `weeklies` 테이블 확장 (마이그레이션 011)

```sql
ALTER TABLE public.weeklies
  -- 페이지1 교회소식(제목+items 배열, seq는 배열 인덱스 사용)
  ADD COLUMN IF NOT EXISTS news                   jsonb DEFAULT '[]',
  -- 9.모임표 (group/when/place, MAX 6)
  ADD COLUMN IF NOT EXISTS meetings               jsonb DEFAULT '[]',
  -- 각종 단문 노트
  ADD COLUMN IF NOT EXISTS north_korea_note       text,
  ADD COLUMN IF NOT EXISTS bible_reading          text,
  ADD COLUMN IF NOT EXISTS meal_duty_note         text,
  ADD COLUMN IF NOT EXISTS volunteer_note         text,
  -- 11.새가족 (MAX 4)
  ADD COLUMN IF NOT EXISTS new_members            jsonb DEFAULT '[]',
  -- 예배 순서 (구조체 16항목 + memorizeVerse)
  ADD COLUMN IF NOT EXISTS worship_leader         text,
  ADD COLUMN IF NOT EXISTS worship_items          jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS memorize_verse         jsonb DEFAULT '{"ref":"","text":""}',
  -- 다음주 기도 (MAX 3: 1부/2부/3부)
  ADD COLUMN IF NOT EXISTS next_week_prayer       jsonb DEFAULT '[]',
  -- 안내위원 (MAX 3)
  ADD COLUMN IF NOT EXISTS guide_committee        jsonb DEFAULT '[]',
  -- 향기로운 예물 (MAX 11)
  ADD COLUMN IF NOT EXISTS offerings              jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS week_total             text,
  ADD COLUMN IF NOT EXISTS cumulative_total       text;

-- 기존 servants_text, offering_list_text, sogroup_text은 deprecated 처리
-- (컴포넌트는 구조체 `servants[{role,names}]`을 요구하므로 문자열 버전은 사용 불가.
--  DB 컬럼은 유지하되 폼에서 삭제, 나중에 drop 마이그레이션)
```

### 4-3. 마스터 테이블 (마이그레이션 012)

```sql
-- 연간 표어
CREATE TABLE IF NOT EXISTS public.church_settings (
  key   text PRIMARY KEY,        -- 'topic_of_year' 등
  value jsonb NOT NULL,          -- { "text": "복음의 열매", "year": 2026 }
  updated_at timestamptz DEFAULT now()
);

-- 소그룹 목장 (연중 유지, 개편 시 일괄 교체)
CREATE TABLE IF NOT EXISTS public.mokjang_entries (
  id      int PRIMARY KEY,        -- 1~40 (주보상의 목장 번호)
  name    text NOT NULL,          -- 목자
  sub     text,                   -- 부목자
  active  boolean DEFAULT true,
  year    int                     -- 2026
);

-- 섬기는 분들 (역할별 9행, 순서 중요)
CREATE TABLE IF NOT EXISTS public.servants (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq     int NOT NULL,           -- 표시 순서 (1~9)
  role    text NOT NULL,          -- "담 임 목 사"
  names   text NOT NULL           -- "이양재" (줄바꿈 허용)
);

-- 후원하는 분들 (섹션 3개 + 각 섹션의 줄들)
CREATE TABLE IF NOT EXISTS public.support_sections (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq     int NOT NULL,           -- 1~3
  heading text NOT NULL,          -- "<해외선교지>"
  lines   jsonb NOT NULL          -- ["라인1","라인2",...]
);

-- 교회공동체 기도제목 (MAX 7, 마스터에 두고 주 단위 수정)
CREATE TABLE IF NOT EXISTS public.community_prayers (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq     int NOT NULL,           -- 1~7
  text    text NOT NULL
);

-- RLS: 모든 마스터 테이블은 공개 읽기 + admin 쓰기
ALTER TABLE public.church_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mokjang_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_prayers ENABLE ROW LEVEL SECURITY;
-- (정책은 기존 weeklies 정책 참고하여 동일 패턴 적용)
```

### 4-4. JSONB 내부 스키마 (Zod로 강제)

```ts
// news
{ title: string, items: string[] }[]               // MAX 9

// meetings
{ group: string, when: string, place: string }[]   // MAX 6

// new_members
{ no: string, regNo: string, name: string, inviter: string, dept: string }[]  // MAX 4

// worship_items
{
  marker?: "※" | string,
  label: string,
  content?: string,
  assignees?: string | string[],
  subRows?: { content: string, assignee: string }[],
  emphasize?: boolean
}[]                                                 // 일반적으로 16~18

// next_week_prayer
string[]                                            // [p1, p2, p3]

// guide_committee
{ part: string, indoor: string, outdoor: string }[] // MAX 3

// offerings
{ label: string, names: string }[]                  // MAX 11
```

---

## 5. 매핑 함수 개편 (`weeklyToFrontData` / `weeklyToBackData`)

### 5-1. 시그니처 변경

현재:
```ts
export function weeklyToFrontData(w: Weekly, overrides?: Partial<FrontData>): FrontData
```

변경 후(마스터 데이터를 인자로 주입):
```ts
interface MasterData {
  topicOfYear: string;
  servants: ServantGroup[];
  supports: SupportSection[];
  communityPrayers: string[];
  mokjangList: MokjangEntry[];
}

export function weeklyToFrontData(
  w: Weekly,
  master: MasterData,
  overrides?: Partial<FrontData>
): FrontData

export function weeklyToBackData(
  w: Weekly,
  master: MasterData,
  overrides?: Partial<BulletinBackData>
): BulletinBackData
```

### 5-2. Data Loader 유틸 (신규)

`src/lib/bulletin/load.ts`:
```ts
export async function loadWeeklyWithMaster(weeklyId: string) {
  const supabase = await createServerClient();
  const [weekly, settings, mokjang, servants, supports, prayers] =
    await Promise.all([
      supabase.from("weeklies").select("*").eq("id", weeklyId).single(),
      supabase.from("church_settings").select("*").eq("key", "topic_of_year").single(),
      supabase.from("mokjang_entries").select("*").order("id"),
      supabase.from("servants").select("*").order("seq"),
      supabase.from("support_sections").select("*").order("seq"),
      supabase.from("community_prayers").select("*").order("seq"),
    ]);
  return { weekly: weekly.data, master: buildMaster(...) };
}
```

### 5-3. `/test-front`, `/weekly/[id]` 공개 페이지 수정
- 현재 `/test-front`는 client component 내부에서 dummyWeekly로 렌더. **유지**(템플릿 샘플).
- 실제 공개 페이지(`src/app/(public)/weekly/[id]/page.tsx`)는 서버 컴포넌트화하여 `loadWeeklyWithMaster` 호출 후 `BulletinFront/Back` 렌더.

### 5-4. 레이아웃 보호(LAYOUT LOCKED) 원칙 재확인
- 매핑 함수에서 모든 배열은 `.slice(0, N)`으로 상한 강제.
- 컴포넌트 내부 slice는 절대 제거 금지(이중 방어).
- 매핑 함수 상단에 큼직한 주석 추가 예정:
  ```
  // ⚠️ 이 함수는 LAYOUT LOCKED 컴포넌트의 입력을 만드는 매핑 함수입니다.
  // 필드 추가·제거 시 반드시 BulletinFront.tsx / BulletinBack.tsx의 FrontData / BulletinBackData 타입과 1:1 대응해야 합니다.
  // 모든 배열 필드는 slice(0, N)로 상한을 강제합니다.
  ```

---

## 6. Admin 주보 생성 폼 개편

### 6-1. 현재 폼 현황
- 파일: [src/components/weekly/WeeklyForm.tsx](src/components/weekly/WeeklyForm.tsx) (690 lines, 단일 컴포넌트, scroll 방식)
- 섹션 8개: 기본정보 / 주일예배 / 오후예배 / 수요예배 / 새벽일기 / 기도제목 / 공지사항 / 헌금목록
- 동적배열 3개: `dawn_readings`, `prayer_items`, `announcements` — add/update/remove 함수 수동 구현
- 검증: Zod `WeeklyContentSchema`
- 저장: 클라이언트에서 `supabase.insert()/update()` 직접 호출
- `applyPlaceholderDefaults()`: 빈 필드에 샘플값 채우는 헬퍼(매우 유용, 확장 시 유지)

### 6-2. 개편 필요 사항

#### A. 탭 네비게이션 도입
기존 단일 스크롤 → 섹션 탭으로 전환. 현재 8 → 12+ 섹션으로 증가하므로 사용자 경험상 필수.
- 신규 컴포넌트: [src/components/form/FormTabs.tsx](src/components/form/FormTabs.tsx)
- 탭 구조 제안:
  1. 기본정보 (title, date, volume, issue, is_published, publish_channels)
  2. 1페이지-예배순서 (`worship_leader`, `worship_items`, `memorize_verse`)
  3. 1페이지-교회소식 (`news[]`, `meetings[]`, `north_korea_note`, `bible_reading`, `new_members[]`, `meal_duty_note`, `volunteer_note`)
  4. 2페이지-오후/수요예배 (기존 + leader 선택)
  5. 2페이지-다음주 기도/헌금위원/안내위원 (`next_week_prayer`, `offering_members`, `guide_committee`)
  6. 2페이지-새벽 예배 (`dawn_readings`)
  7. 3페이지-향기로운 예물 (`offerings`, `week_total`, `cumulative_total`)
  8. 발행/미리보기

#### B. 재사용 컴포넌트 추상화
동적 배열 입력이 10+ 곳에서 반복됨. 제네릭 컴포넌트 신설:
```tsx
// src/components/form/DynamicArrayField.tsx (신규)
<DynamicArrayField<NewsItem>
  items={form.news}
  onChange={(items) => setForm({ ...form, news: items })}
  max={9}                          // 상한
  defaultItem={{ title: "", items: [] }}
  renderItem={(item, update) => (
    <>
      <input value={item.title} onChange={e => update({ title: e.target.value })} />
      {/* 내부 items도 동적 배열로 중첩 */}
    </>
  )}
/>
```

#### C. 마스터 데이터 관리 별도 admin 페이지
주보 폼에서는 마스터 데이터를 직접 편집 **안 함**. 별도 페이지에서 관리:
- `/admin/masters/topic` — 연간 표어
- `/admin/masters/mokjang` — 소그룹 목장(40개 테이블 편집)
- `/admin/masters/servants` — 섬기는 분들
- `/admin/masters/supports` — 후원하는 분들
- `/admin/masters/community-prayers` — 교회공동체 기도제목(7개)

각 페이지는 단순한 CRUD — 기존 notices 패턴 재사용.

#### D. 미리보기 통합
- 저장 후 `/test-front`와 동일한 4페이지 미리보기를 우측 패널 또는 모달로 제공.
- 현재 `weeklyToFrontData/BackData` + 신규 master 로더를 재사용.
- 폼 상태를 그대로 넘기면 되므로 구현 부담 낮음.

#### E. Zod 스키마 대폭 확장
[src/lib/validation.ts](src/lib/validation.ts)의 `WeeklyContentSchema`에 신규 필드 추가. 각 배열은 `.max(N)`로 상한 강제:
```ts
news: z.array(z.object({ title: z.string().max(100), items: z.array(z.string().max(300)).max(10) })).max(9),
meetings: z.array(...).max(6),
// etc.
```

#### F. 기존 필드 폐기
- `servants_text`, `offering_list_text`, `sogroup_text`: 구조체 데이터로 대체되므로 폼에서 제거.
- 마이그레이션: 당장은 컬럼 유지(데이터 손실 방지). 최종 릴리스 후 drop.

### 6-3. 재사용 가능 자원
- ✅ [src/lib/supabase/client.ts](src/lib/supabase/client.ts) — 기존 유지
- ✅ [SectionTitle, Field, inputCls, textareaCls](src/components/weekly/WeeklyForm.tsx:21) — 그대로 사용
- ✅ `applyPlaceholderDefaults()` — 샘플 데이터 채우기, 신규 필드에도 확장
- ✅ `WeeklyContentSchema` — 확장
- ✅ notices/gallery/shorts의 CRUD 패턴 — 마스터 관리 페이지 참고

### 6-4. 신규 개발 필요
- 🔧 `FormTabs.tsx`
- 🔧 `DynamicArrayField.tsx` (제네릭)
- 🔧 `NestedDynamicArrayField.tsx` (news의 items[] 같은 중첩 배열)
- 🔧 `MasterDataLoader` 훅(마스터 데이터 fetch + 캐싱)
- 🔧 `BulletinPreview.tsx` — 우측 미리보기 패널

---

## 7. 단계별 구현 계획 (순서 권장)

| 단계 | 작업 | 소요 예상 | 선행 의존 |
|---|---|---|---|
| 1 | 마이그레이션 011 작성 + 적용 (`weeklies` 신규 컬럼) | 30분 | — |
| 2 | 마이그레이션 012 작성 + 적용 (마스터 테이블) | 30분 | — |
| 3 | `Weekly` 타입 확장 + Zod 스키마 확장 | 1시간 | 1, 2 |
| 4 | `weeklyToFrontData` / `weeklyToBackData` 매핑 확장 (master 인자 추가) | 1~2시간 | 3 |
| 5 | `loadWeeklyWithMaster()` 유틸 작성 | 30분 | 4 |
| 6 | 공개 페이지(`/weekly/[id]`) 서버 컴포넌트화 + 연동 | 1시간 | 5 |
| 7 | `/test-front`에 마스터 mock 주입 유지 | 15분 | 5 |
| 8 | 마스터 관리 admin 페이지 5개 CRUD | 3~5시간 | 2 |
| 9 | `DynamicArrayField`, `FormTabs` 추상 컴포넌트 | 2~3시간 | — |
| 10 | 주보 폼(`WeeklyForm.tsx`) 탭 재구성 + 신규 필드 입력 UI | 5~8시간 | 3, 9 |
| 11 | `BulletinPreview` 미리보기 패널 | 1~2시간 | 4, 6 |
| 12 | `applyPlaceholderDefaults` 확장 + 제거된 text 필드 폼에서 삭제 | 30분 | 10 |
| 13 | 통합 테스트(생성 → DB 확인 → `/test-front`/실 주보 미리보기 → 레이아웃 회귀 확인) | 2시간 | 11 |

총 예상: **약 4~6일(단독 작업 기준)**, 단계적 PR로 분할 권장.

---

## 8. 주의사항 / 리스크

1. **레이아웃 불변 원칙 재확인**: 매핑 함수에서 slice 상한 누락 시 페이지 높이 초과로 인쇄·PDF 깨짐. 이중 방어(컴포넌트 내부 slice + 매핑 함수 slice) 유지.
2. **마스터 데이터 실시간 반영의 부작용**: 과거 주보를 다시 렌더하면 그 시점과 다른 마스터 데이터로 보일 수 있음(예: 2025년 주보인데 2026년 목장 명단 노출). **필요 시 `weeklies.snapshot_master jsonb` 컬럼을 추가해 발행 시점 스냅샷 저장 옵션 제공**(사용자 요구와 약간 다르지만 발행 후 아카이브 무결성 확보). 사용자 확인 필요 포인트.
3. **RLS 정책 누락 주의**: 마스터 테이블은 공개 읽기가 필요(주보는 누구나 볼 수 있어야 함).
4. **servants_text/offering_list_text 기존 데이터**: 운영 중인 주보가 있다면 마이그레이션 시 수동 변환 스크립트 필요.
5. **Zod max 값은 컴포넌트 slice 값과 정확히 일치**시킬 것 — 두 곳이 어긋나면 UI 혼란.
6. **`applyPlaceholderDefaults` 확장 시 실제 테스트 샘플 데이터**도 업데이트해야 `/test-front`가 정상 동작함.

---

## 9. 다음 액션

사용자 확인 필요 포인트:
- [ ] **마스터 데이터 스냅샷 여부**: 과거 주보도 발행 시점 마스터로 고정할지, 항상 현재 마스터를 보여줄지. (본 보고서 기본 가정: 항상 현재 마스터 = Live Reference).
- [ ] **교회공동체 기도제목**을 마스터로 볼지 매주로 볼지. 사용자 분류에는 마스터로 기재됐으나 실제 운영상 매주 교체될 가능성이 있음 — 확인 필요.
- [ ] **2026년 표어 변경 주기**: 연 1회 변경이면 `church_settings` key-value로 충분. 특별절기마다 변경되면 별도 테이블 권장.
- [ ] **구현 우선순위**: 마이그레이션 → 매핑 함수 확장 → 공개 페이지 연동 → 마스터 admin → 주보 폼 순으로 진행할지, 아니면 주보 폼 먼저 갖추고 단계적 DB 연동할지.
- [ ] **기존 `servants_text`, `offering_list_text`, `announcements`, `sogroup_text`, `hymn_number`, `scripture`, `special_praise`, `sermon_title/pastor`, `closing_hymn`, `weekly_verse` 필드 처리**: 이들은 현재 `weeklies`에 있으나 대부분 신규 구조(worship_items, memorize_verse 등)로 대체된다. 삭제할지, 유지할지 결정 필요.

위 4개 결정이 끝나면 단계 1(마이그레이션 011)부터 바로 착수 가능.
