# 하단 탭바 구현 계획

## 설계 원칙

1. **범용 네비게이션 데이터 구조** — 탭 설정을 플랫폼 무관하게 정의. 웹과 미래의 모바일 앱이 동일한 데이터 소스를 공유할 수 있도록 아이콘을 문자열 키로 참조.
2. **기존 패턴 준수** — `nav-config.ts` / `admin/layout.tsx`의 패턴을 따름. `cn()` 유틸, Lucide 아이콘, Tailwind v4 디자인 토큰 사용.
3. **Server Component 오염 방지** — 탭바만 `"use client"`, 설정 파일은 순수 데이터.

---

## 변경 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/components/layout/tab-config.ts` | **신규** | 탭 항목 데이터 (플랫폼 공용) |
| `src/components/layout/BottomTabBar.tsx` | **신규** | 탭바 UI 컴포넌트 |
| `src/app/(public)/menu/page.tsx` | **신규** | "더보기" 메뉴 페이지 |
| `src/app/layout.tsx` | **수정** | 탭바 삽입 + 하단 패딩 |

---

## Step 1: `src/components/layout/tab-config.ts` (신규)

플랫폼 공용 탭 설정. 아이콘을 문자열 키로 정의하여 React Native 등 다른 플랫폼에서도 매핑 가능하게 함.

```ts
/**
 * 하단 탭바 설정 — 플랫폼 공용
 *
 * icon은 Lucide 아이콘 이름(문자열)으로 정의.
 * 웹: iconMap으로 Lucide 컴포넌트에 매핑.
 * 모바일: 같은 키를 React Native 아이콘 라이브러리에 매핑.
 */

import { Home, Heart, Play, Bell, Ellipsis } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TabItem {
  /** 탭 고유 식별자 */
  key: string;
  /** 표시 라벨 */
  label: string;
  /** 이동 경로 */
  href: string;
  /** 아이콘 이름 (플랫폼 공용 키) */
  icon: string;
  /** 경로 매칭 시 정확히 일치해야 하는지 여부 */
  exact?: boolean;
}

/** 탭 항목 — 순서가 곧 표시 순서 */
export const tabItems: TabItem[] = [
  { key: "home", label: "홈", href: "/", icon: "home", exact: true },
  { key: "worship", label: "예배", href: "/worship", icon: "heart" },
  { key: "sermons", label: "설교", href: "/sermons", icon: "play" },
  { key: "notice", label: "소식", href: "/notice", icon: "bell" },
  { key: "more", label: "더보기", href: "/menu", icon: "ellipsis" },
];

/** 탭바를 숨길 경로 접두사 */
export const hiddenPrefixes = ["/admin", "/login", "/signup"];

/** 웹 전용: 아이콘 문자열 → Lucide 컴포넌트 매핑 */
export const iconMap: Record<string, LucideIcon> = {
  home: Home,
  heart: Heart,
  play: Play,
  bell: Bell,
  ellipsis: Ellipsis,
};
```

### 범용성 포인트

- `TabItem`의 `icon`은 `string` — React Native에서는 `iconMap` 대신 자체 매핑 사용.
- `tabItems`와 `hiddenPrefixes`는 JSON 직렬화 가능 — API로 제공하거나 공유 패키지로 추출 가능.
- `key` 필드로 플랫폼 간 탭 식별 통일.
- `exact` 필드로 홈(`/`)과 하위 경로 구분.

---

## Step 2: `src/components/layout/BottomTabBar.tsx` (신규)

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabItems, hiddenPrefixes, iconMap } from "./tab-config";
import { cn } from "@/lib/utils";

