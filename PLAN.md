# 메뉴 구조 개편 구현 계획

> 원칙: 백엔드(DB/API)는 모바일 앱에서도 그대로 사용할 수 있도록 범용적으로 설계한다.
> 웹 전용 UI 로직은 프론트엔드에서만 처리한다.

---

## Phase 1: DB 스키마 + API 확장 (백엔드, 모바일 호환)

### Step 1-1: gallery_albums에 tags 컬럼 추가

현재 `category`는 단일 문자열("예배", "교회학교" 등). 하위부서 필터를 위해 **tags 배열 컬럼**을 추가한다. `sub_category` 단일 값 대신 tags를 쓰는 이유: 하나의 앨범이 여러 태그를 가질 수 있고(예: "교회학교" + "영유치부"), 모바일에서도 태그 기반 필터링을 그대로 쓸 수 있다.

**마이그레이션 파일**: `supabase/migrations/004_gallery_tags.sql`

```sql
-- gallery_albums에 tags 배열 컬럼 추가
ALTER TABLE gallery_albums
  ADD COLUMN tags text[] DEFAULT '{}';

-- 기존 category 값을 tags로 마이그레이션
UPDATE gallery_albums SET tags = ARRAY[category] WHERE category IS NOT NULL;

-- tags 검색 성능을 위한 GIN 인덱스
CREATE INDEX idx_gallery_albums_tags ON gallery_albums USING GIN (tags);

-- category 컬럼은 당분간 유지 (하위호환)
-- 추후 모바일 앱 안정화 후 제거 가능
```

**타입 수정**: `src/types/gallery.ts`

```ts
export interface GalleryAlbum {
  id: string;
  title: string;
  category: string | null;   // 하위호환 유지
  tags: string[];             // 신규
  date: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
  images: GalleryImage[];
}
```

### Step 1-2: 갤러리 lib 함수를 태그 필터 지원으로 확장

**수정 파일**: `src/lib/gallery.ts`

```ts
import { createClient } from "@/lib/supabase/server";
import type { GalleryAlbum, GalleryImage } from "@/types/gallery";

interface GetAlbumsOptions {
  tags?: string[];       // 이 태그를 모두 포함하는 앨범 (AND)
  anyTags?: string[];    // 이 태그 중 하나라도 포함하는 앨범 (OR)
  limit?: number;
}

export async function getGalleryAlbums(options: GetAlbumsOptions = {}): Promise<GalleryAlbum[]> {
  const supabase = await createClient();
  const { tags, anyTags, limit } = options;

  let query = supabase
    .from("gallery_albums")
    .select("*")
    .eq("is_public", true)
    .order("date", { ascending: false });

  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }
  if (anyTags && anyTags.length > 0) {
    query = query.overlaps("tags", anyTags);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data: albums } = await query;
  if (!albums || albums.length === 0) return [];

  const albumIds = albums.map((a) => a.id as string);
  const { data: images } = await supabase
    .from("gallery_images")
    .select("*")
    .in("album_id", albumIds)
    .order("sort_order", { ascending: true });

  return albums.map((album) => ({
    id: album.id as string,
    title: album.title as string,
    category: album.category as string | null,
    tags: (album.tags as string[]) ?? [],
    date: album.date as string | null,
    thumbnail_url: album.thumbnail_url as string | null,
    is_public: album.is_public as boolean,
    created_at: album.created_at as string,
    images: (images?.filter((img) => img.album_id === album.id) ?? []) as GalleryImage[],
  }));
}
```

### Step 1-3: 갤러리 REST API (모바일용)

**신규 파일**: `src/app/api/gallery/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getGalleryAlbums } from "@/lib/gallery";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tags = searchParams.getAll("tag");
  const anyTags = searchParams.getAll("anyTag");
  const limit = searchParams.get("limit");

  const albums = await getGalleryAlbums({
    tags: tags.length > 0 ? tags : undefined,
    anyTags: anyTags.length > 0 ? anyTags : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  return NextResponse.json(albums);
}
```

사용 예:
- `GET /api/gallery` → 전체
- `GET /api/gallery?tag=교회학교&tag=영유치부` → 교회학교 AND 영유치부
- `GET /api/gallery?anyTag=예배&anyTag=교회행사` → 예배 OR 교회행사

