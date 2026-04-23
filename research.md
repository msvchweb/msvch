# Google 로그인 도입 — 리서치 보고서 (웹 전용)

> 작성일: 2026-04-23
> 범위: 웹사이트만. 모바일 앱은 이후 별도 설계.
> 전제: Supabase Auth 기반(@supabase/ssr 0.10) + Next.js 16.2.2 App Router 유지.

---

## 0. TL;DR

1. 현재 인증은 **Supabase 이메일/비밀번호**만 사용하며, OAuth 콜백 라우트·Google 코드·헤더 로그인 UI는 전무. [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx), [src/app/(auth)/signup/page.tsx](src/app/(auth)/signup/page.tsx) 두 개가 전부.
2. 도입 전략으로 **`signInWithOAuth` + PKCE + 서버 콜백 라우트** 패턴(Supabase 공식 Next.js 가이드)이 가장 안전하고 변경폭이 작다.
3. 건드려야 하는 곳은 정확히 5군데: (A) Supabase 대시보드 Provider, (B) Google Cloud OAuth Client, (C) 새 라우트 `src/app/auth/callback/route.ts`, (D) 기존 login 페이지에 "Google로 계속" 버튼 추가, (E) `handle_new_user` 트리거가 Google 메타데이터를 이해하도록 수정(새 마이그레이션).
4. 부가 변경: `next.config.ts` CSP의 `connect-src`에 `https://accounts.google.com`만 추가하면 충분(리디렉트 방식이어서 script/frame 확장은 **불필요**).
5. **현 회원 상황: 테스트 계정 1개뿐** → 기존 계정 충돌 고민 불필요. 테스트 계정 삭제 후 Google로 재가입 + admin 승격이 가장 단순.
6. **권고 방침: Google OAuth만 남기고 이메일/비번 경로는 제거**. 회원이 0명이므로 유지 비용 > 효용. `/signup` 페이지 삭제, `/login`은 "Google로 계속하기" 단일 버튼으로 단순화.

---

## 1. 현재 인증 아키텍처 — 있는 그대로 (실측)

### 1-1. 클라이언트/서버 공급자

| 파일 | 역할 |
|---|---|
| [src/lib/supabase/client.ts](src/lib/supabase/client.ts) | `createBrowserClient()` — 브라우저용, 쿠키 자동 |
| [src/lib/supabase/server.ts](src/lib/supabase/server.ts) | `createServerClient()` — Next 서버 컴포넌트/라우트에서 사용 |
| [src/lib/admin-auth.ts](src/lib/admin-auth.ts) | API 라우트 전용 `requireAdmin()` — user → profiles.role=='admin' 검증 |
| [src/middleware.ts](src/middleware.ts) | 경로 보호. matcher: `/groups/:path*`, `/admin/:path*`, `/profile/:path*` |

`@supabase/ssr@0.10`의 기본 `flowType`은 **PKCE**다. 즉 OAuth 처리 시 `sb-<project>-auth-token-code-verifier` 쿠키가 자동 세팅·소비된다. 별도 설정 필요 없음.

### 1-2. 인증 경로

- [src/app/(auth)/login/page.tsx:22](src/app/(auth)/login/page.tsx:22) — `supabase.auth.signInWithPassword({ email, password })`, 실패 시 한국어 에러, 성공 시 `router.push("/")` + `router.refresh()`.
- [src/app/(auth)/signup/page.tsx:29](src/app/(auth)/signup/page.tsx:29) — `supabase.auth.signUp({ email, password, options: { data: { name } } })`, 성공 시 `/login?registered=true`.
- `?registered=true` 쿼리는 **login 페이지에서 아무것도 하지 않음**(읽지도 않음). 죽은 UX 플래그.
- [src/components/LogoutButton.tsx](src/components/LogoutButton.tsx) — `auth.signOut()` 후 `/`로 push + refresh. 현재 `/profile`에만 배치.

### 1-3. 미들웨어 동작