export function BottomTabBar() {
  const pathname = usePathname();

  // 숨김 경로 체크
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <nav
      aria-label="하단 탐색"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/80 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
        {tabItems.map((tab) => {
          const Icon = iconMap[tab.icon];
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 transition-colors",
                isActive
                  ? "text-primary-600"
                  : "text-gray-400 active:text-gray-600"
              )}
            >
              {isActive && (
                <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary-600" />
              )}
              {Icon && (
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.5} />
              )}
              <span
                className={cn(
                  "text-[0.625rem] leading-tight",
                  isActive ? "font-semibold" : "font-normal"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* iOS safe area 대응 */}
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
```

### 설계 결정 설명

| 결정 | 이유 |
|------|------|
| `h-14` (56px) | 44px 터치 타겟 확보 + 라벨 공간. Header(h-16)보다 살짝 낮아 시각적 균형. |
| `lg:hidden` | 데스크톱에선 Header nav가 충분. 기존 Header는 `lg:flex`로 데스크톱 nav 표시. |
| `max-w-lg` | 넓은 화면(태블릿)에서 탭이 과도하게 벌어지지 않도록. |
| `bg-white/95 backdrop-blur-md` | Header의 `bg-white/90 backdrop-blur-xl`과 통일된 글래스모피즘. |
| `z-50` | Header와 동일 레벨. |
| `aria-current="page"` | 스크린리더 접근성. 기존 프로젝트에 접근성 패턴 없으나, 새 코드에서 시작. |
| 활성 인디케이터 (상단 바) | Header의 hover 하단바(`span ... bg-primary-600`) 패턴과 대칭. |
| `env(safe-area-inset-bottom)` | iPhone 노치/홈 인디케이터 대응. |

### 경로 매칭 로직 상세

```
pathname           tab.href    exact   결과
/                  /           true    ✅ 활성
/worship           /           true    ❌
/worship           /worship    false   ✅ 활성 (정확 일치)
/sermons/abc123    /sermons    false   ✅ 활성 (startsWith + "/")
/notice/some-slug  /notice     false   ✅ 활성
/gallery           /notice     false   ❌ 비활성 ("/notice/"로 시작 안 함)
/menu              /menu       false   ✅ 활성
```

---

## Step 3: `src/app/layout.tsx` (수정)

### 현재 코드 (전문)

```tsx
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "명성비전교회",
    template: "%s | 명성비전교회",
  },
  description: "꿈이 있는 건강한 교회 명성비전교회입니다",
  metadataBase: new URL("https://www.msvch.org"),
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "명성비전교회",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### 변경 후 (전문)

```tsx
import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import "./globals.css";

export const metadata: Metadata = {
  // ... 변경 없음 ...
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1 pb-14 lg:pb-0">{children}</main>
        <Footer />
        <BottomTabBar />
      </body>
    </html>
  );
}
```

### 변경점 (정확히 2곳)

1. **4행 추가**: `import { BottomTabBar } from "@/components/layout/BottomTabBar";`
2. **35행 수정**: `<main className="flex-1">` → `<main className="flex-1 pb-14 lg:pb-0">`
   - `pb-14` = 56px = 탭바 `h-14`과 동일 → 콘텐츠가 탭바에 가리지 않음
   - `lg:pb-0` → 데스크톱에서 탭바 숨김이므로 패딩 제거
3. **38행 추가**: `<BottomTabBar />` — `<Footer />` 뒤에 배치 (fixed이므로 DOM 순서 무관)

### admin 레이아웃과의 관계

`src/app/admin/layout.tsx`는 자체 레이아웃(`flex min-h-[calc(100vh-4rem)]` + 사이드바)을 가짐. BottomTabBar는 `pathname.startsWith("/admin")`일 때 `null` 반환하므로 충돌 없음. `pb-14`는 admin 레이아웃 내부에서 자체 padding으로 덮어쓰므로 영향 없음.

### login/signup과의 관계

`src/app/(auth)/login/page.tsx`는 `min-h-[calc(100vh-10rem)]` 중앙 정렬 레이아웃. 탭바가 숨겨지므로 `pb-14`가 불필요하게 추가되는데, 이는 시각적으로 무시할 수 있는 수준 (로그인 폼이 중앙 정렬이라 하단 패딩 차이 무의미). 필요시 auth 라우트 그룹에 별도 레이아웃으로 오버라이드 가능.

---

## Step 4: `src/app/(public)/menu/page.tsx` (신규)

"더보기" 탭의 목적지. 탭바에 포함되지 않은 나머지 페이지로의 허브.

```tsx
import Link from "next/link";
import {
  BookOpen, Church, MapPin, GraduationCap,
  Newspaper, ImageIcon, Scissors, Users, HandHeart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "메뉴" };

interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const menuSections: { title: string; items: MenuItem[] }[] = [
  {
    title: "교회소개",
    items: [
      { label: "인사말", href: "/greetings", icon: BookOpen, description: "담임목사 인사" },
      { label: "교회소개", href: "/intro", icon: Church, description: "비전과 역사" },
      { label: "오시는 길", href: "/map", icon: MapPin, description: "위치 및 교통" },
    ],
  },
  {
    title: "교회학교",
    items: [
      { label: "교회학교", href: "/churchschool", icon: GraduationCap, description: "부서별 안내" },
    ],
  },
  {
    title: "소식",
    items: [
      { label: "갤러리", href: "/gallery", icon: ImageIcon, description: "사진 모음" },
    ],
  },
  {
    title: "사역",
    items: [
      { label: "문화사역", href: "/ministry", icon: Scissors, description: "미용·탁구·반찬" },
      { label: "봉사", href: "/volunteer", icon: HandHeart, description: "봉사 안내" },
      { label: "커뮤니티", href: "/groups", icon: Users, description: "그룹 활동" },
    ],
  },
];

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">메뉴</h1>
      <div className="mt-6 space-y-8">
        {menuSections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 메뉴 페이지에 포함되는 항목

탭바의 4개 주요 탭(홈, 예배, 설교, 소식-공지사항)에 이미 있는 페이지는 **제외**하고, 나머지만 포함:

- 인사말, 교회소개, 오시는 길
- 교회학교
- 갤러리 (공지사항은 "소식" 탭에 이미 있으므로 제외)
- 문화사역, 봉사, 커뮤니티

### 범용성

- `menuSections` 배열 → 추후 API 응답으로 교체하면 서버 드리븐 메뉴 가능
- 모바일 앱에서는 `/menu` 경로를 네이티브 화면으로 딥링크 매핑

---

## 구현 순서

| # | 작업 | 파일 | 의존성 | 상태 |
|---|------|------|--------|------|
| 1 | 탭 설정 데이터 작성 | `tab-config.ts` | 없음 | ✅ 완료 |
| 2 | BottomTabBar 컴포넌트 작성 | `BottomTabBar.tsx` | Step 1 | ✅ 완료 |
| 3 | 루트 레이아웃에 탭바 삽입 | `layout.tsx` | Step 2 | ✅ 완료 |
| 4 | "더보기" 메뉴 페이지 작성 | `menu/page.tsx` | 없음 (Step 1과 병렬 가능) | ✅ 완료 |
| 5 | 빌드 확인 | `npm run build` | 전체 | ✅ 완료 |

---

## 범용성 설계 요약

```
┌─────────────────────────────────────────────┐
│              tab-config.ts                  │
│  tabItems: TabItem[] (icon은 문자열 키)      │
│  hiddenPrefixes: string[]                   │
│  iconMap: Record<string, LucideIcon>  ← 웹  │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
  웹 (Next.js)    모바일 (React Native)
       │                │
  BottomTabBar     BottomTabBar (별도)
  - iconMap 사용    - 자체 아이콘 매핑
  - usePathname()   - navigation state
  - Tailwind        - StyleSheet
```

**모바일 전환 시 재사용 가능한 부분**:
- `TabItem` 인터페이스 (`key`, `label`, `href`, `icon`, `exact`)
- `tabItems` 배열
- `hiddenPrefixes` 배열
- 경로 매칭 로직 (`exact` 플래그 기반)

**모바일에서 교체할 부분**:
- `iconMap` → React Native 아이콘 매핑
- `BottomTabBar.tsx` → React Navigation `BottomTabNavigator` 또는 커스텀 컴포넌트
- Tailwind 클래스 → StyleSheet

**백엔드 변경 불필요**: 탭바는 순수 프론트엔드 네비게이션. API 라우트(`/api/*`) 변경 없음.
