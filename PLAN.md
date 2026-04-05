# PLAN.md — 명성비전교회 홈페이지 전체 구현 계획

> 기반 문서: `docs/project-strategy.md`
> 코드베이스 현황: **빈 프로젝트** (초기화 전)
> 최종 목표: Wix → Next.js 자체 개발, Cloudflare Pages 배포

---

## Phase 1: 프로젝트 초기화 및 기반 구축

### Step 1.1: Next.js 프로젝트 생성

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Step 1.2: 추가 의존성 설치

```bash
# UI 컴포넌트
npm install lucide-react clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-navigation-menu @radix-ui/react-dropdown-menu

# CMS (Notion)
npm install @notionhq/client notion-to-md

# DB/Auth
npm install @supabase/supabase-js @supabase/ssr

# 미디어
npm install yet-another-react-lightbox sharp

# 유틸
npm install date-fns
```

### Step 1.3: 프로젝트 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx                  # 루트 레이아웃 (헤더/푸터)
│   ├── page.tsx                    # 홈페이지
│   ├── globals.css                 # Tailwind + 커스텀 스타일
│   │
│   ├── (public)/                   # 공개 페이지 그룹
│   │   ├── greetings/page.tsx      # 인사말
│   │   ├── intro/page.tsx          # 교회 소개
│   │   ├── map/page.tsx            # 오시는 길
│   │   ├── worship/page.tsx        # 예배 안내
│   │   ├── weekly/page.tsx         # 주보
│   │   ├── timetable/page.tsx      # 시간표
│   │   │
│   │   ├── churchschool/
│   │   │   ├── page.tsx            # 교회학교 메인
│   │   │   ├── infant/page.tsx
│   │   │   ├── elementary/page.tsx
│   │   │   ├── teen/page.tsx
│   │   │   └── youth/page.tsx
│   │   │
│   │   ├── ministry/               # 문화사역
│   │   │   ├── page.tsx            # 문화사역 메인
│   │   │   ├── beauty/page.tsx
│   │   │   ├── tabletennis/page.tsx
│   │   │   └── sidedish/page.tsx
│   │   │
│   │   ├── notice/
│   │   │   ├── page.tsx            # 공지 목록
│   │   │   └── [slug]/page.tsx     # 공지 상세
│   │   │
│   │   ├── gallery/page.tsx        # 갤러리
│   │   │
│   │   ├── sermons/
│   │   │   ├── page.tsx            # 설교 목록
│   │   │   └── [id]/page.tsx       # 설교 상세(영상)
│   │   │
│   │   └── volunteer/page.tsx      # 봉사/자원봉사
│   │
│   ├── (auth)/                     # 인증 페이지 그룹
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   │
│   ├── (member)/                   # 인증 필요 페이지
│   │   ├── layout.tsx              # 인증 가드 레이아웃
│   │   ├── groups/
│   │   │   ├── page.tsx            # 그룹 목록
│   │   │   └── [groupId]/
│   │   │       ├── page.tsx        # 그룹 토론 목록
│   │   │       └── [postId]/page.tsx
│   │   └── profile/page.tsx        # 내 프로필
│   │
│   ├── admin/                      # 관리자
│   │   ├── layout.tsx
│   │   ├── page.tsx                # 대시보드
│   │   ├── posts/page.tsx          # 게시물 관리
│   │   └── gallery/page.tsx        # 갤러리 관리
│   │
│   └── api/
│       ├── revalidate/route.ts     # ISR 온디맨드 재검증
│       └── og/route.tsx            # OG 이미지 생성
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Navigation.tsx
│   │   └── MobileMenu.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Skeleton.tsx
│   │   └── Container.tsx
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── WorshipTimeCard.tsx
│   │   ├── RecentNotice.tsx
│   │   └── LatestSermon.tsx
│   ├── gallery/
│   │   ├── GalleryGrid.tsx
│   │   └── LightboxViewer.tsx
│   ├── sermons/
│   │   ├── SermonCard.tsx
│   │   └── YouTubePlayer.tsx
│   └── groups/
│       ├── DiscussionList.tsx
│       └── DiscussionPost.tsx
│
├── lib/
│   ├── notion.ts                   # Notion API 클라이언트
│   ├── supabase/
│   │   ├── client.ts               # 브라우저용 클라이언트
│   │   ├── server.ts               # 서버용 클라이언트
│   │   └── middleware.ts            # 세션 갱신
│   ├── youtube.ts                  # YouTube Data API
│   └── utils.ts                    # cn() 등 유틸
│
├── types/
│   ├── notion.ts
│   ├── supabase.ts
│   └── youtube.ts
│
└── middleware.ts                    # Supabase Auth 세션 미들웨어
```

### Step 1.4: 환경변수 설정

```env
# .env.local
# Notion
NOTION_API_KEY=secret_xxx
NOTION_NOTICE_DB_ID=xxx          # 공지사항 DB
NOTION_WEEKLY_DB_ID=xxx          # 주보 DB
NOTION_GALLERY_DB_ID=xxx         # 갤러리 DB

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# YouTube
YOUTUBE_API_KEY=xxx
YOUTUBE_CHANNEL_ID=xxx           # 교회 유튜브 채널 ID

# Revalidation
REVALIDATE_SECRET=xxx            # ISR 온디맨드 재검증 시크릿

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=xxx
```

### Step 1.5: Tailwind 설정 — 교회 디자인 토큰

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",   // 메인 컬러
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        church: {
          gold: "#b8860b",   // 강조/장식
          cream: "#fdf8f0",  // 배경
          dark: "#1a1a2e",   // 텍스트
        },
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
```

### Step 1.6: 유틸리티 함수

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Phase 2: 공통 레이아웃 및 UI 컴포넌트

