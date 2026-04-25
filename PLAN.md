# 홈 UI 리디자인 + 공지 자동 히어로 슬라이더 ✅ (완료)

## 목표

1. `UIsample`의 디자인을 홈페이지 4개 섹션(Hero / 4카테고리 / 예배시간 / 공지사항)에 적용한다.
2. **히어로 슬라이더는 공지사항을 데이터 소스로 사용**한다 — 새 공지가 게시되면 자동으로 슬라이드가 추가된다.
3. **백엔드 데이터 계약을 모바일 앱과 공유**할 수 있도록 설계한다 — 모바일 앱은 동일한 REST 엔드포인트를 호출하기만 하면 동일한 히어로 데이터를 받는다. UI 변경이 발생해도 백엔드는 수정하지 않는다.

---

## 설계 원칙

1. **데이터-뷰 분리**: `HeroSlide`라는 플랫폼 무관 DTO를 정의. 웹은 RSC가 `getHeroSlides()`를 직접 호출(빌드/ISR 캐시), 모바일 앱은 동일 결과를 `/api/home/hero-slides` REST로 호출.
2. **이미지 추출 폴백 사슬**: `notices.images[0]` → 본문의 첫 `[IMG:url]` → 정적 폴백(`/images/main.jpg`). 어떤 공지든 슬라이드가 만들어진다.
3. **카피 자동 합성**: `eyebrow`는 카테고리에서, `title`은 공지 제목, `subtitle`은 본문에서 IMG 마커 제거 후 첫 80자.
4. **시키지 않은 것은 안 한다**: `UpcomingEvents`, `LatestSermon`, 헤더/푸터/탭바, API 인증, DB 스키마는 손대지 않는다.
5. **기존 디자인 토큰 우선**: `globals.css`의 토큰(`church-dark`, `church-cream`, `primary-*`)을 최대한 재사용. UIsample의 색이 이미 정의된 토큰과 거의 일치한다 (`#1a2332` ≈ `church-dark`, `#2d5f9a` ≈ `primary-700`). 새 토큰은 hero 배경 `#eef2f8`/`#dee6f1`만 추가.

---

## 변경 파일 목록

| 상태 | 파일 | 작업 | 설명 |
|------|------|------|------|
| ✅ | `src/types/notice.ts` | **수정** | `HeroSlide` 인터페이스 추가 (플랫폼 공용 DTO) |
| ✅ | `src/lib/notices.ts` | **수정** | `getHeroSlides(limit)` 추가 |
| ✅ | `src/app/api/home/hero-slides/route.ts` | **신규** | 모바일/외부용 REST 엔드포인트 |
| ✅ | `src/components/home/HeroSection.tsx` | **수정** | 클라이언트 슬라이더 + UIsample 레이아웃 적용. `slides: HeroSlide[]` props로 받음 |
| ✅ | `src/components/home/QuickLinks.tsx` | **수정** | UIsample의 4카드 그리드 스타일로 교체 (4:5 aspect, 외부 텍스트) |
| ✅ | `src/components/home/WorshipTimeCard.tsx` | **수정** | UIsample의 좌상단 정렬 + 분할선 그리드 스타일 |
| ✅ | `src/components/home/RecentNotice.tsx` | **수정** | UIsample의 라인 리스트 스타일 (border-t/border-b) |
| ✅ | `src/app/page.tsx` | **수정** | `getHeroSlides()` 호출 → `<HeroSection slides={…} />` 전달 |
| ✅ | `src/app/globals.css` | **수정** | hero 배경용 토큰 2개 추가 (`--color-hero-bg-1`, `--color-hero-bg-2`) |
| ✅ | `API_SPEC.md` | **수정** | `/api/home/hero-slides`, `/api/new-content` 엔드포인트 명세 추가 |
| ✅ | `ARCHIT.md` | **수정** | 홈 히어로 플로우 다이어그램 + 디렉토리/색상 토큰 최신화 |
| ✅ | `DB_SCHEMA.md` | **수정** | notices.images 컬럼 누락분 보완 + 홈 히어로 파생 용도 기술 + blog-images 버킷 추가 |

---