```ts
// src/middleware.ts
await supabase.auth.getUser()
if /groups/* && !user → redirect /login
if /profile/* && !user → redirect /login
if /admin/*:
  !user → redirect /login
  profile.role !== 'admin' → redirect /
```

- **현재 로그인 성공 후 "원래 가려던 곳"으로 돌아가는 로직 없음**. 리디렉트 시 `?next=...`를 붙이지 않는다.
- 미들웨어 matcher에 `/auth/callback`이 포함되지 않으므로 새 콜백 라우트는 자동으로 비보호(= OAuth 리디렉트가 미들웨어에 걸려 `/login`으로 튕기는 사고는 없음).

### 1-4. DB 스키마(인증 관련)

[supabase/migrations/001_initial.sql:1-30](supabase/migrations/001_initial.sql:1):

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  phone text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz default now()
);

-- Auto-create on signup
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
```

**주목할 점**:
- `raw_user_meta_data->>'name'` — 이메일 회원가입은 `signUp({options:{data:{name}}})`로 주입, **Google OAuth는 대신 `full_name`, `name`, `picture`, `avatar_url`, `email`, `sub` 등을 `raw_user_meta_data`에 자동 저장**. 현재 트리거는 Google의 `name`은 잡을 수 있지만 `full_name` 폴백이 없고, 이메일·아바타 저장 경로도 없음.
- `role`은 기본 `'member'`. Google 신규 가입자가 자동으로 admin이 되는 일은 없음(안심).

### 1-5. RLS에서 role 사용처 (admin 정의)

[supabase/migrations](supabase/migrations) 전반:

- `notices`, `weeklies`, `gallery_*`, `shorts_*`, `chat_inquiries`, `church_settings`, `mokjang_entries`, `servants`, `support_sections`, `community_prayers` → **15곳 이상**이 `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` 패턴으로 admin을 판별.
- 결론: **Google 로그인으로 들어오는 auth.uid()도 이 RLS 체인에 그대로 걸린다**(별도 수정 불필요). Google 신규 유저가 admin이 되려면 여전히 누군가 수동으로 `update profiles set role='admin' where id=...`를 실행해야 한다.

### 1-6. 현재 UI의 로그인 진입점

- [src/components/layout/Header.tsx](src/components/layout/Header.tsx) — **로그인/로그아웃 버튼 없음**. 비로그인 시 사용자가 로그인 페이지로 가는 유일한 방법은:
  1. 직접 `/login` URL 입력
  2. `/groups`, `/profile`, `/admin` 방문 시 미들웨어 리디렉트
- [src/app/(public)/menu/MenuContent.tsx](src/app/(public)/menu/MenuContent.tsx) — 모바일 "더보기"에도 로그인 링크 없음.
- 즉 현재 사이트는 "멤버 로그인 기능은 있지만 일반 방문자는 있는지도 모르는" 상태.

### 1-7. CSP (`next.config.ts`)

```
connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com
frame-src https://www.youtube.com https://www.google.com
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

- Google OAuth **리디렉트 방식**(브라우저 전체가 accounts.google.com으로 이동)에서는 `connect-src`만 관련. 현재 허용 목록에 `accounts.google.com` 없음 → **필요시 추가**(상세는 §4-3).
- One Tap(JS로 Google이 embed되는 prompt) 채택 시에만 `script-src https://accounts.google.com`, `frame-src https://accounts.google.com` 추가 필요. 본 보고서는 One Tap 미도입을 전제.

---

## 2. Google OAuth 통합 — 전체 흐름