### Step 2.1: 루트 레이아웃

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const pretendard = localFont({
  src: "../fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "명성비전교회",
    template: "%s | 명성비전교회",
  },
  description: "명성비전교회에 오신 것을 환영합니다",
  metadataBase: new URL("https://www.msvch.org"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "명성비전교회",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### Step 2.2: 네비게이션 구조 정의

```ts
// src/components/layout/nav-config.ts
export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    label: "교회소개",
    href: "/intro",
    children: [
      { label: "인사말", href: "/greetings" },
      { label: "교회소개", href: "/intro" },
      { label: "오시는 길", href: "/map" },
    ],
  },
  {
    label: "예배",
    href: "/worship",
    children: [
      { label: "예배 안내", href: "/worship" },
      { label: "주보", href: "/weekly" },
      { label: "설교 영상", href: "/sermons" },
      { label: "시간표", href: "/timetable" },
    ],
  },
  {
    label: "교회학교",
    href: "/churchschool",
    children: [
      { label: "유아부", href: "/churchschool/infant" },
      { label: "초등부", href: "/churchschool/elementary" },
      { label: "청소년부", href: "/churchschool/teen" },
      { label: "청년부", href: "/churchschool/youth" },
    ],
  },
  {
    label: "소식",
    href: "/notice",
    children: [
      { label: "공지사항", href: "/notice" },
      { label: "갤러리", href: "/gallery" },
    ],
  },
  {
    label: "문화사역",
    href: "/ministry",
    children: [
      { label: "미용봉사", href: "/ministry/beauty" },
      { label: "탁구", href: "/ministry/tabletennis" },
      { label: "반찬사역", href: "/ministry/sidedish" },
    ],
  },
  {
    label: "커뮤니티",
    href: "/groups",
    children: [
      { label: "그룹", href: "/groups" },
      { label: "봉사", href: "/volunteer" },
    ],
  },
];
```

### Step 2.3: 헤더 컴포넌트

```tsx
// src/components/layout/Header.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { navItems } from "./nav-config";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* 로고 */}
        <Link href="/" className="text-xl font-bold text-primary-700">
          명성비전교회
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden lg:flex lg:gap-1">
          {navItems.map((item) => (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-primary-600"
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="invisible absolute left-0 top-full z-50 min-w-[160px] rounded-md border bg-white py-1 shadow-lg group-hover:visible">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary-600"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 모바일 토글 */}
        <button
          className="lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="메뉴 열기"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <nav className="border-t bg-white px-4 py-4 lg:hidden">
          {navItems.map((item) => (
            <div key={item.href} className="py-2">
              <Link
                href={item.href}
                className="block font-medium text-gray-800"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block text-sm text-gray-600"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
```

### Step 2.4: 푸터 컴포넌트

```tsx
// src/components/layout/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* 교회 정보 */}
          <div>
            <h3 className="mb-3 text-lg font-bold text-white">명성비전교회</h3>
            <p className="text-sm leading-relaxed">
              주소: 서울특별시 동작구 (상세주소)
              <br />
              전화: 02-XXX-XXXX
              <br />
              이메일: info@msvch.org
            </p>
          </div>

          {/* 예배 시간 */}
          <div>
            <h3 className="mb-3 text-lg font-bold text-white">예배 안내</h3>
            <ul className="space-y-1 text-sm">
              <li>주일예배: 오전 11:00</li>
              <li>수요예배: 오후 7:30</li>
              <li>금요기도회: 오후 9:00</li>
              <li>새벽기도회: 오전 5:30</li>
            </ul>
          </div>

          {/* 빠른 링크 */}
          <div>
            <h3 className="mb-3 text-lg font-bold text-white">바로가기</h3>
            <ul className="space-y-1 text-sm">
              <li><Link href="/notice" className="hover:text-white">공지사항</Link></li>
              <li><Link href="/sermons" className="hover:text-white">설교 영상</Link></li>
              <li><Link href="/gallery" className="hover:text-white">갤러리</Link></li>
              <li><Link href="/map" className="hover:text-white">오시는 길</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} 명성비전교회. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

### Step 2.5: 공통 UI 컴포넌트

```tsx
// src/components/ui/Container.tsx
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 py-12", className)}>
      {children}
    </div>
  );
}
```

```tsx
// src/components/ui/Card.tsx
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-white p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}
```

```tsx
// src/components/ui/PageHeader.tsx
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b bg-gray-50 py-16 text-center">
      <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">{title}</h1>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-gray-600">{description}</p>
      )}
    </div>
  );
}
```

---

## Phase 3: Notion CMS 연동

### Step 3.1: Notion 데이터베이스 구조 설계

Notion에 아래 데이터베이스를 생성해야 함:

**공지사항 DB**
| 속성 | 타입 | 용도 |
|------|------|------|
| 제목 | Title | 공지 제목 |
| 슬러그 | Rich Text | URL 경로 |
| 카테고리 | Select | 분류 (일반/긴급/행사) |
| 공개 | Checkbox | 게시 여부 |
| 날짜 | Date | 게시일 |
| 내용 | Page Content | 본문 (블록) |

**주보 DB**
| 속성 | 타입 | 용도 |
|------|------|------|
| 제목 | Title | "2026년 4월 첫째주 주보" |
| 날짜 | Date | 해당 주일 |
| PDF | Files | 주보 PDF 파일 |
| 내용 | Page Content | 주보 본문 |

**갤러리 DB**
| 속성 | 타입 | 용도 |
|------|------|------|
| 제목 | Title | 앨범명 |
| 카테고리 | Select | 예배/교회학교/교회행사/봉사센터/새가족 |
| 날짜 | Date | 행사일 |
| 대표이미지 | Files | 썸네일 |
| 이미지들 | Files | 전체 사진 |
| 공개 | Checkbox | 게시 여부 |

### Step 3.2: Notion API 클라이언트

```ts
// src/lib/notion.ts
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

// --- 공통 헬퍼 ---