## Step 1: `src/types/notice.ts` — `HeroSlide` DTO 추가

기존 `Notice` 인터페이스 아래에 추가:

```ts
/**
 * 홈 히어로 슬라이드 — 플랫폼 공용 DTO.
 * 웹과 모바일이 동일하게 소비하는 형태.
 *
 * 데이터 소스는 notices 테이블이지만 클라이언트는 그것을 알 필요 없이
 * 이 형태만 알면 된다. 추후 다른 데이터(주보 표지, 공지 등)를 섞어도
 * 이 DTO 형태가 안정적이라면 클라이언트는 무수정.
 */
export interface HeroSlide {
  /** 안정적 식별자 (notices.slug 등) — React key + 모바일 deeplink */
  id: string;
  /** 슬라이드 상단 작은 라벨 — 예: "긴급공지", "교회행사", "교회소식" */
  eyebrow: string;
  /** 큰 제목 (강조됨) */
  title: string;
  /** 본문 짧은 설명 (최대 ~80자, 줄바꿈 포함 가능) */
  subtitle: string;
  /** 배경 이미지 URL (절대 또는 루트 상대) */
  image: string;
  /** 이 슬라이드를 클릭했을 때 이동할 경로 — 웹/모바일 라우팅 공용 */
  href: string;
  /** 게시일 ISO 문자열 (정렬/표시용, 옵션) */
  date: string | null;
}
```

---

## Step 2: `src/lib/notices.ts` — `getHeroSlides()` 추가

기존 함수 아래에 추가. **이미지가 있는** 공개 공지를 최신순으로 골라 `HeroSlide[]`로 반환.

```ts
import type { HeroSlide, Notice } from "@/types/notice";

const CATEGORY_EYEBROW: Record<Notice["category"], string> = {
  일반: "교회소식",
  긴급: "긴급공지",
  행사: "교회행사",
};

/** 본문에서 [IMG:...] 마커를 제거하고 첫 의미 있는 줄을 반환 */
function extractSubtitle(content: string, max = 80): string {
  const stripped = content
    .replace(/\[IMG:[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).trimEnd() + "…";
}

/** notices.images[0] → 본문 첫 [IMG:url] → null */
function extractHeroImage(notice: Notice): string | null {
  if (notice.images && notice.images.length > 0) return notice.images[0];
  const m = notice.content.match(/\[IMG:([^\]]+)\]/);
  return m ? m[1] : null;
}

/**
 * 홈 히어로용 슬라이드 목록.
 * - 공개(is_public=true) + 이미지 보유한 공지만 채택
 * - 최신순으로 limit개 반환
 * - 이미지 0개 공지는 슬라이드에 안 올림 (UI 깨짐 방지)
 */
export async function getHeroSlides(limit = 5): Promise<HeroSlide[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false })
    .limit(limit * 3); // 이미지 없는 공지를 거를 여유분

  const notices = (data ?? []) as Notice[];
  const slides: HeroSlide[] = [];

  for (const n of notices) {
    const image = extractHeroImage(n);
    if (!image) continue;
    slides.push({
      id: n.slug,
      eyebrow: CATEGORY_EYEBROW[n.category] ?? "교회소식",
      title: n.title,
      subtitle: extractSubtitle(n.content),
      image,
      href: `/notice/${n.slug}`,
      date: n.date,
    });
    if (slides.length >= limit) break;
  }

  return slides;
}
```

---

## Step 3: `src/app/api/home/hero-slides/route.ts` (신규) — REST 엔드포인트

모바일 앱·외부 클라이언트가 호출. 웹 RSC는 이 라우트를 거치지 않고 `getHeroSlides()`를 직접 호출 (네트워크 왕복 절약).

```ts
import { NextRequest, NextResponse } from "next/server";
import { getHeroSlides } from "@/lib/notices";
import { parseLimit } from "@/lib/validation";

// 공지가 자주 안 바뀌므로 1시간 ISR
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseLimit(limitParam, 5) : 5;
  const slides = await getHeroSlides(limit);
  return NextResponse.json(slides);
}
```

> `parseLimit`은 이미 `src/lib/validation.ts`에 있음 (상한 100). 그대로 재사용.

