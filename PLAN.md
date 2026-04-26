# 로그인/로그아웃 버튼 구현 계획

## 진행 상태

- [x] PLAN 작성 (v2 — 모바일 햄버거 통합)
- [x] Step 1: `/api/me` Bearer 호환
- [x] Step 2: `useMe` auth 이벤트 구독
- [x] Step 3: `AuthButton` 컴포넌트 신규 (desktop + menu 변형)
- [x] Step 4: Header 통합 (PC: 인라인 / 모바일: 햄버거 안)
- [x] 최종 typecheck + lint
- [x] 문서 갱신 (API_SPEC.md / ARCHIT.md / DB_SCHEMA.md)
- [x] 커밋 + 푸시

---

## 목표

- **PC 헤더**: "관리자" 버튼 옆에 인증 토글 버튼 (로그인 ↔ 로그아웃)
- **모바일 헤더**: 우상단에는 IG + 햄버거만 둠. **관리자 + 로그인/로그아웃 모두 햄버거 메뉴 안으로 이동** — 320px 폭에서도 안전.
- 미인증 → "로그인" / 인증됨 → "로그아웃" 한 슬롯에 토글

## 설계 원칙

1. **모바일 앱 백엔드 호환** — 로그아웃은 클라이언트 SDK가 토큰을 폐기하는 행위이므로 백엔드 엔드포인트 추가 불필요. 모바일 앱은 자체 Supabase SDK로 동일하게 `signOut()` 호출. `/api/me`만 Bearer 토큰까지 받도록 표준 헬퍼(`createApiClient`)로 통일.
2. **Header 단일 책임 유지** — 인증 UI는 `AuthButton`으로 분리, Header는 슬롯에 끼워 넣기만.
3. **기존 자산 재사용** — `useMe()`, `MeResponse` 활용, 새 훅·새 엔드포인트 도입 없음.
4. **로그인/로그아웃 후 헤더 자동 반영** — Supabase `onAuthStateChange` 구독으로 `useMe`가 SIGN_IN/SIGN_OUT 이벤트마다 재조회 → 페이지 새로고침 없이 즉시 갱신.
5. **타입 엄격** — `any`/`unknown` 사용 금지.
6. **시키지 않은 것은 손대지 않음** — profile 페이지의 `LogoutButton`(풀폭 변형)은 그대로 유지.

---

## 변경 파일 목록

| 파일 | 작업 | 비고 |
|------|------|------|
| `src/app/api/me/route.ts` | **수정** | `createApiClient(request)` 사용 — Bearer 호환 |
| `src/lib/use-me.ts` | **수정** | `onAuthStateChange` 구독 추가 |
| `src/components/layout/AuthButton.tsx` | **신규** | `variant: "desktop" \| "menu"` 두 형태 |
| `src/components/layout/Header.tsx` | **수정** | PC 슬롯 삽입 + 모바일 우측에서 admin 제거 + 햄버거 메뉴 상단에 admin/auth 행 추가 |
| `API_SPEC.md` | **수정** | `/api/me` 응답 갱신 + Bearer 호환 명시 |
| `ARCHIT.md` | **수정** | 인증/세션 흐름 다이어그램 갱신 |
| `DB_SCHEMA.md` | **수정** | 변경 없음 (참고만) — 작업 완료 시점 표시 |

총 4파일 (신규 1, 수정 3) + 문서 3파일.

---

## Step 1: `/api/me` Bearer 호환

`createApiClient`로 교체 — 쿠키/Bearer 자동 분기.

```ts
// src/app/api/me/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { hasStaffAccess } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export interface MeResponse {
  authenticated: boolean;
  userId: string | null;
  role: string | null;
  isStaff: boolean;
  isAdminOrMaster: boolean;
}

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<MeResponse>(
      { authenticated: false, userId: null, role: null, isStaff: false, isAdminOrMaster: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  const role = profile?.role ?? null;
  return NextResponse.json<MeResponse>(
    {
      authenticated: true,
      userId: user.id,
      role,
      isStaff: hasStaffAccess(role),
      isAdminOrMaster: role === "admin" || role === "master",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

---

## Step 2: `useMe` auth 이벤트 구독

```ts
// src/lib/use-me.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MeResponse } from "@/app/api/me/route";

const EMPTY: MeResponse = {
  authenticated: false, userId: null, role: null,
  isStaff: false, isAdminOrMaster: false,
};

export function useMe(): MeResponse {
  const [me, setMe] = useState<MeResponse>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { credentials: "same-origin" });
      if (!r.ok) return;
      const data = (await r.json()) as MeResponse;
      setMe(data);
    } catch { /* network 실패 — EMPTY 유지 */ }
  }, []);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return me;
}

export function canDelete(me: MeResponse, authorId: string | null | undefined): boolean {
  if (me.isAdminOrMaster) return true;
  if (!me.userId) return false;
  return authorId === me.userId;
}
```

---

## Step 3: `AuthButton` 신규

두 변형:
- `variant="desktop"` — 헤더 우측 pill (gray 톤, "로그인"/"로그아웃")
- `variant="menu"` — 햄버거 메뉴 행 (full width, 좌측 아이콘 + 라벨)

```tsx
// src/components/layout/AuthButton.tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useMe } from "@/lib/use-me";
import { cn } from "@/lib/utils";