---

## Phase 2: 네비게이션 메뉴 구조 변경

### Step 2-1: nav-config.ts 재작성

**수정 파일**: `src/components/layout/nav-config.ts`

```ts
import type { ContentKey } from "@/app/api/new-content/route";

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
  badgeKey?: ContentKey;
}

export const navItems: NavItem[] = [
  {
    label: "교회소개",
    href: "/greetings",
    children: [
      { label: "인사말", href: "/greetings" },
      { label: "공지사항", href: "/notice", badgeKey: "notices" },
      { label: "예배안내", href: "/worship" },
      { label: "섬기는 이들", href: "/staff" },
      { label: "찾아오시는 길", href: "/map" },
      { label: "주보", href: "/weekly", badgeKey: "weeklies" },
    ],
  },
  {
    label: "말씀영상",
    href: "/sermons",
    badgeKey: "sermons",
  },
  {
    label: "비전갤러리",
    href: "/gallery",
    badgeKey: "gallery",
  },
  {
    label: "교회학교",
    href: "/churchschool",
    children: [
      { label: "영유치부", href: "/churchschool/infant" },
      { label: "아동부", href: "/churchschool/elementary" },
      { label: "청소년부", href: "/churchschool/teen" },
      { label: "청년부", href: "/churchschool/youth" },
    ],
  },
  {
    label: "봉사센터",
    href: "/volunteer-center",
    children: [
      { label: "사랑의 반찬나눔", href: "/volunteer-center/sidedish" },
      { label: "사랑의 이미용봉사", href: "/volunteer-center/beauty" },
      { label: "비전문화학교", href: "/volunteer-center/culture" },
      { label: "탁구교실", href: "/volunteer-center/tabletennis" },
    ],
  },
];
```

### Step 2-2: Header.tsx — 상위 badgeKey 지원 + 모바일 단일 링크

**수정 파일**: `src/components/layout/Header.tsx`

현재 레드닷은 children의 badge만 확인. 상위 메뉴의 `badgeKey`도 확인하도록 수정.
children이 없는 메뉴(말씀영상, 비전갤러리)는 모바일에서 `<button>` 대신 `<Link>`로 렌더링.

**데스크톱 nav 변경 (2곳)**:
```tsx
// 기존
{hasChildBadge(item.children, dots) && <RedDot />}

// 변경 — 자체 badgeKey OR children의 badge
{((item.badgeKey && dots[item.badgeKey]) || hasChildBadge(item.children, dots)) && <RedDot />}
```

**모바일 메뉴 변경 — children 유무에 따라 Link/button 분기**:
```tsx
{item.children ? (
  <button
    onClick={() => setOpenSubmenu(openSubmenu === item.href ? null : item.href)}
    className="flex w-full items-center justify-between py-3 text-[0.95rem] font-medium text-gray-800"
  >
    <span className="flex items-center">
      {item.label}
      {((item.badgeKey && dots[item.badgeKey]) || hasChildBadge(item.children, dots)) && <RedDot />}
    </span>
    <ChevronDown
      size={16}
      className={cn(
        "text-gray-400 transition-transform duration-200",
        openSubmenu === item.href && "rotate-180 text-primary-600"
      )}
    />
  </button>
) : (
  <Link
    href={item.href}
    onClick={() => setMobileOpen(false)}
    className="flex w-full items-center py-3 text-[0.95rem] font-medium text-gray-800"
  >
    {item.label}
    {item.badgeKey && dots[item.badgeKey] && <RedDot />}
  </Link>
)}
```

### Step 2-3: tab-config.ts 업데이트

**수정 파일**: `src/components/layout/tab-config.ts`

```ts
import { Home, Play, Images, BookOpen, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ContentKey } from "@/app/api/new-content/route";

export interface TabItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKeys?: ContentKey[];
}

export const tabItems: TabItem[] = [
  { key: "home", label: "홈", href: "/", icon: Home, exact: true },
  { key: "sermons", label: "말씀", href: "/sermons", icon: Play, badgeKeys: ["sermons"] },
  { key: "gallery", label: "갤러리", href: "/gallery", icon: Images, badgeKeys: ["gallery"] },
  { key: "notice", label: "소식", href: "/notice", icon: BookOpen, badgeKeys: ["notices"] },
  { key: "more", label: "더보기", href: "/menu", icon: Heart, badgeKeys: ["gallery"] },
];

export const HIDDEN_PATHS = ["/admin", "/login", "/signup"];
```