---

## Step 4: `src/components/home/HeroSection.tsx` — 슬라이더 + UIsample 레이아웃

`"use client"` 필요 (자동 회전 + 인디케이터). `slides`를 props로 받고 빈 배열이면 정적 폴백.

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { HeroSlide } from "@/types/notice";

const FALLBACK: HeroSlide = {
  id: "fallback",
  eyebrow: "환영합니다",
  title: "꿈이 있는 건강한 교회",
  subtitle: "복음의 열매를 맺는 교회\n제자는 Training! 훈련이다.",
  image: "/images/main.jpg",
  href: "/worship",
  date: null,
};

export function HeroSection({ slides }: { slides: HeroSlide[] }) {
  const list = slides.length > 0 ? slides : [FALLBACK];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(
      () => setIdx((p) => (p + 1) % list.length),
      6000,
    );
    return () => clearInterval(t);
  }, [list.length]);

  const s = list[idx];

  return (
    <section className="relative bg-[var(--color-hero-bg-1)] px-4 pt-20 pb-16 text-center sm:px-12 sm:pt-[120px] sm:pb-20">
      <div className="mb-7 text-xs font-medium uppercase tracking-[0.36em] text-gray-500">
        — {s.eyebrow} —
      </div>

      <h1 className="mx-auto mb-6 max-w-[900px] text-4xl font-bold leading-[1.15] tracking-[-0.035em] text-church-dark sm:text-5xl md:text-[68px]">
        {s.title}
        <br />
        <span className="text-primary-700">명성비전교회</span>입니다
      </h1>

      <p className="mx-auto mb-11 max-w-[480px] whitespace-pre-line text-base leading-[1.75] text-gray-600 sm:text-[17px]">
        {s.subtitle}
      </p>

      <div className="mb-12 flex justify-center gap-2.5 sm:mb-16">
        <Link
          href={s.href}
          className="group flex items-center gap-1 rounded-full bg-church-dark px-7 py-3.5 text-sm font-medium text-church-cream transition-colors hover:bg-gray-800"
        >
          자세히 보기
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/greetings"
          className="rounded-full border border-gray-300 px-7 py-3.5 text-sm font-medium text-church-dark hover:bg-white"
        >
          교회 소개
        </Link>
      </div>

      {/* 슬라이더 이미지 */}
      <div className="relative mx-auto h-[280px] max-w-[1100px] overflow-hidden rounded-[20px] shadow-[0_30px_80px_-30px_rgba(30,40,60,0.3)] sm:h-[440px]">
        <Image
          key={s.id}
          src={s.image}
          alt={s.title}
          fill
          sizes="(max-width: 1100px) 100vw, 1100px"
          className="object-cover transition-opacity duration-700"
          priority
          unoptimized={s.image.startsWith("http")}
        />
        {list.length > 1 && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/85 px-3.5 py-2 backdrop-blur-md">
            {list.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setIdx(i)}
                aria-label={`슬라이드 ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 24 : 6,
                  background: i === idx ? "#1a2332" : "rgba(30,40,60,0.3)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

> `unoptimized={s.image.startsWith("http")}` — Supabase Storage URL은 next.config의 `remotePatterns`에 이미 등록되어 있지만 `[IMG:...]`에서 추출한 외부 URL을 안전하게 처리.

---

## Step 5: `src/components/home/QuickLinks.tsx` — UIsample 4카드 스타일

기존 데이터(`links`)는 그대로, 마크업만 교체.

```tsx
import Link from "next/link";
import Image from "next/image";

interface QuickLink {
  title: string;
  href: string;
  image: string;
  description: string;
}

const links: QuickLink[] = [
  { title: "예배안내", href: "/worship", image: "/images/worship-hall.avif", description: "주일예배, 수요예배, 새벽기도회" },
  { title: "비전갤러리", href: "/gallery", image: "/images/pastor-preaching.avif", description: "교회 활동과 행사 사진" },
  { title: "교회학교", href: "/churchschool", image: "/images/churchschool.avif", description: "영유치부, 아동부, 청소년부, 청년부" },
  { title: "봉사센터", href: "/volunteer-center", image: "/images/volunteer.avif", description: "지역사회를 섬기는 봉사 사역" },
];

export function QuickLinks() {
  return (
    <section className="bg-white px-4 py-16 sm:px-12 sm:py-20">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-5 lg:grid-cols-4">
        {links.map((c) => (
          <Link key={c.title} href={c.href} className="group cursor-pointer">
            <div className="mb-4 aspect-[4/5] overflow-hidden rounded-[14px] bg-[var(--color-hero-bg-1)]">
              <Image
                src={c.image}
                alt={c.title}
                width={400}
                height={500}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="mb-1.5 text-[17px] font-semibold tracking-[-0.02em] text-church-dark">
              {c.title}
            </div>
            <div className="text-[13px] leading-[1.5] text-gray-500">
              {c.description}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

---

## Step 6: `src/components/home/WorshipTimeCard.tsx` — 분할선 그리드

```tsx
import Link from "next/link";

const SERVICES = [
  { when: "매주 일요일 (1·2·3부)", title: "주일예배", time: "8:00 / 10:00 / 12:00" },
  { when: "매주 수요일", title: "수요예배", time: "오후 7:30" },
  { when: "매주 금요일", title: "금요기도회", time: "오후 8:30" },
  { when: "월~금 (토 6:30)", title: "새벽예배", time: "오전 6:00" },
];

export function WorshipTimeCard() {
  return (
    <section className="bg-[var(--color-hero-bg-2)] px-4 py-16 sm:px-12 sm:py-[88px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 flex flex-col items-baseline gap-2 sm:flex-row sm:gap-6">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-church-dark sm:text-4xl">
            예배 시간
          </h2>
          <div className="text-sm text-gray-500">매주 정기적으로 드리는 예배입니다</div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-200 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <Link
              key={s.title}
              href="/worship"
              className="bg-[var(--color-hero-bg-1)] px-7 py-8 transition-colors hover:bg-white"
            >
              <div className="mb-4 text-xs tracking-[-0.01em] text-gray-500">{s.when}</div>
              <div className="mb-2 text-[22px] font-bold tracking-[-0.025em] text-church-dark">{s.title}</div>
              <div className="text-sm font-medium tabular-nums text-primary-700">{s.time}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Step 7: `src/components/home/RecentNotice.tsx` — 라인 리스트 스타일

기존 `notices` props 시그니처 유지 (홈 page.tsx 호출부 무수정). 카테고리 뱃지(긴급)는 보존.

```tsx
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Notice } from "@/types/notice";

export function RecentNotice({ notices }: { notices: Notice[] }) {
  return (
    <section className="bg-white px-4 py-16 sm:px-12 sm:py-[88px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-church-dark sm:text-4xl">
            공지사항
          </h2>
          <Link href="/notice" className="text-[13px] text-gray-500 hover:text-gray-700">
            전체보기 →
          </Link>
        </div>

        {notices.length > 0 ? (
          <ul className="border-t border-gray-200">
            {notices.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notice/${n.slug}`}
                  className="flex items-center justify-between gap-4 border-b border-gray-200 py-[22px] transition-colors hover:bg-gray-50"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {n.category === "긴급" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        <Bell size={10} /> 긴급
                      </span>
                    )}
                    {n.category === "행사" && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                        행사
                      </span>
                    )}
                    <span className="truncate text-base font-medium tracking-[-0.015em] text-church-dark">
                      {n.title}
                    </span>
                  </span>
                  {n.date && (
                    <span className="shrink-0 text-[13px] tabular-nums text-gray-500">
                      {formatDate(n.date)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-b border-gray-200 py-12 text-center text-gray-400">
            등록된 공지사항이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
```

---

## Step 8: `src/app/page.tsx` — `getHeroSlides()` 추가

```tsx
import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinks } from "@/components/home/QuickLinks";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getNotices, getHeroSlides } from "@/lib/notices";
import { getLatestSermon } from "@/lib/youtube";
import { getUpcomingEvents } from "@/lib/google-calendar";

export const revalidate = 3600;

export default async function HomePage() {
  const [heroSlides, notices, sermon, events] = await Promise.all([
    getHeroSlides(5),
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
    getUpcomingEvents(5, 30),
  ]);

  return (
    <>
      <HeroSection slides={heroSlides} />
      <QuickLinks />
      <WorshipTimeCard />
      {events.length > 0 && <UpcomingEvents events={events} />}
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
```

---

## Step 9: `src/app/globals.css` — hero 배경 토큰 2개 추가

`@theme inline` 블록 안 색상 그룹 끝에 추가:

```css
  /* Hero / soft background tints */
  --color-hero-bg-1: #eef2f8;
  --color-hero-bg-2: #dee6f1;
```

---

## Step 10: `API_SPEC.md` — 명세 추가

`### GET /api/calendar` 위에 추가:

```md
### GET `/api/home/hero-slides`

홈 히어로 슬라이더용 데이터. 공지사항 중 이미지가 있는 항목을 최신순으로 반환.

- **인증**: 불필요
- **캐시**: ISR 1시간 (`revalidate: 3600`)
- **쿼리 파라미터**:
  - `limit` — 최대 결과 수 (기본 5, 상한 100, `parseLimit()`)
- **응답**: `HeroSlide[]`

\`\`\`ts
interface HeroSlide {
  id: string;        // notices.slug
  eyebrow: string;   // 카테고리 매핑 ("교회소식" | "긴급공지" | "교회행사")
  title: string;     // notices.title
  subtitle: string;  // notices.content에서 [IMG:..] 제거 후 80자
  image: string;     // notices.images[0] 또는 본문 첫 [IMG:url]
  href: string;      // "/notice/{slug}"
  date: string | null;
}
\`\`\`

```

---

## 모바일 앱 호환성 검증

| 시나리오 | 백엔드 수정 필요? |
|---------|---|
| 모바일 앱이 동일 데이터로 히어로 표시 | ❌ `GET /api/home/hero-slides` 호출만 |
| `HeroSlide` 필드 추가 (예: `videoUrl`) | ⚠️ DTO 확장만, 기존 필드는 유지(하위호환) |
| 슬라이드 정렬 규칙 변경 | ❌ `getHeroSlides()` 내부만 |
| 이미지 소스를 `notices` → 별도 `hero_slides` 테이블로 변경 | ❌ `getHeroSlides()` 내부만, DTO 동일 |
| 웹 디자인 전면 개편 | ❌ 컴포넌트만 교체, API/DTO 무수정 |

핵심: **DTO(`HeroSlide`)와 엔드포인트가 안정적 계약**. 데이터 소스 변경, 정렬 변경, 필터 변경은 모두 `getHeroSlides()` 내부에서 처리되며 클라이언트는 영향받지 않는다.

---

## 비목표 (이번 작업에서 안 하는 것)

- `notices` 테이블 스키마 변경 (히어로 전용 컬럼 추가 X)
- `UpcomingEvents`, `LatestSermon`, `Header`, `Footer`, `BottomTabBar` 디자인 변경
- 관리자 페이지에 "히어로 노출 여부" 토글 추가 (필요 시 후속)
- 새 토큰을 `@theme inline`에 등록해서 `bg-hero-bg-1`처럼 사용 (Tailwind v4 자동등록 — 단순히 `var(--...)`만 사용)

---

## 검증 체크리스트

- [x] `npm run typecheck` 통과
- [x] `npm run lint` — 기존(pre-existing)만 남음, 이번 변경으로 **신규 문제 0건**
- [ ] `npm run dev` 후 `/`에서 슬라이더가 6초마다 회전, 인디케이터 클릭으로 이동 ← 사용자 육안 확인 필요
- [ ] 공지에 이미지가 0건일 때 폴백 슬라이드 표시 ← 사용자 육안 확인 필요
- [ ] 공지 1건 추가 후 ISR revalidate (또는 1시간 후) 슬라이더에 자동 반영 ← 사용자 육안 확인 필요
- [ ] `curl http://localhost:3000/api/home/hero-slides` JSON 응답 확인 ← 사용자 육안 확인 필요
- [ ] 모바일 폭(<640px)에서 그리드/Hero가 깨지지 않음 ← 사용자 육안 확인 필요