interface Props {
  variant: "desktop" | "menu";
  /** menu variant 에서 클릭 시 부모 메뉴를 닫기 위한 콜백 */
  onAction?: () => void;
}

export function AuthButton({ variant, onAction }: Props) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState<boolean>(false);

  const safeNext =
    pathname.startsWith("/admin") || pathname.startsWith("/auth")
      ? "/"
      : pathname;

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    onAction?.();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (variant === "desktop") {
    const cls =
      "flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200";
    if (!me.authenticated) {
      return (
        <Link href={`/login?next=${encodeURIComponent(safeNext)}`} className={cls} aria-label="로그인">
          <LogIn size={16} />로그인
        </Link>
      );
    }
    return (
      <button type="button" onClick={handleLogout} disabled={busy}
        className={cn(cls, "disabled:opacity-50")} aria-label="로그아웃">
        <LogOut size={16} />{busy ? "..." : "로그아웃"}
      </button>
    );
  }

  // variant === "menu" — 햄버거 행 스타일 (Header 의 nav 항목과 통일)
  const menuCls =
    "flex w-full items-center gap-2 py-3 text-[0.95rem] font-medium text-gray-800";
  if (!me.authenticated) {
    return (
      <Link href={`/login?next=${encodeURIComponent(safeNext)}`}
        onClick={onAction} className={menuCls}>
        <LogIn size={16} className="text-gray-500" />로그인
      </Link>
    );
  }
  return (
    <button type="button" onClick={handleLogout} disabled={busy}
      className={cn(menuCls, "disabled:opacity-50")}>
      <LogOut size={16} className="text-gray-500" />{busy ? "..." : "로그아웃"}
    </button>
  );
}
```

---

## Step 4: Header 통합

### PC — admin 옆에 `<AuthButton variant="desktop" />` 삽입

```tsx
{/* Desktop right: admin + auth + Instagram */}
<div className="hidden items-center gap-1 lg:flex">
  {isStaff && (
    <Link href="/admin" className="..."><Shield size={16} />관리자</Link>
  )}
  <AuthButton variant="desktop" />
  <a href="..." aria-label="Instagram"><InstagramIcon size={20} /></a>
</div>
```

### 모바일 우측 — admin pill 제거. IG + 햄버거만

```tsx
<div className="ml-auto flex items-center gap-1 lg:hidden">
  <a href="..." aria-label="Instagram"><InstagramIcon size={20} /></a>
  <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="...">
    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
  </button>
</div>
```

### 모바일 햄버거 메뉴 — 상단에 admin(staff면) + AuthButton 행 추가

```tsx
{mobileOpen && (
  <nav className="animate-slide-down border-t border-gray-100 bg-white px-4 pb-6 pt-4 lg:hidden">
    {/* 인증/관리자 영역 — 메뉴 최상단, divider 로 구분 */}
    <div className="mb-2 border-b border-gray-100 pb-2">
      {isStaff && (
        <Link href="/admin" onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-2 py-3 text-[0.95rem] font-medium text-primary-700">
          <Shield size={16} />관리자 페이지
        </Link>
      )}
      <AuthButton variant="menu" onAction={() => setMobileOpen(false)} />
    </div>

    {/* 기존 navItems 렌더 — 그대로 */}
    {navItems.map((item) => (...))}
  </nav>
)}
```

---

## 모바일 앱 호환성

| 엔드포인트 | 인증 방식 | 비고 |
|-----------|----------|------|
| `/api/me` | 쿠키 OR Bearer | 이번 PR로 Bearer 추가 |
| `/api/admin/*` 등 | 동일 | 이미 `createApiClient` 사용 중 |
| 로그인 | Supabase SDK 직접 | 백엔드 변경 무관 |
| 로그아웃 | Supabase SDK `signOut()` | 백엔드 변경 무관 |

**백엔드 변경 0건으로 모바일 앱 부착 가능.**

---

## 테스트 시나리오 (수동)

| # | 상태 | 액션 | 기대 |
|---|------|------|------|
| 1 | 로그아웃 | PC 헤더 첫 로드 | "로그인" 버튼 노출 (admin 옆) |
| 2 | 로그아웃 | 모바일 햄버거 열기 | 메뉴 최상단에 "로그인" 행 (관리자 행 없음) |
| 3 | 로그아웃 (member 로그인 후) | PC 헤더 즉시 확인 | "로그아웃" 으로 자동 전환 (`onAuthStateChange`) |
| 4 | staff/admin/master 로그인됨 | 모바일 햄버거 | 최상단에 "관리자 페이지" + "로그아웃" 두 행 |
| 5 | 로그아웃 클릭 (PC) | | `/`로 이동 + 즉시 "로그인"으로 토글 |
| 6 | 로그아웃 클릭 (모바일 햄버거) | | 메뉴 닫힘 + `/`로 이동 + 토글 |
| 7 | `/admin` 안에서 로그아웃 | | `safeNext` 폴백 → `/`로 안전 이동 |
| 8 | 다른 탭에서 로그아웃 | 현재 탭 헤더 | `onAuthStateChange` 로 자동 반영 |

---

## 명시적으로 안 하는 것

- 기존 `LogoutButton.tsx` (profile 페이지) 변경
- 비밀번호/이메일 로그인 (OAuth만 유지)
- 자동 로그아웃/세션 만료 토스트
- 로그아웃 확인 다이얼로그
