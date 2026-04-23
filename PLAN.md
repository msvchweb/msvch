# Google 로그인 구현 플랜 (웹 우선 · 모바일 호환)

> 기반 문서: [research.md](research.md)
> 작성일: 2026-04-23
> 범위: 웹 Google OAuth 도입. 다만 백엔드(API 라우트 + Supabase)는 **이 작업에서 모바일 호환까지 완성** — 추후 모바일 앱은 백엔드 수정 없이 같은 엔드포인트를 Bearer 토큰으로 호출 가능해야 한다.

---

## 0. 설계 원칙 — 왜 지금 모바일까지 신경 쓰는가

현재 API 라우트 인증은 쿠키 기반이다. 모바일 앱은 쿠키를 갖지 않으므로, 나중에 기능 추가마다 API를 손봐야 한다. 이번 작업에서 **한 번만 일반화**해두면 모바일 쪽은 Supabase SDK + `Authorization: Bearer` 헤더만 쓰면 끝난다.

**범용화 핵심 3요소**
1. Supabase Auth가 이미 웹/모바일 공용(JWT 기반) — 추가 인증 서버 불필요
2. 서버측 API 라우트 인증: **Bearer 헤더 우선, 쿠키 폴백** 단일 헬퍼로 통합
3. Google OAuth Client ID는 **웹 / iOS / Android 별도 발급** + Supabase Provider 구성에 쉼표로 추가 (백엔드 코드 무관)

즉, 이 작업을 마치면 모바일 앱 개발 시 백엔드에 단 한 줄도 추가할 필요가 없다.

---

## 1. 아키텍처 요약

```
┌───────────────────────────────────────────────────────────────┐
│  Google OAuth Providers (GCP Console)                         │
│  ├── Web Client ID      → Supabase에 등록 (이번 작업)          │
│  ├── Android Client ID  → 모바일 개발 시 Supabase에 추가       │
│  └── iOS Client ID      → 모바일 개발 시 Supabase에 추가       │
└───────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│  Supabase Auth  (JWT 발급 — 웹/모바일 공용)                    │
│  └── auth.users → trigger → public.profiles                   │
└───────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
    [Web Browser]                      [Mobile App]
    쿠키 세션                            Bearer 토큰
    - signInWithOAuth (redirect)        - signInWithIdToken (네이티브)
    - /auth/callback → cookie           - 토큰 직접 소유
                          │
                          ▼
          ┌───────────────────────────────┐
          │  /api/* (Next.js)             │
          │  createApiClient(request) —   │
          │  Bearer 있으면 Bearer,         │
          │  없으면 쿠키                   │
          └───────────────────────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │  Supabase RLS (auth.uid())    │
          │  — 어느 경로든 동일 작동        │
          └───────────────────────────────┘
```

---

## 2. 변경 파일 매트릭스

| # | 파일 | 상태 | 목적 |
|---|---|---|---|
| 1 | `supabase/migrations/014_profiles_oauth_fields.sql` | 신규 | email, avatar_url 컬럼 + 트리거 교체 |
| 2 | `src/types/supabase.ts` | 수정 | Profile 인터페이스에 email, avatar_url 추가 |
| 3 | `src/lib/supabase/api.ts` | 신규 | **API 라우트용 공용 클라이언트(Bearer/쿠키 이중지원)** |
| 4 | `src/lib/admin-auth.ts` | 수정 | requireAdmin(request?) 로 시그니처 확장 |
| 5 | `src/app/auth/callback/route.ts` | 신규 | 웹 OAuth 콜백 (code → session) |
| 6 | `src/components/icons/GoogleGIcon.tsx` | 신규 | Google G 브랜드 로고 |
| 7 | `src/app/(auth)/login/page.tsx` | 리라이트 | Google 버튼 단일화 + next/error 쿼리 |
| 8 | `src/app/(auth)/signup/page.tsx` | 삭제 | 이메일 회원가입 경로 제거 |
| 9 | `src/middleware.ts` | 수정 | 보호 경로 리디렉트 시 ?next= 전달 |
| 10 | `next.config.ts` | 수정 | CSP connect-src / img-src 확장 |
| 11 | `src/app/(member)/profile/page.tsx` | 수정(선택) | 아바타 + 이메일 표시 |
| 12 | 기존 API 라우트 12개 | 수정 | requireAdmin/인라인 auth → createApiClient(request) 경유 |

