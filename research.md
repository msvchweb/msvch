# 하단 탭바 구현 리서치 보고서

## 1. 프로젝트 현황 분석

### 기술 스택
- **Next.js 16.2.2** (App Router, Server/Client Components)
- **React 19.2.4**
- **Tailwind CSS v4** (PostCSS, `@theme inline` 방식)
- **Supabase** (인증 + DB)
- **Lucide React** (아이콘)
- **clsx + tailwind-merge** (cn 유틸)

### 현재 네비게이션 구조

**Header (`src/components/layout/Header.tsx`)**:
- Sticky header, z-50, blur 효과
- 데스크톱: 수평 nav + hover 드롭다운 서브메뉴
- 모바일: 햄버거 → 아코디언 서브메뉴
- `nav-config.ts`의 `navItems` 배열 사용

**Footer (`src/components/layout/Footer.tsx`)**:
- 교회 정보, 예배 시간, 바로가기 링크 4개
- 항상 페이지 하단에 표시

**레이아웃 (`src/app/layout.tsx`)**:
```
<html>
  <body className="flex min-h-full flex-col">
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
  </body>
</html>
```

### 라우트 구조 (6개 주요 카테고리)

| 카테고리 | 경로 | 하위 페이지 |
|---------|------|-----------|
| 교회소개 | `/intro` | 인사말(`/greetings`), 교회소개(`/intro`), 오시는 길(`/map`) |
| 예배 | `/worship` | 예배안내(`/worship`), 주보(`/weekly`), 설교영상(`/sermons`), 시간표(`/timetable`) |
| 교회학교 | `/churchschool` | 유아부, 초등부, 청소년부, 청년부 |
| 소식 | `/notice` | 공지사항(`/notice`), 갤러리(`/gallery`) |
| 문화사역 | `/ministry` | 미용봉사, 탁구, 반찬사역 |
| 커뮤니티 | `/groups` | 그룹(`/groups`), 봉사(`/volunteer`) |

### 홈페이지 (`/`) 구성
- HeroSection → QuickLinks → WorshipTimeCard → RecentNotice → LatestSermon

---

## 2. 하단 탭바 설계

### 목적
웹에서 핵심 페이지로 빠르게 이동할 수 있는 고정 하단 탭바. 모바일 앱은 추후 별도 개발 예정이므로 웹 전용으로 설계.

### 탭바에 포함할 항목 (5개 권장)

하단 탭바는 **가장 자주 접근하는 핵심 기능** 위주로 5개 이하가 적절:

| 탭 | 라벨 | 경로 | 아이콘 (Lucide) | 선정 이유 |
|----|------|------|----------------|----------|
| 홈 | 홈 | `/` | `Home` | 메인 진입점 |
| 예배 | 예배 | `/worship` | `Church` (없으면 `Heart`) | 교회 핵심 기능 |
| 설교 | 설교 | `/sermons` | `Play` | YouTube 설교 - 가장 많이 접근할 콘텐츠 |
| 소식 | 소식 | `/notice` | `Bell` | 공지사항 - 정보 전달 핵심 |
| 더보기 | 더보기 | - | `Menu` | 나머지 메뉴 접근 (모달/시트) |

**대안**: "더보기" 대신 "교회소개"(`/intro`, `Info` 아이콘)로 대체 가능. 단, 갤러리/지도/커뮤니티 등 접근성이 떨어짐.

### 표시 조건

- **표시**: 모든 `(public)` 페이지, 홈페이지, `(member)` 페이지
- **비표시**: `/admin/*` 페이지 (자체 사이드바 레이아웃), `/login`, `/signup`
- **반응형**: 항상 표시 (데스크톱에서도). 모바일 앱이 별도이므로 웹 탭바는 화면 크기 무관하게 유지.
  - 단, 데스크톱에서는 이미 Header nav가 충분하므로 **lg 이상에서 숨기는 것도 고려 가능** (`lg:hidden`)

---

## 3. 구현 계획

### 파일 구조

```
src/components/layout/
├── Header.tsx          (기존)
├── Footer.tsx          (기존)
├── nav-config.ts       (기존)
├── BottomTabBar.tsx     (신규) - 탭바 컴포넌트
└── tab-config.ts       (신규) - 탭 항목 설정
```

### `tab-config.ts`

```ts
import { Home, Heart, Play, Bell, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const tabItems: TabItem[] = [
  { label: "홈", href: "/", icon: Home },
  { label: "예배", href: "/worship", icon: Heart },
  { label: "설교", href: "/sermons", icon: Play },
  { label: "소식", href: "/notice", icon: Bell },
  { label: "더보기", href: "#more", icon: Menu },
];
```