function getTitle(page: PageObjectResponse): string {
  const prop = Object.values(page.properties).find((p) => p.type === "title");
  if (prop?.type === "title") return prop.title.map((t) => t.plain_text).join("");
  return "";
}

function getRichText(page: PageObjectResponse, name: string): string {
  const prop = page.properties[name];
  if (prop?.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
  return "";
}

function getDate(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "date" && prop.date) return prop.date.start;
  return null;
}

function getSelect(page: PageObjectResponse, name: string): string | null {
  const prop = page.properties[name];
  if (prop?.type === "select" && prop.select) return prop.select.name;
  return null;
}

function getCheckbox(page: PageObjectResponse, name: string): boolean {
  const prop = page.properties[name];
  if (prop?.type === "checkbox") return prop.checkbox;
  return false;
}

function getFiles(page: PageObjectResponse, name: string): string[] {
  const prop = page.properties[name];
  if (prop?.type === "files") {
    return prop.files.map((f) => {
      if (f.type === "file") return f.file.url;
      if (f.type === "external") return f.external.url;
      return "";
    }).filter(Boolean);
  }
  return [];
}

// --- 공지사항 ---

export interface NoticeItem {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  date: string | null;
  coverImage?: string;
}

export async function getNotices(): Promise<NoticeItem[]> {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_NOTICE_DB_ID!,
    filter: { property: "공개", checkbox: { equals: true } },
    sorts: [{ property: "날짜", direction: "descending" }],
  });

  return (response.results as PageObjectResponse[]).map((page) => ({
    id: page.id,
    title: getTitle(page),
    slug: getRichText(page, "슬러그") || page.id,
    category: getSelect(page, "카테고리"),
    date: getDate(page, "날짜"),
    coverImage: page.cover?.type === "file" ? page.cover.file.url : undefined,
  }));
}

export async function getNoticeBySlug(slug: string) {
  const notices = await getNotices();
  const notice = notices.find((n) => n.slug === slug);
  if (!notice) return null;

  const mdBlocks = await n2m.pageToMarkdown(notice.id);
  const content = n2m.toMarkdownString(mdBlocks).parent;

  return { ...notice, content };
}

// --- 주보 ---

export interface WeeklyItem {
  id: string;
  title: string;
  date: string | null;
  pdfUrl: string | null;
}

export async function getWeeklies(): Promise<WeeklyItem[]> {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_WEEKLY_DB_ID!,
    sorts: [{ property: "날짜", direction: "descending" }],
    page_size: 20,
  });

  return (response.results as PageObjectResponse[]).map((page) => ({
    id: page.id,
    title: getTitle(page),
    date: getDate(page, "날짜"),
    pdfUrl: getFiles(page, "PDF")[0] || null,
  }));
}

// --- 갤러리 ---

export interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;
  date: string | null;
  thumbnail: string | null;
  images: string[];
}

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_GALLERY_DB_ID!,
    filter: { property: "공개", checkbox: { equals: true } },
    sorts: [{ property: "날짜", direction: "descending" }],
  });

  return (response.results as PageObjectResponse[]).map((page) => ({
    id: page.id,
    title: getTitle(page),
    category: getSelect(page, "카테고리"),
    date: getDate(page, "날짜"),
    thumbnail: getFiles(page, "대표이미지")[0] || null,
    images: getFiles(page, "이미지들"),
  }));
}
```

### Step 3.3: ISR 온디맨드 재검증 API

```ts
// src/app/api/revalidate/route.ts
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { secret, paths } = await request.json();

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  for (const path of paths as string[]) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true });
}
```

---

## Phase 4: 홈페이지 구현

### Step 4.1: 히어로 섹션

```tsx
// src/components/home/HeroSection.tsx
import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="relative h-[70vh] min-h-[500px]">
      <Image
        src="/images/hero-church.jpg"
        alt="명성비전교회"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
        <h1 className="text-4xl font-bold md:text-6xl">명성비전교회</h1>
        <p className="mt-4 text-lg md:text-xl">
          환영합니다. 하나님의 사랑으로 함께하는 교회입니다.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/worship"
            className="rounded-full bg-primary-600 px-8 py-3 font-medium text-white hover:bg-primary-700"
          >
            예배 안내
          </Link>
          <Link
            href="/intro"
            className="rounded-full border-2 border-white px-8 py-3 font-medium text-white hover:bg-white/10"
          >
            교회 소개
          </Link>
        </div>
      </div>
    </section>
  );
}
```

### Step 4.2: 예배 시간 카드

```tsx
// src/components/home/WorshipTimeCard.tsx
import { Clock } from "lucide-react";