---

## Phase 3: 신규 페이지 생성

### Step 3-1: 섬기는 이들 (/staff)

**신규 파일**: `src/app/(public)/staff/page.tsx`

```tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "섬기는 이들" };

interface StaffMember {
  name: string;
  title: string;
  role: string;
  image: string;
}

const staff: StaffMember[] = [
  { name: "이양재", title: "담임목사", role: "", image: "/images/staff1.avif" },
  { name: "우 영", title: "목사", role: "교구 / 목장", image: "/images/staff2.avif" },
  { name: "이준영", title: "전도사", role: "기획 / 청년부", image: "/images/staff3.avif" },
  { name: "최희성", title: "전도사", role: "행정 미디어 / 청소년부", image: "/images/staff4.avif" },
  { name: "임한나", title: "전도사", role: "아동부", image: "/images/staff5.avif" },
  { name: "박가람", title: "교육사", role: "영유치부", image: "/images/staff6.avif" },
];

export default function StaffPage() {
  return (
    <>
      <PageHeader title="섬기는 이들" description="명성비전교회를 섬기는 사역자들입니다" />
      <Container>
        <div className="mx-auto max-w-4xl">
          {/* 담임목사 */}
          <div className="mb-10 flex flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:flex-row">
            <Image
              src={staff[0].image}
              alt={staff[0].name}
              width={180}
              height={220}
              className="rounded-xl object-cover shadow-md"
            />
            <div className="text-center md:text-left">
              <p className="text-sm font-medium text-primary-600">{staff[0].title}</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">{staff[0].name}</h2>
            </div>
          </div>

          {/* 나머지 사역자 */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.slice(1).map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  width={140}
                  height={170}
                  className="rounded-xl object-cover shadow-md"
                />
                <p className="mt-4 text-sm font-medium text-primary-600">{member.title}</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">{member.name}</h3>
                {member.role && (
                  <p className="mt-1 text-sm text-gray-500">{member.role}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
```

### Step 3-2: 봉사센터 목록 (/volunteer-center)

**신규 파일**: `src/app/(public)/volunteer-center/page.tsx`

```tsx
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { UtensilsCrossed, Scissors, GraduationCap, TableProperties } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "봉사센터" };

const centers = [
  {
    slug: "sidedish",
    title: "사랑의 반찬나눔",
    description: "홀몸 어르신과 이웃에게 정성스러운 반찬을 만들어 나눕니다",
    icon: UtensilsCrossed,
    schedule: "매주 금요일",
  },
  {
    slug: "beauty",
    title: "사랑의 이미용봉사",
    description: "지역 주민들과 어르신들을 대상으로 무료 미용봉사를 진행합니다",
    icon: Scissors,
    schedule: "매월 셋째 주 토요일",
  },
  {
    slug: "culture",
    title: "비전문화학교",
    description: "지역사회를 위한 문화 교육 프로그램을 운영합니다",
    icon: GraduationCap,
    schedule: "",
  },
  {
    slug: "tabletennis",
    title: "탁구교실",
    description: "교인과 지역 주민이 함께하는 건강한 운동과 교제",
    icon: TableProperties,
    schedule: "매주 토요일 오후 2:00",
  },
];

export default function VolunteerCenterPage() {
  return (
    <>
      <PageHeader title="봉사센터" description="지역사회를 섬기는 명성비전교회 봉사 사역" />
      <Container>
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {centers.map((center) => (
            <Link
              key={center.slug}
              href={`/volunteer-center/${center.slug}`}
              className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <center.icon size={28} className="text-primary-600" />
              <h3 className="mt-3 text-lg font-bold text-gray-900">{center.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{center.description}</p>
              {center.schedule && (
                <p className="mt-3 text-xs font-medium text-primary-600">{center.schedule}</p>
              )}
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
```