```
[Browser]                 [Our App]                [Supabase]           [Google]
  │                          │                        │                    │
  │ ── 1. click "Google" ──▶ │                        │                    │
  │ ◀── 2. signInWithOAuth   │                        │                    │
  │    sets PKCE verifier    │                        │                    │
  │    (cookie on our domain)│                        │                    │
  │                                                                        │
  │ ── 3. navigate to ──────────────────────────────▶ accounts.google.com  │
  │                                                     (사용자 동의)        │
  │                                                                        │
  │ ◀── 4. redirect + code ───────────────────────────                     │
  │                                                                        │
  │ ── 5. GET https://<proj>.supabase.co/auth/v1/callback?code=... ─▶       │
  │                                            Supabase: code→session       │
  │ ◀── 6. 302 to app's redirectTo ─────────────────                       │
  │                                                                        │
  │ ── 7. GET /auth/callback?code=XXX&next=/profile ─▶ [Our Callback]      │
  │                                                        │                │
  │                                       exchangeCodeForSession(code)     │
  │                                               → reads PKCE verifier    │
  │                                               → writes sb-*-auth-token │
  │                                                 cookies (HttpOnly)     │
  │ ◀── 8. 302 to /profile (or next) ──────────────────                    │
  │                                                                        │
  │ ── 9. GET /profile (middleware refreshes session) ─▶                   │
  │                                                                        │
```

**핵심 포인트**
- Google ↔ Supabase 구간은 자동(Supabase가 처리). 우리는 **2번(클릭)** 과 **7~8번(콜백 교환 후 최종 경로 결정)** 만 책임.
- 4번에서 Google이 리디렉트하는 대상은 **Supabase callback URL**(`https://<project>.supabase.co/auth/v1/callback`). Google Cloud Console의 "Authorized redirect URI"에 이 값을 넣는다. 우리 도메인을 넣는 게 **아님**. 이건 많이 헷갈리는 지점.
- 6번에서 Supabase가 다시 우리 도메인으로 보내는 대상은 `signInWithOAuth({options:{redirectTo}})`에 넘긴 URL. 이 URL은 Supabase 대시보드 "Redirect URLs" allow-list에 등록돼 있어야 한다.

---

## 3. 바깥(외부 서비스) 설정

### 3-1. Google Cloud Console — OAuth 2.0 Client ID 생성

현재 프로젝트에는 이미 `msvch-493108` GCP 프로젝트가 있음(env: `GOOGLE_SA_CLIENT_EMAIL=msvchweb@msvch-493108.iam.gserviceaccount.com`). **같은 프로젝트에 OAuth Client를 추가**하면 된다(서비스 계정과 별도 리소스).

단계:
1. APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `msvch-web-auth` 등 식별 가능한 이름
4. Authorized JavaScript origins:
   - `https://msvch.vercel.app`
   - `http://localhost:3000`
   - (Vercel Preview URL은 건건이 추가하기 어려움 — §6 참고)
5. Authorized redirect URIs:
   - `https://prqebmdejdvbtkhabtfy.supabase.co/auth/v1/callback` (env의 Supabase URL + `/auth/v1/callback`)
   - **우리 도메인 URL을 여기에 넣지 않는다**. Google → Supabase로만 보낸다.
6. OAuth 동의 화면(OAuth consent screen)도 한 번 설정:
   - User type: `External`(Gmail이 있는 누구나 로그인 가능)
   - App name: `명성비전교회`
   - User support email, developer contact
   - Authorized domains: `vercel.app`, `supabase.co`(또는 직접 도메인이 있으면 그것)
   - Scopes: 기본값 `openid email profile`로 충분 (`userinfo.email`, `userinfo.profile`)
   - **Publishing status**: 외부 공개 후에도 **Testing** 모드면 100명 제한 + 7일 후 만료. 실제 운영엔 **Production** 승인 필요(단, 승인 없이도 기본 스코프만 쓰면 제출 면제 가능한 경우가 많음 — 현 스코프는 `email profile openid`라 **verification 불필요**).
7. 발급되는 Client ID와 Client Secret을 메모.

### 3-2. Supabase 대시보드 — Google Provider 활성화

Authentication → Providers → Google:
1. Enable Google: **on**
2. Client IDs: `3-1`에서 받은 Client ID
3. Client Secret: `3-1`의 Secret
4. Callback URL(read-only, 그대로 복사해 Google Cloud에 등록한 값): `https://prqebmdejdvbtkhabtfy.supabase.co/auth/v1/callback`
5. Skip nonce check: **off**(기본)

### 3-3. Supabase — Site URL & Redirect URLs