---

## 3. Phase A — 외부 설정 (사용자 수동 작업)

### A-1. Google Cloud Console — 웹 Client ID 발급

1. GCP Console → `msvch-493108` 프로젝트(이미 존재) → APIs & Services → Credentials
2. **CREATE CREDENTIALS → OAuth client ID**
3. Application type: **Web application**
4. Name: `msvch-web`
5. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://msvch.vercel.app`
6. Authorized redirect URIs:
   - `https://prqebmdejdvbtkhabtfy.supabase.co/auth/v1/callback`
   - (로컬은 Supabase 콜백을 거치므로 `http://localhost` 추가 불필요)
7. 생성 후 **Client ID / Client Secret 기록**

**OAuth consent screen**(최초 1회):
- User Type: External
- App name: `명성비전교회`
- User support email: (교회 담당자 이메일)
- Authorized domains: `vercel.app`, `supabase.co`
- Scopes: 기본 `openid`, `userinfo.email`, `userinfo.profile` — 추가 스코프 없음(verification 불필요)

### A-2. Supabase — Google Provider 활성화

Dashboard → Authentication → Providers → Google:
- Enable: **on**
- Client IDs: A-1 Client ID (추후 iOS/Android Client ID는 **쉼표로 덧붙이기만 하면 됨** — 코드 변경 없음)
- Client Secret: A-1 Secret
- Skip nonce check: off (기본)

### A-3. Supabase — URL Configuration

Dashboard → Authentication → URL Configuration:
- Site URL: `https://msvch.vercel.app`
- Redirect URLs (allow-list):
  - `https://msvch.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

### A-4. 기존 테스트 계정 삭제

Dashboard → Authentication → Users → 본인 테스트 계정 선택 → Delete user.
`profiles` 행도 `ON DELETE CASCADE` 로 자동 정리됨.

---

## 4. Phase B — 백엔드 범용화 (핵심)

### B-1. 신규: `src/lib/supabase/api.ts`

API 라우트 전용 Supabase 클라이언트 팩토리. Bearer 헤더 우선, 쿠키 폴백.

```ts
// src/lib/supabase/api.ts
import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * API 라우트용 Supabase 클라이언트.
 *
 * - 요청에 `Authorization: Bearer <access_token>` 헤더가 있으면 그 토큰을 사용 (모바일 앱).
 * - 없으면 쿠키 기반 세션 (웹 브라우저).
 *
 * 두 경로 모두 auth.uid() 와 RLS 가 동일하게 동작하므로,
 * 이후 모바일 앱이 생겨도 API 라우트 수정이 필요 없다.
 */
export async function createApiClient(
  request?: NextRequest,
): Promise<SupabaseClient> {
  const authHeader = request?.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    return createBareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component boundary — 쿠키 쓰기 실패 무시
          }
        },
      },
    },
  );
}
```

### B-2. 수정: `src/lib/admin-auth.ts`

`requireAdmin`이 선택적 `request`를 받도록 확장. 기존 호출부(인자 없이)도 그대로 동작.

```ts
// src/lib/admin-auth.ts (교체)
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";