### Step 3-3: 봉사센터 상세 (/volunteer-center/[slug])

**신규 파일**: `src/app/(public)/volunteer-center/[slug]/page.tsx`

기존 `/ministry/[slug]/page.tsx`와 동일한 구조, 데이터만 변경:

```tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface CenterInfo {
  title: string;
  description: string;
  schedule: string;
  content: string;
}

const centers: Record<string, CenterInfo> = {
  sidedish: {
    title: "사랑의 반찬나눔",
    description: "이웃을 향한 사랑의 반찬 나눔",
    schedule: "매주 금요일",
    content: "홀몸 어르신과 이웃에게 정성스러운 반찬을 만들어 나눕니다. 동작구와 함께하는 이웃사랑 나눔의 손길입니다.",
  },
  beauty: {
    title: "사랑의 이미용봉사",
    description: "지역사회를 섬기는 이미용봉사 사역",
    schedule: "매월 셋째 주 토요일",
    content: "지역 주민들과 어르신들을 대상으로 무료 미용봉사를 진행합니다. 작은 섬김이지만 이웃에게 따뜻한 사랑을 전하는 귀한 사역입니다.",
  },
  culture: {
    title: "비전문화학교",
    description: "지역사회를 위한 문화 교육 프로그램",
    schedule: "",
    content: "지역사회를 위한 다양한 문화 교육 프로그램을 운영합니다.",
  },
  tabletennis: {
    title: "탁구교실",
    description: "건강한 몸과 마음을 위한 탁구 모임",
    schedule: "매주 토요일 오후 2:00",
    content: "교인과 지역 주민이 함께하는 탁구 모임입니다. 건강한 운동과 즐거운 교제가 함께합니다.",
  },
};

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return Object.keys(centers).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = centers[slug];
  return c ? { title: c.title } : {};
}

export default async function VolunteerCenterDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const c = centers[slug];
  if (!c) notFound();

  return (
    <>
      <PageHeader title={c.title} description={c.description} />
      <Container>
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-8">
            {c.schedule && (
              <div className="mb-6 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
                <strong>일정:</strong> {c.schedule}
              </div>
            )}
            <div className="prose max-w-none text-gray-700">
              <p>{c.content}</p>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
```

---

## Phase 4: 기존 페이지 수정

### Step 4-1: 인사말 (/greetings) — 사진 한 장으로

**수정 파일**: `src/app/(public)/greetings/page.tsx`

기존 내용(pastor.avif + 텍스트 3문단)을 greetings.avif 이미지만 표시하도록 변경:

```tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "인사말" };

export default function GreetingsPage() {
  return (
    <>
      <PageHeader title="인사말" description="명성비전교회에 오신 것을 환영합니다" />
      <Container>
        <div className="mx-auto max-w-3xl">
          <Image
            src="/images/greetings.avif"
            alt="명성비전교회 인사말"
            width={800}
            height={600}
            className="w-full rounded-2xl shadow-md"
            priority
          />
        </div>
      </Container>
    </>
  );
}
```

### Step 4-2: 예배안내 (/worship) — 시간표 통합

**수정 파일**: `src/app/(public)/worship/page.tsx`

기존 6개 카드 + timetable의 상세 데이터를 통합한 완전한 시간표.
menucategory.md의 교회학교 시간과 timetable 페이지의 데이터를 합친다.

> **주의**: `worship-time.avif` 이미지를 직접 확인하여 빠진 항목이 없는지 반드시 검증.