const worshipTimes = [
  { name: "주일예배", time: "오전 11:00", day: "매주 일요일" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일" },
  { name: "금요기도회", time: "오후 9:00", day: "매주 금요일" },
  { name: "새벽기도회", time: "오전 5:30", day: "매일" },
];

export function WorshipTimeCard() {
  return (
    <section className="bg-church-cream py-16">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">예배 시간</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {worshipTimes.map((item) => (
            <div
              key={item.name}
              className="rounded-xl bg-white p-6 text-center shadow-sm"
            >
              <Clock className="mx-auto mb-3 text-primary-500" size={32} />
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="mt-1 text-2xl font-bold text-primary-600">
                {item.time}
              </p>
              <p className="mt-1 text-sm text-gray-500">{item.day}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Step 4.3: 최근 공지사항 섹션

```tsx
// src/components/home/RecentNotice.tsx
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { NoticeItem } from "@/lib/notion";

export function RecentNotice({ notices }: { notices: NoticeItem[] }) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">공지사항</h2>
          <Link href="/notice" className="text-sm text-primary-600 hover:underline">
            전체보기 →
          </Link>
        </div>
        <div className="divide-y rounded-xl border bg-white">
          {notices.map((notice) => (
            <Link
              key={notice.id}
              href={`/notice/${notice.slug}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {notice.category === "긴급" && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    긴급
                  </span>
                )}
                <span className="font-medium text-gray-800">
                  {notice.title}
                </span>
              </div>
              {notice.date && (
                <time className="shrink-0 text-sm text-gray-400">
                  {format(new Date(notice.date), "yyyy.MM.dd", { locale: ko })}
                </time>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Step 4.4: 최신 설교 영상 섹션

```tsx
// src/components/home/LatestSermon.tsx
import type { SermonVideo } from "@/lib/youtube";

export function LatestSermon({ sermon }: { sermon: SermonVideo | null }) {
  if (!sermon) return null;

  return (
    <section className="bg-gray-900 py-16 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">최근 설교</h2>
        <div className="mx-auto max-w-3xl">
          <div className="aspect-video overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube.com/embed/${sermon.videoId}`}
              title={sermon.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <h3 className="mt-4 text-center text-xl font-semibold">
            {sermon.title}
          </h3>
          <p className="mt-1 text-center text-gray-400">
            {sermon.publishedAt}
          </p>
        </div>
      </div>
    </section>
  );
}
```

### Step 4.5: 홈페이지 조립

```tsx
// src/app/page.tsx
import { HeroSection } from "@/components/home/HeroSection";
import { WorshipTimeCard } from "@/components/home/WorshipTimeCard";
import { RecentNotice } from "@/components/home/RecentNotice";
import { LatestSermon } from "@/components/home/LatestSermon";
import { getNotices } from "@/lib/notion";
import { getLatestSermon } from "@/lib/youtube";

export const revalidate = 3600; // ISR: 1시간

export default async function HomePage() {
  const [notices, sermon] = await Promise.all([
    getNotices().then((list) => list.slice(0, 5)),
    getLatestSermon(),
  ]);

  return (
    <>
      <HeroSection />
      <WorshipTimeCard />
      <RecentNotice notices={notices} />
      <LatestSermon sermon={sermon} />
    </>
  );
}
```

---

## Phase 5: 정적 페이지 구현

### Step 5.1: 교회 소개 (인사말)

```tsx
// src/app/(public)/greetings/page.tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "인사말",
};

export default function GreetingsPage() {
  return (
    <>
      <PageHeader title="인사말" description="명성비전교회에 오신 것을 환영합니다" />
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex flex-col items-center gap-6 md:flex-row">
            <Image
              src="/images/pastor.jpg"
              alt="담임목사"
              width={200}
              height={250}
              className="rounded-lg object-cover"
            />
            <div>
              <h2 className="text-xl font-bold">담임목사 OOO</h2>
              <p className="mt-1 text-gray-500">명성비전교회</p>
            </div>
          </div>
          <div className="prose prose-gray max-w-none">
            {/* 실제 인사말 콘텐츠 — Notion에서 가져오거나 직접 작성 */}
            <p>
              사랑하는 성도 여러분, 명성비전교회에 오신 것을 진심으로 환영합니다.
            </p>
            <p>
              저희 교회는 하나님의 말씀을 중심으로 서로 사랑하고
              섬기는 공동체를 지향합니다.
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}
```

### Step 5.2: 오시는 길 (지도)

```tsx
// src/app/(public)/map/page.tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { MapPin, Phone, Mail, Bus, Train } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오시는 길",
};

const CHURCH_ADDRESS = "서울특별시 동작구 (상세주소)";
const GOOGLE_MAPS_EMBED_URL = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(CHURCH_ADDRESS)}&language=ko`;

export default function MapPage() {
  return (
    <>
      <PageHeader title="오시는 길" />
      <Container>
        <div className="grid gap-8 lg:grid-cols-5">
          {/* 지도 */}
          <div className="lg:col-span-3">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border">
              <iframe
                src={GOOGLE_MAPS_EMBED_URL}
                className="h-full w-full"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="교회 위치"
              />
            </div>
          </div>

          {/* 정보 */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">교회 정보</h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 shrink-0 text-primary-500" size={18} />
                  <span>{CHURCH_ADDRESS}</span>
                </div>
                <div className="flex gap-3">
                  <Phone className="shrink-0 text-primary-500" size={18} />
                  <span>02-XXX-XXXX</span>
                </div>
                <div className="flex gap-3">
                  <Mail className="shrink-0 text-primary-500" size={18} />
                  <span>info@msvch.org</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">대중교통 안내</h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Bus className="mt-0.5 shrink-0 text-green-600" size={18} />
                  <div>
                    <p className="font-medium">버스</p>
                    <p className="text-gray-500">OOO 정류장 하차 (도보 5분)</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Train className="mt-0.5 shrink-0 text-blue-600" size={18} />
                  <div>
                    <p className="font-medium">지하철</p>
                    <p className="text-gray-500">O호선 OOO역 O번 출구 (도보 10분)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
```

### Step 5.3: 교회학교 부서 페이지 (공통 템플릿)