interface AdminAuthResult {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * API 라우트에서 admin 인증을 검증한다.
 * request 를 넘기면 Bearer 헤더 기반 인증도 지원(모바일 앱 호환).
 * 실패 시 AuthError 를 throw 한다.
 */
export async function requireAdmin(
  request?: NextRequest,
): Promise<AdminAuthResult> {
  const supabase = await createApiClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("로그인이 필요합니다.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profile?.role !== "admin") {
    throw new AuthError("관리자 권한이 필요합니다.", 403);
  }

  return { supabase, userId: user.id };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
```

### B-3. 기존 API 라우트 업데이트 — request 전달

**`requireAdmin`을 쓰는 5개 파일**은 인자 1개만 추가:

```diff
// src/app/api/calendar/route.ts
- export async function POST(request: NextRequest) {
+ export async function POST(request: NextRequest) {
    try {
-     await requireAdmin();
+     await requireAdmin(request);
```

동일 패턴을 적용할 파일:
- `src/app/api/calendar/route.ts` (POST)
- `src/app/api/calendar/[id]/route.ts` (DELETE)
- `src/app/api/shorts/[id]/approve/route.ts` (POST) — `_request` 를 `request` 로 바꾸고 전달
- `src/app/api/shorts/[id]/reject/route.ts` (POST) — 동
- `src/app/api/shorts/trigger/route.ts` (POST) — 동

**인라인 인증을 쓰는 2개 파일**은 `createApiClient(request)` 로 교체:

```ts
// src/app/api/weeklies/generate-pdf/route.ts — 교체
import { createApiClient } from "@/lib/supabase/api";

export async function POST(req: NextRequest) {
-  const supabase = await createClient();
+  const supabase = await createApiClient(req);

   const { data: { user } } = await supabase.auth.getUser();
   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   // ... 이하 동일
}
```

```ts
// src/app/api/sermon-summary/route.ts — 상단 createServerClient 블록을 대체
import { createApiClient } from "@/lib/supabase/api";

export async function POST(request: NextRequest) {
-  const cookieStore = await cookies();
-  const supabase = createServerClient(...) // 16줄 블록 삭제
+  const supabase = await createApiClient(request);
   // ... 이하 동일
}
```

```ts
// src/app/api/shorts/route.ts — GET 내부
-  const supabase = await createClient();
+  const supabase = await createApiClient(req);
```

**건드리지 않는 API 라우트**(서비스 롤 키를 쓰거나 공개 엔드포인트):
- `src/app/api/chat/inquiry/route.ts` — 서비스 롤 키로 익명 삽입 (유지)
- `src/app/api/chat/route.ts` — 서비스 롤 키 (유지)
- `src/app/api/new-content/route.ts` — 공개 읽기(쿠키 세션도 불필요) — `createClient()` 유지
- `src/app/api/gallery/[id]/images/route.ts` — 확인 후 유지/변경
- `src/app/api/revalidate/route.ts` — secret 검증만

### B-4. `src/lib/supabase/server.ts` — 건드리지 않음

서버 컴포넌트(App Router의 페이지)에서 쓰는 `createClient()`는 그대로. 페이지는 쿠키 외 인증 경로가 없기 때문.

---

## 5. Phase C — DB 마이그레이션

### C-1. 신규: `supabase/migrations/014_profiles_oauth_fields.sql`

```sql
-- 014: profiles 테이블에 이메일/아바타 컬럼 + handle_new_user 트리거 보강
--
-- 목적:
--   1. Google OAuth 로 들어오는 사용자의 프로필 정보(이메일, 아바타) 저장
--   2. 트리거가 Google 메타데이터(full_name, picture) 와 기존 이메일 가입의 name 모두 처리
--   3. 기존 사용자(email 가입)의 email 컬럼 백필

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 기존 사용자 이메일 백필 (auth.users.email 에서 복사)
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id AND p.email IS NULL;

-- 트리거 함수 교체: Google OAuth / 이메일 가입 둘 다 커버
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      ''
    ),
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 자체(on_auth_user_created)는 재생성 불필요 — 함수만 교체하면 됨.
```

### C-2. 적용 방법

Supabase Dashboard → SQL Editor → 위 SQL 실행.
회원 1명도 이미 삭제됐으므로 백필 UPDATE는 no-op.

### C-3. TypeScript 타입 동기화

```ts
// src/types/supabase.ts (교체)
export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "member" | "admin";
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: { name: string };
}
```

---

## 6. Phase D — 인증 UI

### D-1. 신규: `src/app/auth/callback/route.ts`

```ts
// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth 리디렉트 콜백 (웹 전용).
 *
 * 흐름:
 *   1. Supabase 가 ?code=... 를 붙여 이 URL 로 리디렉트
 *   2. exchangeCodeForSession 으로 쿠키 세션 설정
 *   3. ?next 로 복귀, 실패 시 /login?error=oauth
 *
 * 모바일 앱은 이 라우트를 쓰지 않음 — 네이티브 SDK 로 직접 세션 획득.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";

  // open redirect 방지: 자체 도메인 내부 경로만 허용
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth code exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

### D-2. 신규: `src/components/icons/GoogleGIcon.tsx`

Google 브랜드 가이드에 맞는 SVG G 로고 (공식 색상 4개).

```tsx
// src/components/icons/GoogleGIcon.tsx
export function GoogleGIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
```

### D-3. 리라이트: `src/app/(auth)/login/page.tsx`

현재 108줄. Google 버튼 단일 페이지로 축소.

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleGIcon } from "@/components/icons/GoogleGIcon";

function LoginInner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const supabase = createClient();

  // 미들웨어에서 리디렉트된 원래 경로
  const rawNext = searchParams.get("next") ?? "/";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const initialError =
    searchParams.get("error") === "oauth"
      ? "Google 로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
      : "";

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError("Google 로그인을 시작하지 못했습니다.");
      setLoading(false);
    }
    // 성공 시 브라우저가 accounts.google.com 으로 이동하므로 여기서 중단.
  }

  const displayError = error || initialError;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-xl font-bold text-white shadow-lg shadow-primary-500/20">
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
          <p className="mt-1 text-sm text-gray-500">
            명성비전교회에 오신 것을 환영합니다
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-50"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          ) : (
            <>
              <GoogleGIcon size={20} />
              Google 계정으로 계속하기
            </>
          )}
        </button>

        {displayError && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {displayError}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          로그인하면 이용약관 및 개인정보처리방침에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams 사용 컴포넌트는 Suspense 경계 필요
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
```

### D-4. 삭제: `src/app/(auth)/signup/page.tsx`

파일과 함께 `(auth)/signup/` 디렉토리 전체 제거.

```bash
rm -r src/app/\(auth\)/signup
```

`next.config.ts`의 기존 리디렉트(`/members → /login`, 54행)는 그대로 유지. `/signup`으로 오는 요청은 Next가 404를 내면 충분 — 외부에서 이 경로를 참조하는 곳이 없으므로 별도 리디렉트 불필요.

### D-5. 수정(선택): `src/app/(member)/profile/page.tsx`

프로필에 아바타와 이메일 표시. Google 로그인 후 자연스럽게 확인 가능한 UI.

```tsx
// src/app/(member)/profile/page.tsx — diff
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  return (
    <>
      <PageHeader title="내 프로필" />
      <Container>
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8">
+         {profile?.avatar_url && (
+           // 외부 이미지는 Next Image 도메인 설정 필요 — 일단 <img>
+           // eslint-disable-next-line @next/next/no-img-element
+           <img
+             src={profile.avatar_url}
+             alt=""
+             className="mx-auto mb-4 h-20 w-20 rounded-full border border-gray-100"
+           />
+         )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">이름</label>
              <p className="mt-1 text-gray-900">
                {profile?.name || "미설정"}
              </p>
            </div>
```

---

## 7. Phase E — 미들웨어 & CSP

### E-1. 수정: `src/middleware.ts`

보호 경로 리디렉트 시 `?next=` 추가. 로그인 후 원래 경로로 복귀.

```ts
// src/middleware.ts (교체)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function loginRedirect(request: NextRequest) {
  const url = new URL("/login", request.url);
  const current = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("next", current);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (path.startsWith("/groups") && !user) return loginRedirect(request);
  if (path.startsWith("/profile") && !user) return loginRedirect(request);

  if (path.startsWith("/admin")) {
    if (!user) return loginRedirect(request);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if ((profile as { role?: string } | null)?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/groups/:path*", "/admin/:path*", "/profile/:path*"],
};
```

### E-2. 수정: `next.config.ts`

CSP의 `connect-src`에 `accounts.google.com`, `img-src`에 `lh3.googleusercontent.com` 추가.

```ts
// next.config.ts — headers() 내부 CSP 문자열 diff
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
-             "img-src 'self' https://*.ytimg.com https://*.supabase.co data: blob:",
+             "img-src 'self' https://*.ytimg.com https://*.supabase.co https://lh3.googleusercontent.com data: blob:",
              "media-src 'self' https://*.supabase.co",
              "frame-src https://www.youtube.com https://www.google.com",
-             "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
+             "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com",
              "font-src 'self'",
            ].join("; "),
```

**주의**: `img-src`에 Google 아바타 호스트를 추가하는 것은 `<img>` 태그 기준. `next/image`를 쓰려면 `next.config.ts`의 `images.remotePatterns`에도 추가해야 함(현재 avatar는 `<img>`로 갈 거라 생략 가능).

---

## 8. Phase F — 모바일 연동 시 사용 예시 (참고, 구현 아님)

모바일 앱을 붙일 때 **백엔드는 건드리지 않는다**. 예시:

### F-1. React Native 예시 (미래)

```ts
// mobile: signIn.ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { createClient } from "@supabase/supabase-js";

GoogleSignin.configure({
  iosClientId: "<iOS Client ID>",    // GCP 에서 추가 발급
  webClientId: "<Web Client ID>",    // Supabase 에 등록된 것과 동일
});

const supabase = createClient(SUPABASE_URL, ANON_KEY);

export async function signInWithGoogle() {
  const { idToken } = await GoogleSignin.signIn();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken!,
  });
  // data.session.access_token 이 이후 API 호출의 Bearer 토큰
  return { session: data.session, error };
}
```

### F-2. API 호출 예시

```ts
// mobile: apiClient.ts
export async function generatePdf(weeklyId: string) {
  const session = await supabase.auth.getSession();
  const res = await fetch("https://msvch.vercel.app/api/weeklies/generate-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.data.session!.access_token}`,
    },
    body: JSON.stringify({ weeklyId }),
  });
  return res.json();
}
```

→ 웹 구현한 API 라우트가 Bearer를 이미 이해하므로(Phase B), 백엔드 추가 작업 불필요.

### F-3. 모바일용 Supabase 설정 (그때 가서)

- GCP에 iOS/Android OAuth Client ID 추가 발급
- Supabase Dashboard → Google Provider → Client IDs 필드에 `<web>,<ios>,<android>` 쉼표 연결
- 코드 변경 없음

---

## 9. 실행 순서 체크리스트

**Phase A — 외부 설정 (수동, 선행)**
- [ ] A-1. GCP에 웹 OAuth Client ID 발급 + consent screen 기본 정보
- [ ] A-2. Supabase Google Provider 활성화 (Client ID/Secret 붙여넣기)
- [ ] A-3. Supabase Redirect URLs 추가 (localhost + prod)
- [ ] A-4. Supabase Auth → Users에서 테스트 계정 삭제

**Phase C — DB (B 이전, 순서 중요)**
- [ ] C-1. Supabase SQL Editor 에서 `014_profiles_oauth_fields.sql` 실행
- [ ] C-2. 파일로도 `supabase/migrations/014_profiles_oauth_fields.sql` 커밋

**Phase B — 백엔드 범용화**
- [ ] B-1. `src/lib/supabase/api.ts` 생성
- [ ] B-2. `src/lib/admin-auth.ts` 교체
- [ ] B-3a. `src/types/supabase.ts` Profile 확장
- [ ] B-3b. 5개 `requireAdmin` 호출 파일에 `request` 인자 추가
- [ ] B-3c. `generate-pdf/route.ts`, `sermon-summary/route.ts`, `shorts/route.ts` 에서 `createApiClient(request)` 사용

**Phase D — 인증 UI**
- [ ] D-1. `src/app/auth/callback/route.ts` 생성
- [ ] D-2. `src/components/icons/GoogleGIcon.tsx` 생성
- [ ] D-3. `src/app/(auth)/login/page.tsx` 리라이트
- [ ] D-4. `src/app/(auth)/signup/` 디렉토리 삭제
- [ ] D-5. (선택) `src/app/(member)/profile/page.tsx` 아바타/이메일 표시

**Phase E — 경로 + CSP**
- [ ] E-1. `src/middleware.ts` `?next=` 로직 추가
- [ ] E-2. `next.config.ts` CSP connect-src / img-src 확장

**Phase G — 검증 및 승격**
- [ ] G-1. `npm run typecheck` 통과
- [ ] G-2. `npm run lint` 통과
- [ ] G-3. `npm run build` 통과
- [ ] G-4. `npm run dev` → localhost 로그인 전체 흐름 테스트(§10)
- [ ] G-5. main 푸시 → Vercel 자동 배포 → 프로덕션 확인
- [ ] G-6. 본인 Gmail 로 첫 로그인 → Supabase SQL Editor 에서:
      `UPDATE public.profiles SET role='admin' WHERE email='<본인 gmail>';`
- [ ] G-7. `/admin` 접근 테스트, `/admin/weeklies` 에서 PDF 생성 등 관리 작업 정상 확인

---

## 10. 테스트 시나리오

### 10-1. 정상 흐름

1. `/login` 접속 → "Google 계정으로 계속하기" 클릭
2. Google 동의 화면 → 승인
3. `/auth/callback?code=...&next=/` 로 복귀 (← 실제로는 301ms 내 자동)
4. `/` 로 이동, 세션 쿠키 확인 (DevTools → Application → Cookies → `sb-*-auth-token`)
5. `/profile` 접속 → 이름/이메일/아바타 표시

### 10-2. 보호 경로 복귀

1. 로그아웃 상태에서 `/profile` 직접 접속
2. `/login?next=%2Fprofile` 로 리디렉트 확인
3. Google 로그인 완료 후 `/profile`로 복귀 확인

### 10-3. Admin 승격

1. G-6 SQL 실행
2. 쿠키는 그대로 유지되지만 role 은 서버에서 재조회(매 요청 `middleware.ts`에서 fetch)되므로 별도 로그아웃 불필요
3. `/admin` 접근 → 대시보드 표시
4. `/admin/weeklies` → 임의 주보 선택 → PDF 생성 버튼 동작 확인 (`requireAdmin` 가 쿠키 경로로 admin 판정)

### 10-4. 모바일 경로(향후) — 수동 curl 테스트로 지금 검증 가능

본인 access token 을 Supabase Dashboard → Users → 본인 선택 → `Copy JWT` (또는 브라우저 DevTools의 `sb-*-auth-token` 쿠키에서 `access_token` JSON 값):

```bash
TOKEN="<access_token>"
curl -X GET https://msvch.vercel.app/api/shorts \
  -H "Authorization: Bearer $TOKEN"