Authentication → URL Configuration:
- **Site URL**: `https://msvch.vercel.app`
- **Redirect URLs**(allow-list, 여러 개 가능):
  - `https://msvch.vercel.app/auth/callback`
  - `https://msvch.vercel.app/**` (와일드카드 허용 — 단 너무 넓힐 필요는 없음)
  - `http://localhost:3000/auth/callback`
  - 프리뷰: `https://*-msvch.vercel.app/auth/callback` 또는 `https://msvch-*.vercel.app/auth/callback` 형태(실제 Vercel URL 패턴 확인 필요)

**중요**: `signInWithOAuth({ options: { redirectTo } })`의 값이 이 allow-list에 있어야 실제 리디렉트가 이뤄진다. 없으면 Site URL로 fallback.

---

## 4. 코드 변경 — 최소 변경 5건

### 4-1. 새 파일: `src/app/auth/callback/route.ts`

OAuth 리디렉트를 받아 코드를 세션으로 교환하는 서버 라우트. Supabase SSR 공식 예제.

```ts
// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // open redirect 방지: 자체 도메인 내부 경로만 허용
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("OAuth code exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
```

- 이 경로는 middleware matcher 밖에 있으므로 추가 설정 없이 통과.
- **open redirect 방지**: `next`가 외부 URL이거나 `//example.com`(protocol-relative)이면 거절. `/` 시작만 허용.
- 실패 시 `/login?error=oauth`로 보내고 login 페이지에서 이 플래그를 읽어 에러 토스트를 표시하도록 §4-2에서 처리.

### 4-2. 기존 파일: `src/app/(auth)/login/page.tsx` 수정

두 가지 변경:
1. Google 로그인 버튼 + 핸들러 추가
2. `?next=...`와 `?error=oauth` 쿼리 읽기 — 미들웨어에서 `?next=`를 붙여주는 변경을 전제(§4-5)

핵심 핸들러:

```ts
// 상단 import 추가
import { useSearchParams } from "next/navigation";
// ...
const searchParams = useSearchParams();
const nextPath = searchParams.get("next") ?? "/";
const oauthError = searchParams.get("error");

async function handleGoogleLogin() {
  setLoading(true);
  setError("");
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    setError("Google 로그인 중 오류가 발생했습니다.");
    setLoading(false);
  }
  // 성공 시 브라우저가 자동으로 Google로 이동하므로 여기서 끝.
}
```

버튼은 기존 "로그인" 버튼 위 또는 아래에 구분선과 함께 배치:

```tsx
<div className="my-6 flex items-center gap-2 text-xs text-gray-400">
  <span className="h-px flex-1 bg-gray-200" />
  또는
  <span className="h-px flex-1 bg-gray-200" />
</div>
<button
  type="button"
  onClick={handleGoogleLogin}
  disabled={loading}
  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
>
  <GoogleGIcon size={18} />
  Google로 계속하기
</button>
```

`GoogleGIcon`은 [src/components/icons/InstagramIcon.tsx](src/components/icons/InstagramIcon.tsx)처럼 SVG 컴포넌트로 신규 파일 1개 추가. Lucide에는 Google G 로고가 없음(브랜드 이유).

### 4-3. 기존 파일: `next.config.ts` CSP 조정

`connect-src`에 `https://accounts.google.com`을 추가한다. 이유: Supabase JS가 OAuth 초기화 단계에서 `accounts.google.com`의 discovery 메타데이터에 접근하는 경로가 있을 수 있다(Supabase가 보통 서버 측에서 처리하지만, 안전하게 열어둠). 실제로는 리디렉트가 즉시 발생해 connect-src가 크리티컬하지 않을 수도 있지만, **열지 않아서 깨지는 쪽보다 여는 편이 안전**.

```diff
- "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
+ "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://accounts.google.com",
```

구글 프로필 사진(`lh3.googleusercontent.com`)을 프로필 페이지나 Header에 띄우려면 `img-src`도 확장:

```diff
- "img-src 'self' https://*.ytimg.com https://*.supabase.co data: blob:",
+ "img-src 'self' https://*.ytimg.com https://*.supabase.co https://lh3.googleusercontent.com data: blob:",
```