```tsx
// src/app/(public)/churchschool/[department]/page.tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface DepartmentInfo {
  title: string;
  description: string;
  ageGroup: string;
  time: string;
  teacher: string;
  image: string;
  features: string[];
}

const departments: Record<string, DepartmentInfo> = {
  infant: {
    title: "유아부",
    description: "영아부터 미취학 아동까지",
    ageGroup: "0~7세",
    time: "주일 오전 11:00",
    teacher: "OOO 전도사",
    image: "/images/dept-infant.jpg",
    features: ["찬양 율동", "성경 이야기", "만들기 활동"],
  },
  elementary: {
    title: "초등부",
    description: "초등학생을 위한 예배와 교육",
    ageGroup: "초등 1~6학년",
    time: "주일 오전 11:00",
    teacher: "OOO 전도사",
    image: "/images/dept-elementary.jpg",
    features: ["예배", "성경공부", "특별활동"],
  },
  teen: {
    title: "청소년부",
    description: "중·고등학생을 위한 예배",
    ageGroup: "중1~고3",
    time: "주일 오후 1:30",
    teacher: "OOO 전도사",
    image: "/images/dept-teen.jpg",
    features: ["예배", "소그룹", "수련회"],
  },
  youth: {
    title: "청년부",
    description: "대학생 및 청년을 위한 모임",
    ageGroup: "대학생·청년",
    time: "주일 오후 2:00",
    teacher: "OOO 목사",
    image: "/images/dept-youth.jpg",
    features: ["예배", "셀 모임", "수양회"],
  },
};

export function generateStaticParams() {
  return Object.keys(departments).map((department) => ({ department }));
}

export function generateMetadata({
  params,
}: {
  params: { department: string };
}): Metadata {
  const dept = departments[params.department];
  if (!dept) return {};
  return { title: dept.title };
}

export default function DepartmentPage({
  params,
}: {
  params: { department: string };
}) {
  const dept = departments[params.department];
  if (!dept) notFound();

  return (
    <>
      <PageHeader title={dept.title} description={dept.description} />
      <Container>
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <Image
            src={dept.image}
            alt={dept.title}
            width={500}
            height={350}
            className="rounded-xl object-cover"
          />
          <div className="space-y-4">
            <InfoRow label="대상" value={dept.ageGroup} />
            <InfoRow label="시간" value={dept.time} />
            <InfoRow label="담당" value={dept.teacher} />
            <div>
              <h3 className="mb-2 font-semibold text-gray-700">주요 프로그램</h3>
              <ul className="list-inside list-disc space-y-1 text-gray-600">
                {dept.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-12 shrink-0 font-semibold text-gray-700">{label}</span>
      <span className="text-gray-600">{value}</span>
    </div>
  );
}
```

### Step 5.4: 문화사역 페이지 (동일 패턴)

```tsx
// src/app/(public)/ministry/[slug]/page.tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface MinistryInfo {
  title: string;
  description: string;
  schedule: string;
  image: string;
  content: string;
}

const ministries: Record<string, MinistryInfo> = {
  beauty: {
    title: "미용봉사",
    description: "지역사회를 섬기는 미용봉사 사역",
    schedule: "매월 셋째 주 토요일",
    image: "/images/ministry-beauty.jpg",
    content: "지역 주민들과 어르신들을 대상으로 무료 미용봉사를 진행합니다.",
  },
  tabletennis: {
    title: "탁구",
    description: "건강한 몸과 마음을 위한 탁구 모임",
    schedule: "매주 토요일 오후 2:00",
    image: "/images/ministry-tabletennis.jpg",
    content: "교인과 지역 주민이 함께하는 탁구 모임입니다.",
  },
  sidedish: {
    title: "반찬사역",
    description: "이웃을 향한 사랑의 반찬 나눔",
    schedule: "매주 금요일",
    image: "/images/ministry-sidedish.jpg",
    content: "홀몸 어르신과 이웃에게 정성스러운 반찬을 나눕니다.",
  },
};

export function generateStaticParams() {
  return Object.keys(ministries).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const m = ministries[params.slug];
  return m ? { title: m.title } : {};
}

export default function MinistryPage({ params }: { params: { slug: string } }) {
  const m = ministries[params.slug];
  if (!m) notFound();

  return (
    <>
      <PageHeader title={m.title} description={m.description} />
      <Container>
        <div className="mx-auto max-w-3xl">
          <Image
            src={m.image}
            alt={m.title}
            width={800}
            height={400}
            className="mb-8 w-full rounded-xl object-cover"
          />
          <div className="rounded-lg bg-primary-50 p-4 text-sm">
            <strong>일정:</strong> {m.schedule}
          </div>
          <div className="prose prose-gray mt-6 max-w-none">
            <p>{m.content}</p>
          </div>
        </div>
      </Container>
    </>
  );
}
```

---

## Phase 6: 동적 콘텐츠 페이지

### Step 6.1: 공지사항 목록

```tsx
// src/app/(public)/notice/page.tsx
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getNotices } from "@/lib/notion";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "공지사항" };
export const revalidate = 3600;

export default async function NoticePage() {
  const notices = await getNotices();

  return (
    <>
      <PageHeader title="공지사항" />
      <Container>
        <div className="mx-auto max-w-3xl divide-y rounded-xl border bg-white">
          {notices.map((notice) => (
            <Link
              key={notice.id}
              href={`/notice/${notice.slug}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {notice.category && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {notice.category}
                  </span>
                )}
                <span className="font-medium">{notice.title}</span>
              </div>
              {notice.date && (
                <time className="shrink-0 text-sm text-gray-400">
                  {format(new Date(notice.date), "yyyy.MM.dd", { locale: ko })}
                </time>
              )}
            </Link>
          ))}
          {notices.length === 0 && (
            <p className="px-6 py-12 text-center text-gray-400">
              등록된 공지사항이 없습니다.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
```

### Step 6.2: 공지사항 상세

```tsx
// src/app/(public)/notice/[slug]/page.tsx
import { Container } from "@/components/ui/Container";
import { getNoticeBySlug, getNotices } from "@/lib/notion";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  const notices = await getNotices();
  return notices.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const notice = await getNoticeBySlug(params.slug);
  return notice ? { title: notice.title } : {};
}

export default async function NoticeDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const notice = await getNoticeBySlug(params.slug);
  if (!notice) notFound();

  return (
    <Container>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/notice"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> 목록으로
        </Link>

        <h1 className="text-2xl font-bold">{notice.title}</h1>
        {notice.date && (
          <p className="mt-2 text-sm text-gray-400">{notice.date}</p>
        )}

        <hr className="my-6" />

        <article
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />
      </div>
    </Container>
  );
}
```

### Step 6.3: 갤러리

```tsx
// src/app/(public)/gallery/page.tsx
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getGalleryAlbums } from "@/lib/notion";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "갤러리" };
export const revalidate = 3600;