# → 200 + JSON (admin 이면 전체, 아니면 published 만)
```

쿠키 없이도 정상 응답이면 B 단계 구현이 모바일 호환으로 올바르게 된 것.

### 10-5. 보안 케이스

- `?next=//evil.com` 시 `/auth/callback` 이 `/` 로 폴백
- `?next=javascript:alert(1)` 도 startsWith("/") 체크에서 거절
- 잘못된 code 로 콜백 → `/login?error=oauth` 안내
- 로그아웃 후 `sb-*-auth-token` 쿠키 삭제 확인 + 보호 경로 재접근 시 로그인 페이지로 이동

---

## 11. 위험 요소 & 대응

| # | 위험 | 대응 |
|---|---|---|
| 1 | 마이그레이션 C를 B보다 나중에 실행 → 첫 로그인 시 트리거가 옛 스키마로 실패 | **C 먼저 실행** (체크리스트 순서 엄수) |
| 2 | 기존 API 라우트 12개 중 Bearer 미대응 라우트에서 모바일 401 | 표의 "수정" 행이 모두 완료됐는지 G-1 타입체크로 2차 확인 |
| 3 | GCP Redirect URI 오타 → `redirect_uri_mismatch` | Supabase Provider 화면의 Callback URL을 그대로 복사 붙여넣기 (직접 타이핑 금지) |
| 4 | CSP connect-src 누락으로 signInWithOAuth 실패 | E-2 diff 재확인, DevTools Console의 CSP 경고 모니터링 |
| 5 | admin 승격 후 쿠키 재발급 미발생으로 RLS가 여전히 member로 판단 | `middleware.ts` 가 매 요청마다 DB role 조회 → 재로그인 불필요. 만약 불안하면 로그아웃→재로그인 |
| 6 | `next/link` 로 `/signup` 을 참조하는 코드 잔존 | D-4 후 `grep -r "/signup"` 으로 확인 |
| 7 | `useSearchParams` 를 Suspense 없이 써서 build 실패 | D-3 예시대로 `<Suspense>` 로 감싸기 |
| 8 | 프로덕션에서 쿠키가 `Secure` 로 동작하지 않음 (http로 접근 시) | Vercel은 항상 https → 문제 없음. 로컬은 `http://localhost` 로 Supabase 가 자동으로 Secure 제외 |
| 9 | 기존 `createClient()` 호출부가 `create*Client` 와 헷갈림 | `src/lib/supabase/api.ts` 는 **API 라우트용**, `server.ts` 는 **서버 컴포넌트용**. 역할 분리 명확 |

---

## 12. 이후 선택 사항 (본 PLAN 범위 외)

- Header 로그인 상태 표시 (비회원에게 로그인 유도) — 요구하면 별도 PLAN
- 프로필 편집 기능 (이름/전화번호 업데이트) — 현재 이름은 Google이 주는 그대로
- One Tap 자동 로그인 — CSP script-src 확장 필요, 필요 시 별도 검토
- `profiles.email` 의 public SELECT 정책 축소 — 현재 전체 조회 가능, 공개 범위 재설계 요함