아바타를 안 띄운다면 `img-src`는 그대로.

### 4-4. 새 마이그레이션: `supabase/migrations/014_profiles_oauth_fields.sql`

목적:
1. `profiles.email`, `profiles.avatar_url` 컬럼 추가(아바타 표시 및 이메일 조회용)
2. `handle_new_user` 트리거가 Google/이메일 두 경로 모두에서 잘 동작하도록 업데이트

```sql
-- 014: profiles에 이메일/아바타 저장 + Google OAuth 메타 대응

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email      text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 기존 사용자 email 백필
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id AND p.email IS NULL;

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
```

- 기존 트리거는 `CREATE OR REPLACE FUNCTION`으로 덮어쓰기만 하면 되며, 트리거 자체(`on_auth_user_created`)는 재생성 불필요.
- `email` 컬럼 RLS 정책은 기존 `profiles` 정책 그대로 유지(모든 사용자 SELECT 가능 → 이메일이 전체 공개됨에 주의. 싫으면 `email` 컬럼만 SELECT 제약 추가 또는 `profiles` public SELECT 정책 축소. 본 보고서는 기본 유지를 전제).

**TypeScript 타입 동기화**도 필요:

```ts
// src/types/supabase.ts
export interface Profile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;       // 추가
  avatar_url: string | null;  // 추가
  role: "member" | "admin";
  created_at: string;
}
```

### 4-5. `src/middleware.ts` — `?next=` 전달(권장, 선택적)

현재는 로그인 후 원래 페이지로 못 돌아간다. 작은 개선:

```diff
- if (request.nextUrl.pathname.startsWith("/groups") && !user) {
-   return NextResponse.redirect(new URL("/login", request.url));
- }
+ if (request.nextUrl.pathname.startsWith("/groups") && !user) {
+   const url = new URL("/login", request.url);
+   url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
+   return NextResponse.redirect(url);
+ }
```

동일 패턴을 `/profile`, `/admin`에도 적용. login 페이지는 §4-2에서 이미 `next`를 읽어 콜백 `next`로 넘기므로 자연스럽게 원복된다.

---

## 5. 기존 계정 처리 — 현 상황(회원 1명)

### 5-1. 실제 상황 확정

- 현재 `profiles`에 존재하는 것은 **사용자 본인 테스트 계정 1개**.
- 이메일/비번 ↔ Google 이중 가입 충돌 시나리오는 고민 가치 없음 → 테스트 계정을 **Supabase Dashboard → Authentication → Users**에서 삭제하면 충돌 여지가 사라진다.

### 5-2. 전환 절차(3단계)

1. Supabase Dashboard → Auth → Users → 기존 테스트 계정 삭제 (`profiles` 행도 `on delete cascade`로 함께 제거됨)
2. Google OAuth 구성 완료 후 본인 Gmail로 첫 로그인 → `profiles`에 `role='member'`인 새 row 자동 생성
3. SQL Editor에서 한 줄: `UPDATE public.profiles SET role='admin' WHERE email='<본인 gmail 주소>';`

### 5-3. 회원가입 페이지 — 삭제 권장

회원 0명에서 시작하므로 레거시 유지 이유가 없음. 동시에 두 가지 정리:

- `src/app/(auth)/signup/page.tsx` **삭제**
- `src/app/(auth)/login/page.tsx`에서 이메일/비밀번호 폼 블록 **제거**, Google 버튼 하나만 남김
- `next.config.ts`의 `/members → /login` 리디렉트([next.config.ts:54](next.config.ts:54))는 그대로 두어도 무방(로그인 페이지가 존재하므로)

후속으로 이메일/비번도 같이 쓰고 싶어지면 `signInWithPassword` 블록을 다시 붙이면 되는 가역적 변경.

### 5-4. `handle_new_user` 트리거의 이메일 가입 분기는 어차피 유지

- §4-4 트리거는 Google이든 이메일이든 `raw_user_meta_data` 구조만 보고 동작 → Google만 쓰더라도 트리거 자체는 그대로 필요(첫 로그인 시 profile 자동 생성).
- 즉 Google-only 전환해도 마이그레이션 014의 내용은 그대로 유효.