### `BottomTabBar.tsx` 핵심 설계

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabItems } from "./tab-config";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const pathname = usePathname();

  // admin, login, signup에서는 숨김
  if (pathname.startsWith("/admin") || pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        {tabItems.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary-600" : "text-gray-400"
              )}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={cn("text-[0.65rem]", isActive && "font-semibold")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
```

### 레이아웃 수정 (`src/app/layout.tsx`)

```tsx
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        <Footer />
        <BottomTabBar />
      </body>
    </html>
  );
}
```

**핵심 변경**: `<main>`에 `pb-16 lg:pb-0` 추가 → 탭바에 콘텐츠가 가려지지 않도록 하단 패딩.

---

## 4. 스타일 상세

### 디자인 토큰 (기존 시스템 활용)

| 속성 | 값 | 이유 |
|-----|---|------|
| 배경 | `bg-white/95 backdrop-blur-md` | Header와 동일한 글래스모피즘 |
| 높이 | `h-16` (64px) | Header와 동일, 터치 타겟 충분 |
| z-index | `z-50` | Header와 동일 레벨 |
| 상단 보더 | `border-t border-gray-200` | 미세한 구분선 |
| 활성 색상 | `text-primary-600` (#444ce7) | 기존 primary 색상 |
| 비활성 색상 | `text-gray-400` | 충분한 대비, 과하지 않은 존재감 |
| 아이콘 크기 | 22px | 터치 친화적 |
| 라벨 크기 | `text-[0.65rem]` (10.4px) | 아이콘 보조, 읽기 가능 |
| 반응형 | `lg:hidden` | 데스크톱에서 숨김 (Header가 충분) |

### 활성 상태 판별 로직

```ts
// 홈은 정확히 "/" 일 때만
// 나머지는 startsWith로 하위 경로도 활성화
const isActive = tab.href === "/"
  ? pathname === "/"
  : pathname.startsWith(tab.href);
```

- `/sermons/abc123` → "설교" 탭 활성
- `/notice/some-slug` → "소식" 탭 활성
- `/worship` → "예배" 탭 활성

---

## 5. "더보기" 탭 동작 옵션

### 옵션 A: 바텀 시트 (권장)
- 클릭 시 하단에서 올라오는 시트
- 나머지 메뉴 (교회소개, 교회학교, 문화사역, 커뮤니티, 갤러리, 지도 등) 표시
- 장점: 네이티브 앱 느낌, 확장성
- 구현: 별도 `BottomSheet.tsx` 컴포넌트

### 옵션 B: 전체 메뉴 페이지로 이동
- `/menu` 같은 허브 페이지
- 장점: 단순, SSR 가능
- 단점: 페이지 전환 발생

### 옵션 C: "더보기" 제거, 5번째 탭을 고정 페이지로
- 예: "교회소개" 또는 "갤러리"
- 장점: 가장 단순
- 단점: 접근성 제한

**권장**: 옵션 A (바텀 시트). 단, 초기 구현은 옵션 C로 단순하게 시작 후 확장.

---

## 6. 고려사항

### Footer와의 관계
- 탭바가 `fixed`이므로 Footer는 그대로 유지
- 스크롤 시 Footer 위에 탭바가 떠있는 형태
- `pb-16`으로 콘텐츠가 탭바 뒤에 숨지 않도록 보장

### 접근성 (a11y)
- `<nav>` 시맨틱 태그 사용
- `aria-label="하단 탐색"` 추가
- 활성 탭에 `aria-current="page"` 추가
- 충분한 터치 타겟 (44x44px 이상)

### 성능
- `"use client"` 최소화 (탭바만 클라이언트)
- `usePathname()`은 가벼운 hook
- 아이콘은 Lucide tree-shaking으로 번들 최소화

### 스크롤 시 동작
- 항상 고정 표시 (hide-on-scroll 불필요 - 웹이므로)
- 또는 아래로 스크롤 시 숨김, 위로 스크롤 시 표시 (선택적 UX 개선)

---

## 7. 구현 순서

1. `tab-config.ts` 작성 (탭 항목 정의)
2. `BottomTabBar.tsx` 작성 (탭바 컴포넌트)
3. `layout.tsx` 수정 (탭바 삽입 + 하단 패딩)
4. 활성 상태 스타일링 확인
5. admin/auth 페이지 숨김 확인
6. (선택) "더보기" 바텀 시트 구현

---

## 8. 요약

| 항목 | 결정 |
|-----|------|
| 탭 수 | 5개 (홈, 예배, 설교, 소식, 더보기) |
| 위치 | 화면 하단 고정 (`fixed bottom-0`) |
| 반응형 | `lg:hidden` (데스크톱 숨김) 또는 항상 표시 |
| 스타일 | 기존 디자인 시스템 (primary-600, 글래스모피즘) |
| 파일 | `BottomTabBar.tsx` + `tab-config.ts` 신규 |
| 레이아웃 변경 | `layout.tsx`에 탭바 추가 + `pb-16` |
| 제외 페이지 | admin, login, signup |
| "더보기" | 초기: 고정 페이지 링크 → 추후: 바텀 시트 |