export default async function GalleryPage() {
  const albums = await getGalleryAlbums();

  return (
    <>
      <PageHeader title="갤러리" description="교회 활동 사진을 확인하세요" />
      <Container>
        <GalleryGrid albums={albums} />
      </Container>
    </>
  );
}
```

```tsx
// src/components/gallery/GalleryGrid.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryAlbum } from "@/lib/notion";

const categories = ["전체", "예배", "교회학교", "교회행사", "봉사센터", "새가족"];

export function GalleryGrid({ albums }: { albums: GalleryAlbum[] }) {
  const [filter, setFilter] = useState("전체");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  const filtered =
    filter === "전체"
      ? albums
      : albums.filter((a) => a.category === filter);

  function openAlbum(images: string[]) {
    setLightboxImages(images);
    setLightboxOpen(true);
  }

  return (
    <>
      {/* 카테고리 필터 */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === cat
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 앨범 그리드 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((album) => (
          <button
            key={album.id}
            onClick={() => openAlbum(album.images)}
            className="group overflow-hidden rounded-xl border text-left shadow-sm transition hover:shadow-md"
          >
            <div className="relative aspect-[4/3]">
              {album.thumbnail && (
                <Image
                  src={album.thumbnail}
                  alt={album.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{album.title}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {album.date} · {album.images.length}장
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* 라이트박스 */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages.map((src) => ({ src }))}
      />
    </>
  );
}
```

### Step 6.4: YouTube 연동 (설교 영상)

```ts
// src/lib/youtube.ts
export interface SermonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

export async function getSermonVideos(
  maxResults = 20
): Promise<SermonVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    channelId: process.env.YOUTUBE_CHANNEL_ID!,
    maxResults: String(maxResults),
    order: "date",
    type: "video",
    key: process.env.YOUTUBE_API_KEY!,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return [];

  const data = await res.json();

  return data.items.map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.high.url,
    publishedAt: item.snippet.publishedAt,
  }));
}

export async function getLatestSermon(): Promise<SermonVideo | null> {
  const videos = await getSermonVideos(1);
  return videos[0] || null;
}
```

```tsx
// src/app/(public)/sermons/page.tsx
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSermonVideos } from "@/lib/youtube";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "설교 영상" };
export const revalidate = 3600;