```tsx
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Clock, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "예배안내" };

interface WorshipInfo {
  name: string;
  time: string;
  day: string;
  location: string;
}

const mainWorship: WorshipInfo[] = [
  { name: "주일예배 1부", time: "오전 8:00", day: "매주 일요일", location: "본당" },
  { name: "주일예배 2부", time: "오전 10:00", day: "매주 일요일", location: "본당" },
  { name: "주일예배 3부", time: "낮 12:00", day: "매주 일요일", location: "본당" },
  { name: "수요예배", time: "오후 7:30", day: "매주 수요일", location: "본당" },
  { name: "금요기도회", time: "오후 7:30", day: "매주 금요일", location: "본당" },
  { name: "새벽예배", time: "오전 6:00 (토 6:30)", day: "매일 (월~토)", location: "본당" },
];

const schoolWorship: WorshipInfo[] = [
  { name: "영유치부", time: "낮 12:00", day: "매주 일요일", location: "본관 1층" },
  { name: "아동부", time: "오전 10:00", day: "매주 일요일", location: "교육관 2층" },
  { name: "청소년부", time: "낮 12:00", day: "매주 일요일", location: "교육관 3층 갈릴리실" },
  { name: "청년부", time: "오후 2:30", day: "매월 첫째주일", location: "본관 2층" },
];

const specialMeetings: WorshipInfo[] = [
  { name: "토요 노방전도", time: "오후 2:00", day: "매주 토요일", location: "2주년교회" },
];

function WorshipCard({ worship }: { worship: WorshipInfo }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">{worship.name}</h3>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock size={15} className="shrink-0 text-primary-500" />
          <span>{worship.day} {worship.time}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={15} className="shrink-0 text-primary-500" />
          <span>{worship.location}</span>
        </div>
      </div>
    </div>
  );
}

export default function WorshipPage() {
  return (
    <>
      <PageHeader title="예배안내" description="하나님께 드리는 예배에 함께해 주세요" />
      <Container>
        <div className="mx-auto max-w-4xl space-y-10">
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">예배 시간</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mainWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">교회학교</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {schoolWorship.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-bold text-gray-900">특별 모임</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {specialMeetings.map((w) => <WorshipCard key={w.name} worship={w} />)}
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
```

### Step 4-3: 교회학교 부서 페이지 전면 개편

**수정 파일**: `src/app/(public)/churchschool/[department]/page.tsx`

menucategory.md의 상세 데이터(표어, 주제말씀, 교육목표, 조직, 기도제목)를 모두 반영.
갤러리 사진을 페이지 상단에 배치.

departments 데이터 (4개 부서 전체):

```ts
const departments: Record<string, DepartmentInfo> = {
  infant: {
    title: "영유치부",
    description: "하나님의 사랑 안에서 자라는 아이들",
    target: "0~7세",
    time: "주일 낮 12시",
    location: "본관 1층",
    motto: "복음의 열매 맺는 영유치부",
    verse: "복음으로 쑥쑥쑥! 자라나는 우리 영유치부",
    goals: [
      "하나님께서 성령으로 부흥하게 하심을 믿게한다.",
      "예수님의 성품을 배워 공동체가 하나 되며, 이웃을 섬긴다.",
      "성령의 인도하심을 경험하며 제자로서 성장한다.",
    ],
    organization: [
      { role: "지도교역자", name: "박가람 교육사" },
      { role: "위원장", name: "박영옥 권사" },
      { role: "부장", name: "최은옥 권사" },
      { role: "총무·회계", name: "이민영" },
      { role: "서기", name: "이서경" },
      { role: "교사", name: "종승연, 신경식, 고종인, 강다은" },
    ],
    prayers: [
      "성령의 감동으로 예배하는 어린이 되도록",
      "아이들 가정에 성령의 지혜와 인내를 부어주시도록",
      "성령의 능력으로 자라나는 부서가 되도록",
    ],
    galleryTag: "영유치부",
  },
  elementary: {
    title: "아동부",
    // ... (menucategory.md 데이터 그대로)
    galleryTag: "아동부",
  },
  teen: {
    title: "청소년부",
    // ... (menucategory.md 데이터 그대로)
    galleryTag: "청소년부",
  },
  youth: {
    title: "청년부",
    // ... (menucategory.md 데이터 그대로)
    galleryTag: "청년부",
  },
};
```

페이지 레이아웃: 갤러리 사진 → 기본정보(대상/시간/장소) → 표어·말씀 → 교육목표 → 조직 → 기도제목

갤러리 연동: `getGalleryAlbums({ tags: ["교회학교", dept.galleryTag], limit: 3 })` 호출하여 상단에 최대 6장 배치.

### Step 4-4: 교회학교 메인 부서명 변경

**수정 파일**: `src/app/(public)/churchschool/page.tsx`