---

## 6. Vercel Preview URL 처리

- Vercel은 매 PR마다 랜덤 URL(`msvch-abc123-<team>.vercel.app` 같은) 발급.
- Supabase Redirect URL allow-list에 **와일드카드 등록** 가능(2024+ 대시보드 지원):
  - `https://*.vercel.app/auth/callback`
  - 너무 넓다면 팀 slug 기반으로 제한: `https://msvch-*-<vercel-team>.vercel.app/auth/callback`
- Google Cloud의 Authorized JavaScript origins는 와일드카드 **미지원**. 따라서 프리뷰에서 Google 로그인을 테스트하려면:
  - 방법 A: 임시로 특정 프리뷰 URL을 Google 쪽에 추가(수동 노동).
  - 방법 B: **프리뷰에서는 Google 로그인을 테스트하지 않고 이메일 로그인만 유지**(현실적 권고). 프리뷰에서 Google을 누르면 Google 쪽에서 `redirect_uri_mismatch` 에러가 뜸.
- 본 프로젝트는 딱히 프리뷰에서 OAuth를 쓸 일이 없음(주요 테스트는 localhost + prod). 그대로 가도 무방.

---

## 7. UX 설계 결정 필요 항목

### 7-1. Header 로그인 상태 표시(선택)

현재는 전무. 도입하려면:
- `Header.tsx`에 서버 데이터를 주입하기 어려우므로(use client 컴포넌트) **새 Server Component `HeaderUserMenu`**를 만들어 `await createClient().auth.getUser()` 결과를 props로 넘기거나, 클라이언트에서 `supabase.auth.getUser()` 호출.
- 옵션: 로그인 전엔 "로그인" 링크, 로그인 후엔 아바타(`profiles.avatar_url`) + 드롭다운(내 프로필 / 로그아웃).
- 모바일(`/menu`)에도 같은 조건부 UI 필요.

도입 여부는 관리 정책에 달림. 교회 멤버 전용 기능(그룹, 프로필)을 얼마나 드러낼지가 기준.

### 7-2. 계정 연결(Link Google) 페이지

- 기존 이메일 계정을 유지하면서 Google OAuth를 나중에 붙이고 싶을 때: `supabase.auth.linkIdentity({ provider: 'google' })`.
- 프로필 페이지([src/app/(member)/profile/page.tsx](src/app/(member)/profile/page.tsx))에 "Google 계정 연결" 버튼 추가 가능. 필수는 아님.

### 7-3. 회원가입 화면 자체 제거

- 현재 `/signup`은 이메일/비번 가입만 제공. Google 통합 후 90% 이상이 Google을 선택한다면 `/signup` 페이지를 삭제하고, `/login`에 "처음 방문이라면 Google로 계속하세요"만 표시하는 게 더 깔끔.

---

## 8. 테스트 시나리오

### 8-1. 로컬 개발 환경

1. Supabase Redirect URLs에 `http://localhost:3000/auth/callback` 추가
2. Google Cloud Authorized JS origins에 `http://localhost:3000` 추가
3. `.env.local` 그대로(추가 env 없음)
4. `npm run dev` → `http://localhost:3000/login` → "Google로 계속하기" 클릭
5. Google 동의 화면 → 승인 → `http://localhost:3000/auth/callback?code=...&next=/`로 복귀 → 세션 쿠키 세팅 → `/`로 이동

### 8-2. 확인 체크리스트