export default async function SermonsPage() {
  const videos = await getSermonVideos();

  return (
    <>
      <PageHeader title="설교 영상" description="예배 설교를 다시 보실 수 있습니다" />
      <Container>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Link
              key={video.videoId}
              href={`/sermons/${video.videoId}`}
              className="group overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-video">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                  <div className="rounded-full bg-white/90 p-3">▶</div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 font-medium">{video.title}</h3>
                <time className="mt-2 block text-sm text-gray-400">
                  {format(new Date(video.publishedAt), "yyyy년 M월 d일", { locale: ko })}
                </time>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
```

```tsx
// src/app/(public)/sermons/[id]/page.tsx
import { Container } from "@/components/ui/Container";
import { getSermonVideos } from "@/lib/youtube";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const revalidate = 3600;

export default async function SermonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const videos = await getSermonVideos();
  const video = videos.find((v) => v.videoId === params.id);

  return (
    <Container>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/sermons"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} /> 목록으로
        </Link>

        <div className="aspect-video overflow-hidden rounded-xl">
          <iframe
            src={`https://www.youtube.com/embed/${params.id}`}
            title={video?.title ?? "설교 영상"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>

        {video && (
          <>
            <h1 className="mt-6 text-2xl font-bold">{video.title}</h1>
            <p className="mt-2 text-gray-400">{video.publishedAt}</p>
            {video.description && (
              <p className="mt-4 whitespace-pre-line text-gray-600">
                {video.description}
              </p>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
```

### Step 6.5: 주보 페이지

```tsx
// src/app/(public)/weekly/page.tsx
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { FileText, Download } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getWeeklies } from "@/lib/notion";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "주보" };
export const revalidate = 3600;

export default async function WeeklyPage() {
  const weeklies = await getWeeklies();

  return (
    <>
      <PageHeader title="주보" description="매주 주보를 확인하세요" />
      <Container>
        <div className="mx-auto max-w-2xl space-y-3">
          {weeklies.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg border bg-white px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-primary-500" size={20} />
                <div>
                  <p className="font-medium">{w.title}</p>
                  {w.date && (
                    <p className="text-sm text-gray-400">
                      {format(new Date(w.date), "yyyy년 M월 d일", { locale: ko })}
                    </p>
                  )}
                </div>
              </div>
              {w.pdfUrl && (
                <a
                  href={w.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-100"
                >
                  <Download size={14} /> PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
```

---

## Phase 7: Supabase 인증 및 회원 기능

### Step 7.1: Supabase 스키마 (SQL)

```sql
-- supabase/migrations/001_initial.sql

-- 프로필 (auth.users 확장)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "프로필 본인 조회" on public.profiles
  for select using (auth.uid() = id);
create policy "프로필 본인 수정" on public.profiles
  for update using (auth.uid() = id);
create policy "관리자 전체 조회" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 자동 프로필 생성 트리거
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 그룹
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz default now()
);

-- 그룹 게시글
create table public.group_posts (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups on delete cascade not null,
  author_id uuid references public.profiles on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.group_posts enable row level security;

create policy "게시글 전체 조회" on public.group_posts
  for select using (true);
create policy "게시글 본인 작성" on public.group_posts
  for insert with check (auth.uid() = author_id);
create policy "게시글 본인 수정" on public.group_posts
  for update using (auth.uid() = author_id);
create policy "게시글 본인 삭제" on public.group_posts
  for delete using (auth.uid() = author_id);

-- 초기 그룹 데이터
insert into public.groups (name, slug, description) values
  ('공지', 'gongji', '교회 공지사항 토론'),
  ('주보', 'jubo', '주보 관련 나눔');
```

### Step 7.2: Supabase 클라이언트

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```ts
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```ts
// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 인증 필요 페이지 보호
  if (request.nextUrl.pathname.startsWith("/groups") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/groups/:path*", "/admin/:path*", "/profile/:path*"],
};
```

### Step 7.3: 로그인 페이지

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Container } from "@/components/ui/Container";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Container className="flex items-center justify-center py-20">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold">로그인</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-primary-600 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </Container>
  );
}
```

### Step 7.4: 그룹 토론 페이지

```tsx
// src/app/(member)/groups/page.tsx
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .order("created_at");

  return (
    <>
      <PageHeader title="그룹" description="교회 그룹에 참여하세요" />
      <Container>
        <div className="mx-auto max-w-2xl space-y-4">
          {groups?.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.slug}`}
              className="flex items-center gap-4 rounded-xl border bg-white p-6 transition hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                <Users className="text-primary-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
```

```tsx
// src/app/(member)/groups/[groupId]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { DiscussionList } from "@/components/groups/DiscussionList";
import { notFound } from "next/navigation";

export default async function GroupDetailPage({
  params,
}: {
  params: { groupId: string };
}) {
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("slug", params.groupId)
    .single();

  if (!group) notFound();

  const { data: posts } = await supabase
    .from("group_posts")
    .select("*, profiles(name)")
    .eq("group_id", group.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title={group.name} description={group.description} />
      <Container>
        <DiscussionList groupId={group.id} initialPosts={posts ?? []} />
      </Container>
    </>
  );
}
```

```tsx
// src/components/groups/DiscussionList.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles: { name: string };
}

export function DiscussionList({
  groupId,
  initialPosts,
}: {
  groupId: string;
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("group_posts").insert({
      group_id: groupId,
      author_id: user.id,
      title,
      content,
    });

    if (!error) {
      setTitle("");
      setContent("");
      setShowForm(false);
      // 새로고침해서 목록 갱신
      const { data } = await supabase
        .from("group_posts")
        .select("*, profiles(name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (data) setPosts(data);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? "취소" : "글쓰기"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border bg-white p-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            required
            className="mb-3 w-full rounded-lg border px-4 py-2.5"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            required
            rows={5}
            className="mb-3 w-full resize-none rounded-lg border px-4 py-2.5"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            등록
          </button>
        </form>
      )}

      <div className="divide-y rounded-xl border bg-white">
        {posts.map((post) => (
          <div key={post.id} className="px-6 py-4">
            <h3 className="font-medium">{post.title}</h3>
            <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">
              {post.content}
            </p>
            <div className="mt-3 flex gap-3 text-xs text-gray-400">
              <span>{post.profiles.name}</span>
              <span>
                {format(new Date(post.created_at), "yyyy.MM.dd HH:mm", { locale: ko })}
              </span>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="px-6 py-12 text-center text-gray-400">
            아직 게시글이 없습니다. 첫 글을 작성해보세요!
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## Phase 8: 관리자 대시보드

### Step 8.1: 관리자 레이아웃

```tsx
// src/app/admin/layout.tsx
import Link from "next/link";
import { LayoutDashboard, FileText, Image as ImageIcon } from "lucide-react";

const adminNav = [
  { label: "대시보드", href: "/admin", icon: LayoutDashboard },
  { label: "게시물", href: "/admin/posts", icon: FileText },
  { label: "갤러리", href: "/admin/gallery", icon: ImageIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-60 border-r bg-gray-50 p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase text-gray-400">관리자</h2>
        <nav className="space-y-1">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

### Step 8.2: 관리자 대시보드

```tsx
// src/app/admin/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: postCount } = await supabase
    .from("group_posts")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">대시보드</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="전체 회원" value={memberCount ?? 0} />
        <StatCard label="그룹 게시글" value={postCount ?? 0} />
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-gray-500">Notion CMS</p>
          <p className="mt-1 text-sm">
            공지사항, 주보, 갤러리는{" "}
            <a
              href="https://notion.so"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 underline"
            >
              Notion
            </a>
            에서 관리하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
```

---

## Phase 9: SEO 및 성능 최적화

### Step 9.1: 사이트맵 자동 생성

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { getNotices } from "@/lib/notion";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.msvch.org";

  // 정적 페이지
  const staticPages = [
    "", "/greetings", "/intro", "/map",
    "/worship", "/weekly", "/timetable", "/sermons",
    "/churchschool", "/churchschool/infant", "/churchschool/elementary",
    "/churchschool/teen", "/churchschool/youth",
    "/notice", "/gallery", "/volunteer",
    "/ministry", "/ministry/beauty", "/ministry/tabletennis", "/ministry/sidedish",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
  }));

  // 동적 공지사항
  const notices = await getNotices();
  const noticePages = notices.map((n) => ({
    url: `${baseUrl}/notice/${n.slug}`,
    lastModified: n.date ? new Date(n.date) : new Date(),
    changeFrequency: "monthly" as const,
  }));

  return [...staticPages, ...noticePages];
}
```

### Step 9.2: robots.txt

```ts
// src/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://www.msvch.org/sitemap.xml",
  };
}
```

### Step 9.3: OG 이미지 API

```tsx
// src/app/api/og/route.tsx
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title") ?? "명성비전교회";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.8 }}>명성비전교회</div>
        <div style={{ fontSize: 52, fontWeight: "bold", marginTop: 16 }}>
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

---

## Phase 10: Cloudflare Pages 배포

### Step 10.1: next.config.ts (Cloudflare 호환)

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.notion.so" },
      { protocol: "https", hostname: "**.amazonaws.com" },  // Notion S3
      { protocol: "https", hostname: "i.ytimg.com" },       // YouTube 썸네일
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  // Cloudflare Pages: 정적 export가 가장 안정적
  // SSR이 필요하면 @cloudflare/next-on-pages 사용
  output: "standalone",
};

export default nextConfig;
```

### Step 10.2: Cloudflare 배포 설정

```toml
# wrangler.toml (Cloudflare Pages with next-on-pages)
name = "msvch"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NODE_VERSION = "20"
```

```json
// package.json scripts 추가
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:dev": "npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat",
    "pages:deploy": "npx wrangler pages deploy .vercel/output/static"
  }
}
```

### Step 10.3: GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy .next --project-name=msvch
```

---

## Phase 11: Wix 리다이렉트 및 도메인 이전

### Step 11.1: 301 리다이렉트 맵

```ts
// next.config.ts 에 추가
const nextConfig: NextConfig = {
  // ... 기존 설정
  async redirects() {
    return [
      // Wix 블로그 URL → 새 공지 경로
      { source: "/post/:slug", destination: "/notice/:slug", permanent: true },
      // Wix 그룹 URL → 새 그룹 경로
      { source: "/group/gongji/discussion/:id", destination: "/groups/gongji", permanent: true },
      { source: "/group/jubo/discussion/:id", destination: "/groups/jubo", permanent: true },
      // 기존 경로 유지 (변경된 것만)
      { source: "/home-1", destination: "/", permanent: true },
      { source: "/servers", destination: "/volunteer", permanent: true },
      { source: "/beauty", destination: "/ministry/beauty", permanent: true },
      { source: "/tabletennis", destination: "/ministry/tabletennis", permanent: true },
      { source: "/sidedish", destination: "/ministry/sidedish", permanent: true },
      { source: "/culture", destination: "/ministry", permanent: true },
      { source: "/teen", destination: "/churchschool/teen", permanent: true },
      { source: "/youth", destination: "/churchschool/youth", permanent: true },
      { source: "/infant", destination: "/churchschool/infant", permanent: true },
      { source: "/elementary", destination: "/churchschool/elementary", permanent: true },
      { source: "/members", destination: "/login", permanent: true },
    ];
  },
};
```

### Step 11.2: 도메인 이전 순서

1. Cloudflare 계정에서 `msvch.org` 사이트 추가
2. Cloudflare가 제공하는 네임서버 확인 (예: `ada.ns.cloudflare.com`)
3. 도메인 레지스트라에서 네임서버를 Cloudflare로 변경
4. Cloudflare Pages > Custom Domains에서 `www.msvch.org` 추가
5. DNS 전파 대기 (24~48시간)
6. HTTPS 자동 발급 확인

---

## 구현 순서 요약 (작업 체크리스트)

| # | 작업 | 파일 | 상태 |
|---|------|------|------|
| 1 | Next.js 프로젝트 초기화 | `package.json`, `tsconfig.json` | ✅ |
| 2 | 의존성 설치 | `package.json` | ✅ |
| 3 | Tailwind 디자인 토큰 | `globals.css` (@theme inline) | ✅ |
| 4 | 유틸리티 (cn 등) | `src/lib/utils.ts` | ✅ |
| 5 | 루트 레이아웃 | `src/app/layout.tsx` | ✅ |
| 6 | 네비게이션 설정 | `src/components/layout/nav-config.ts` | ✅ |
| 7 | 헤더 | `src/components/layout/Header.tsx` | ✅ |
| 8 | 푸터 | `src/components/layout/Footer.tsx` | ✅ |
| 9 | 공통 UI (Container, Card, PageHeader, Skeleton) | `src/components/ui/*` | ✅ |
| 10 | 홈페이지 (히어로, 예배시간, 공지, 설교) | `src/app/page.tsx`, `src/components/home/*` | ✅ |
| 11 | Notion API 클라이언트 | `src/lib/notion.ts` | ✅ |
| 12 | YouTube API 클라이언트 | `src/lib/youtube.ts` | ✅ |
| 13 | 정적 페이지 (인사말, 소개, 지도) | `src/app/(public)/*` | ✅ |
| 14 | 교회학교 부서 페이지 | `src/app/(public)/churchschool/*` | ✅ |
| 15 | 문화사역 페이지 | `src/app/(public)/ministry/*` | ✅ |
| 16 | 공지사항 (목록 + 상세) | `src/app/(public)/notice/*` | ✅ |
| 17 | 갤러리 | `src/app/(public)/gallery/*`, `src/components/gallery/*` | ✅ |
| 18 | 설교 영상 (목록 + 상세) | `src/app/(public)/sermons/*` | ✅ |
| 19 | 주보 | `src/app/(public)/weekly/*` | ✅ |
| 20 | Supabase 스키마 | `supabase/migrations/001_initial.sql` | ✅ |
| 21 | Supabase 클라이언트 | `src/lib/supabase/*` | ✅ |
| 22 | 미들웨어 (인증 가드) | `src/middleware.ts` | ✅ |
| 23 | 로그인/회원가입 | `src/app/(auth)/*` | ✅ |
| 24 | 그룹 토론 | `src/app/(member)/groups/*` | ✅ |
| 25 | 관리자 대시보드 | `src/app/admin/*` | ✅ |
| 26 | SEO (사이트맵, robots, OG, 404) | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/not-found.tsx` | ✅ |
| 27 | ISR 재검증 API | `src/app/api/revalidate/route.ts` | ✅ |
| 28 | Cloudflare 배포 설정 | `.github/workflows/deploy.yml` | ✅ |
| 29 | Wix 리다이렉트 | `next.config.ts` | ✅ |
| 30 | 도메인 DNS 이전 | Cloudflare 대시보드 | ⬜ (수동 작업 필요) |