"유아부" → "영유치부", "초등부" → "아동부"로 변경.

---

## Phase 5: 갤러리 하위부서 필터

### Step 5-1: GalleryGrid 2단계 필터

**수정 파일**: `src/components/gallery/GalleryGrid.tsx`

교회학교/봉사센터 카테고리 선택 시 하위부서 선택 버튼 추가:

```ts
const subCategories: Record<string, string[]> = {
  교회학교: ["전체", "영유치부", "아동부", "청소년부", "청년부"],
  봉사센터: ["전체", "반찬", "이미용", "비전문화", "탁구"],
};
```

1차 카테고리 변경 시 하위부서를 "전체"로 리셋.
필터링: `album.tags.includes(filter)` (1차) + `album.tags.includes(subFilter)` (2차).

### Step 5-2: admin/gallery 태그 입력

**수정 파일**: `src/app/admin/gallery/page.tsx`

카테고리 셀렉트 아래에 하위부서 선택 추가. 앨범 생성 시 `tags: [category, subCategory]` 저장.

```ts
const SUB_CATEGORIES: Record<string, string[]> = {
  교회학교: ["영유치부", "아동부", "청소년부", "청년부"],
  봉사센터: ["반찬", "이미용", "비전문화", "탁구"],
};
```

---

## Phase 6: 정리 및 리다이렉트

### Step 6-1: next.config.ts 리다이렉트

**수정 파일**: `next.config.ts`

```ts
async redirects() {
  return [
    // 기존 유지
    { source: "/post/:slug", destination: "/notice/:slug", permanent: true },
    { source: "/home-1", destination: "/", permanent: true },
    { source: "/members", destination: "/login", permanent: true },
    { source: "/teen", destination: "/churchschool/teen", permanent: true },
    { source: "/youth", destination: "/churchschool/youth", permanent: true },
    { source: "/infant", destination: "/churchschool/infant", permanent: true },
    { source: "/elementary", destination: "/churchschool/elementary", permanent: true },

    // ministry → volunteer-center
    { source: "/ministry", destination: "/volunteer-center", permanent: true },
    { source: "/ministry/:slug", destination: "/volunteer-center/:slug", permanent: true },
    { source: "/beauty", destination: "/volunteer-center/beauty", permanent: true },
    { source: "/tabletennis", destination: "/volunteer-center/tabletennis", permanent: true },
    { source: "/sidedish", destination: "/volunteer-center/sidedish", permanent: true },
    { source: "/culture", destination: "/volunteer-center/culture", permanent: true },
    { source: "/servers", destination: "/volunteer-center", permanent: true },

    // 통합
    { source: "/intro", destination: "/greetings", permanent: true },
    { source: "/timetable", destination: "/worship", permanent: true },

    // 기존 그룹
    { source: "/group/gongji/discussion/:id", destination: "/notice", permanent: true },
    { source: "/group/jubo/discussion/:id", destination: "/weekly", permanent: true },
  ];
},
```

### Step 6-2: 파일 삭제

리다이렉트 설정 후 삭제:

```
src/app/(public)/intro/page.tsx
src/app/(public)/timetable/page.tsx
src/app/(public)/ministry/page.tsx
src/app/(public)/ministry/[slug]/page.tsx
src/app/(public)/volunteer/page.tsx
```

> /groups, /profile은 메뉴에서만 제거. 코드는 유지 (로그인 기능).

### Step 6-3: QuickLinks 업데이트

**수정 파일**: `src/components/home/QuickLinks.tsx`

봉사센터 href: `/volunteer` → `/volunteer-center`

---

## 구현 순서 체크리스트

- [x] Phase 1: DB 마이그레이션 (tags 컬럼) + gallery lib + API
- [x] Phase 2: nav-config + Header + tab-config
- [x] Phase 3: /staff + /volunteer-center 페이지들
- [x] Phase 4: 인사말 + 예배안내 + 교회학교 부서 + 교회학교 메인
- [x] Phase 5: GalleryGrid 2단계 필터 + admin gallery 태그
- [x] Phase 6: 리다이렉트 + 파일 삭제 + QuickLinks
- [x] 검증: 빌드 성공 + 타입 체크 통과