- [ ] 로그인 직후 `supabase.auth.getUser()` 가 user 반환
- [ ] `profiles` 테이블에 새 row 생성됨(이름/이메일/아바타 채워짐)
- [ ] `/profile` 접근 가능, `/admin` 접근 시 member → `/`로 리디렉트
- [ ] 같은 계정으로 재로그인 시 새 row 생성되지 않음(기존 row 유지)
- [ ] 로그아웃 → 쿠키 삭제 → 보호 경로 접근 시 `/login?next=...`로 리디렉트
- [ ] `/admin/notices` 등 관리자 전용 페이지에서 RLS가 member를 차단
- [ ] 수동으로 SQL `UPDATE profiles SET role='admin' WHERE email='me@gmail.com'` 실행 후 재로그인 → admin 접근 가능
- [ ] CSP 위반 없음(브라우저 콘솔 확인)
- [ ] `next` 파라미터 변조(`?next=//evil.com`) 시 안전하게 `/`로 폴백
- [ ] 기존 이메일 계정으로 로그인 — 여전히 동작

### 8-3. 운영 환경

1. Vercel env는 건드릴 것 없음(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 있으면 충분)
2. 마이그레이션 014 적용: Supabase Dashboard SQL Editor에서 실행
3. 배포(main 푸시)
4. `https://msvch.vercel.app/login`에서 위 체크리스트 반복

---

## 9. 보안 검토

| 항목 | 현재/변경 후 상태 |
|---|---|
| PKCE | `@supabase/ssr`이 기본 활성화. code_verifier는 HttpOnly 쿠키, state 검증 자동 |
| CSRF | PKCE + state로 커버. redirectTo는 Supabase allow-list로 차단 |
| 세션 쿠키 | Supabase SSR이 HttpOnly + Secure(prod) + SameSite=Lax 설정 |
| open redirect | `/auth/callback`의 `next`를 `/`-시작으로만 허용(§4-1) |
| admin 승격 | RLS는 그대로 `profiles.role='admin'` 체크 → 자동 승격 불가 |
| 이메일 검증 | Google ID 토큰의 `email_verified=true` 경우만 신뢰. Supabase가 내부적으로 검증 |
| PII 노출 | `profiles` 테이블이 public SELECT → 이메일이 전체 공개됨. 필요 시 RLS 축소(§4-4 주석) |
| CSP | `connect-src`만 최소 확장. One Tap 미도입으로 script/frame 유지 |
| 토큰 탈취 | 쿠키 HttpOnly이므로 XSS로 접근 불가. `script-src 'unsafe-inline' 'unsafe-eval'`이 이미 허용돼 있어 일반적인 XSS 위험은 Google과 무관하게 존재 — 별건 과제 |

---

## 10. 작업 체크리스트(실행 순서)

**Phase A — 외부 설정(사용자 수동)**
- [ ] A1. Google Cloud Console → OAuth 2.0 Client ID 생성(§3-1)
- [ ] A2. Supabase Dashboard → Google Provider 활성화(§3-2)
- [ ] A3. Supabase Dashboard → Redirect URLs 추가(§3-3)
- [ ] A4. Supabase Dashboard → Auth → Users에서 기존 테스트 계정 삭제(§5-2)

**Phase B — 코드 변경**
- [ ] B1. `src/app/auth/callback/route.ts` 생성(§4-1)
- [ ] B2. `src/components/icons/GoogleGIcon.tsx` 생성(SVG, brand G)
- [ ] B3. `src/app/(auth)/login/page.tsx`를 Google 버튼 단일로 리라이트 + `next`/`error` 쿼리 처리(§4-2, §5-3)
- [ ] B4. `src/app/(auth)/signup/page.tsx` **삭제**(§5-3)
- [ ] B5. `next.config.ts` CSP `connect-src`에 `accounts.google.com` 추가, 필요 시 `img-src`에 `lh3.googleusercontent.com`(§4-3)
- [ ] B6. `supabase/migrations/014_profiles_oauth_fields.sql` 작성(§4-4)
- [ ] B7. `src/types/supabase.ts`의 `Profile` 인터페이스에 `email`, `avatar_url` 추가
- [ ] B8. `src/middleware.ts`에 `?next=` 전달 로직(§4-5, 선택)

**Phase C — 적용 및 검증**
- [ ] C1. 마이그레이션 014 실행(prod Supabase SQL Editor)
- [ ] C2. 로컬에서 Google 로그인 전체 흐름 테스트(§8-2)
- [ ] C3. 프로덕션 배포 + 검증
- [ ] C4. 본인 Gmail로 첫 로그인 → SQL Editor에서 `UPDATE profiles SET role='admin' WHERE email='<본인 gmail>';`

**Phase D — 후속(선택)**
- [ ] D1. Header/Menu에 로그인 상태 UI 추가(§7-1)
- [ ] D2. Supabase profiles의 `email` 컬럼 RLS 축소 검토

---

## 11. 위험 요소와 대응

| # | 위험 | 영향 | 대응 |
|---|---|---|---|
| 1 | ~~기존 email 계정과 Google 충돌~~ | ~~특정 사용자 로그인 불가~~ | **해소됨** — 회원 1명(본인 테스트), Phase A4에서 삭제 |
| 2 | Vercel Preview에서 `redirect_uri_mismatch` | Preview 테스트 불가 | §6 — Preview에서 OAuth 미검증, prod에서만 검증 |
| 3 | `handle_new_user` 트리거가 014 전 배포되면 Google 신규 가입 시 메타데이터 누락 | 프로필 이름이 ""로 들어옴 | Phase C는 "마이그레이션 → 배포" 순서 엄수 |
| 4 | Supabase Redirect URL allow-list 누락 | "Redirect URL not allowed" 에러 | Phase A5 선행 |
| 5 | Google OAuth consent screen Testing 모드 100명 제한 | 실사용 전 소비 | External + 기본 스코프이면 Verification 불필요, Production 승격 |
| 6 | Google 재가입 후 admin 승격 누락 | 관리 페이지 전체 접근 불가(RLS 차단) | Phase C4 — 첫 로그인 직후 즉시 `UPDATE profiles SET role='admin' WHERE email='<본인 gmail>'` 실행 |
| 7 | `profiles.email` public SELECT로 전 회원 이메일 노출 | 개인정보 | §4-4 주석 — 필요 시 RLS 재설계 |
| 8 | One Tap 추가 시 CSP script-src 확장 필요 | 초기에 깜박 잊으면 로딩 실패 | 본 1차 도입에서는 One Tap 미채택 |
| 9 | `supabase.auth.getSession()` 쓰지 않고 `getUser()` 사용하고 있음 | (현재 맞음) — 서버에서 항상 Supabase 검증 | 유지 |

---

## 12. 부록 — 현재 auth 관련 파일 인덱스(빠른 참조)

| 파일 | 라인 | 비고 |
|---|---|---|
| [src/middleware.ts](src/middleware.ts) | 65 | 경로 보호. `/auth/callback`은 matcher 밖이라 자동 우회 |
| [src/lib/supabase/client.ts](src/lib/supabase/client.ts) | 9 | 변경 불필요 |
| [src/lib/supabase/server.ts](src/lib/supabase/server.ts) | 29 | 변경 불필요 |
| [src/lib/admin-auth.ts](src/lib/admin-auth.ts) | 66 | 변경 불필요 — OAuth auth.uid()도 동일 경로 |
| [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx) | 108 | **수정** — Google 버튼 + next/error 쿼리 |
| [src/app/(auth)/signup/page.tsx](src/app/(auth)/signup/page.tsx) | 110 | **삭제**(§5-3) |
| [src/app/(member)/profile/page.tsx](src/app/(member)/profile/page.tsx) | 61 | 필요 시 아바타/이메일 출력, Link Google 버튼 추가 |
| [src/components/LogoutButton.tsx](src/components/LogoutButton.tsx) | 27 | 변경 불필요 |
| [next.config.ts](next.config.ts) | 82 | **수정** — CSP `connect-src`에 accounts.google.com |
| [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql) | 75 | `handle_new_user`는 014로 교체 |
| [supabase/migrations/014_profiles_oauth_fields.sql](supabase/migrations/014_profiles_oauth_fields.sql) | (신규) | **생성** — 프로필 확장 + 트리거 교체 |
| [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts) | (신규) | **생성** — exchangeCodeForSession |
| [src/types/supabase.ts](src/types/supabase.ts) | 27 | **수정** — Profile 인터페이스 확장 |
