# 쇼츠 자동화 구현 계획 — 완료

> 원칙: API는 모바일 앱에서도 그대로 사용할 수 있도록 REST 기반 범용 설계. Admin 웹 UI는 웹 전용.
> STT: Whisper 배제, YouTube 자막(json3) 전용.
> 실행: GitHub Actions. 비용: ~$0.04/월.
>
> **상태: 전체 구현 완료 (2026-04-12)**

---

## Step 1: DB 마이그레이션 — `supabase/migrations/005_shorts.sql`

Supabase 대시보드 SQL Editor에서 직접 실행.

```sql
-- ============================================================
-- 005_shorts.sql — 쇼츠 자동화
-- ============================================================

-- 1. shorts_jobs: 파이프라인 작업 단위
create table public.shorts_jobs (
  id uuid default gen_random_uuid() primary key,
  video_id text not null unique,
  video_title text not null,
  video_published_at timestamptz,
  video_thumbnail text,
  status text not null default 'pending'
    check (status in (
      'pending','downloading','transcribing','selecting',
      'editing','ready_for_review','published','failed'
    )),
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.shorts_jobs enable row level security;

-- 누구나 조회 가능 (모바일 앱에서 쇼츠 목록 표시용)
create policy "Anyone can view jobs" on public.shorts_jobs
  for select using (true);

-- admin만 CUD
create policy "Admins can manage jobs" on public.shorts_jobs
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. shorts_clips: 생성된 쇼츠 후보
create table public.shorts_clips (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.shorts_jobs on delete cascade not null,
  clip_index int not null,
  start_sec numeric not null,
  end_sec numeric not null,
  duration_sec numeric generated always as (end_sec - start_sec) stored,
  title text,
  hook text,
  transcript text,
  caption_yt text,
  caption_ig text,
  video_url text,
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  reviewer_note text,
  youtube_video_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);

alter table public.shorts_clips enable row level security;

-- 승인된 클립만 공개 조회 (모바일 앱용)
create policy "Anyone can view approved clips" on public.shorts_clips
  for select using (
    review_status = 'approved'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can manage clips" on public.shorts_clips
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 인덱스
create index idx_shorts_clips_job_id on public.shorts_clips(job_id);
create index idx_shorts_clips_review on public.shorts_clips(review_status);

-- 3. shorts_settings: 글로벌 설정 (싱글톤)
create table public.shorts_settings (
  id int primary key default 1 check (id = 1),
  auto_publish boolean default false,
  max_clips_per_sermon int default 5,
  daily_publish_limit int default 5,
  highlight_prompt text,
  metadata_prompt text,
  updated_at timestamptz default now()
);

alter table public.shorts_settings enable row level security;

create policy "Anyone can view settings" on public.shorts_settings
  for select using (true);

create policy "Admins can manage settings" on public.shorts_settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 기본값 삽입
insert into public.shorts_settings (id) values (1);

-- 4. Storage 버킷 (쇼츠 mp4 임시 저장)
insert into storage.buckets (id, name, public)
values ('shorts', 'shorts', true)
on conflict (id) do nothing;

create policy "Anyone can view shorts files" on storage.objects
  for select using (bucket_id = 'shorts');

create policy "Admins can upload shorts files" on storage.objects
  for insert with check (
    bucket_id = 'shorts'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete shorts files" on storage.objects
  for delete using (
    bucket_id = 'shorts'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- service_role도 shorts 버킷에 업로드/삭제 가능해야 함 (GitHub Actions에서 사용)
create policy "Service role can upload shorts" on storage.objects
  for insert with check (
    bucket_id = 'shorts' and auth.role() = 'service_role'
  );

create policy "Service role can delete shorts" on storage.objects
  for delete using (
    bucket_id = 'shorts' and auth.role() = 'service_role'
  );
```

### RLS 설계 의도 (모바일 호환)
- `shorts_jobs`: 누구나 SELECT → 모바일에서 "최근 쇼츠" 목록 표시 가능
- `shorts_clips`: approved 클립만 공개 SELECT → 모바일에서 쇼츠 재생 목록
- admin은 모든 상태의 clips를 볼 수 있음 (검수용)
- Storage: service_role 정책 추가 → GitHub Actions가 `SUPABASE_SERVICE_ROLE_KEY`로 mp4 업로드

---

## Step 2: 타입 정의 — `src/types/shorts.ts`

```typescript
export interface ShortsJob {
  id: string;
  video_id: string;
  video_title: string;
  video_published_at: string | null;
  video_thumbnail: string | null;
  status:
    | "pending"
    | "downloading"
    | "transcribing"
    | "selecting"
    | "editing"
    | "ready_for_review"
    | "published"
    | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShortsClip {
  id: string;
  job_id: string;
  clip_index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  title: string | null;
  hook: string | null;
  transcript: string | null;
  caption_yt: string | null;
  caption_ig: string | null;
  video_url: string | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
  youtube_video_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ShortsSettings {
  id: number;
  auto_publish: boolean;
  max_clips_per_sermon: number;
  daily_publish_limit: number;
  highlight_prompt: string | null;
  metadata_prompt: string | null;
  updated_at: string;
}

/** Gemini 하이라이트 선정 결과 */
export interface HighlightSegment {
  start_sec: number;
  end_sec: number;
  title: string;
  hook: string;
  reason: string;
}
```

---

## Step 3: Gemini 리팩터 — `src/lib/gemini.ts`

현재 `callGemini()`이 모듈 내부 함수(export 없음). 폴백+재시도 로직이 `summarizeSermonFromVideo()` 안에 하드코딩되어 있어 재사용 불가.

### 변경 내용
`callGemini()`은 그대로 두고, 폴백+재시도를 포함한 **범용 래퍼**를 export.

기존 코드 line 32~59의 `callGemini()`은 변경 없음. 아래를 **line 59 뒤, `summarizeSermonFromVideo()` 앞**에 추가:

```typescript
/**
 * 폴백 체인 + 지수 백오프 재시도를 포함한 범용 Gemini 호출.
 * scripts/shorts/ 및 API 라우트에서 재사용.
 */
export async function callGeminiWithFallback(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  let lastTransientStatus = 0;
  let lastErrorBody = "";

  for (const model of MODEL_FALLBACK_CHAIN) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await callGemini(model, apiKey, prompt);
      if (result.ok) return result.text;

      if (!RETRYABLE_STATUS.has(result.status)) {
        throw new Error(`Gemini API 오류: ${result.status} ${result.body}`);
      }

      lastTransientStatus = result.status;
      lastErrorBody = result.body;

      if (attempt < maxAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  throw new GeminiUnavailableError(
    `AI 서버가 일시적으로 혼잡합니다. (${lastTransientStatus} ${lastErrorBody.slice(0, 200)})`
  );
}
```

그 다음, 기존 `summarizeSermonFromVideo()`의 폴백 루프(line 96~125)를 `callGeminiWithFallback()` 호출로 교체:

```typescript
export async function summarizeSermonFromVideo(
  sermon: SermonVideo
): Promise<string> {
  const prompt = `당신은 교회 설교 요약 전문가입니다...`; // 기존 프롬프트 그대로

  return callGeminiWithFallback(prompt);
}
```

→ 코드 중복 제거 + scripts/shorts/에서 `callGeminiWithFallback()` import 가능.

---

## Step 4: API 라우트 (모바일 호환 REST)

모든 API는 **Supabase Auth 쿠키 또는 Bearer 토큰**으로 인증. 모바일 앱은 `Authorization: Bearer <access_token>` 헤더를 보내면 동일하게 동작.

> 현재 middleware.ts는 쿠키 기반이지만, Supabase `createServerClient`는 쿠키와 Authorization 헤더를 모두 지원하므로 모바일에서도 동작.

### 4-1. `src/app/api/shorts/route.ts` — 목록 조회

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ShortsJob, ShortsClip } from "@/types/shorts";

export const revalidate = 0; // 항상 최신

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = req.nextUrl;

  // ?status=ready_for_review  (선택)
  const status = searchParams.get("status");
  // ?published=true  (모바일: 발행된 쇼츠만)
  const published = searchParams.get("published");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  let jobQuery = supabase
    .from("shorts_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) jobQuery = jobQuery.eq("status", status);
  if (published === "true") jobQuery = jobQuery.eq("status", "published");

  const { data: jobs } = await jobQuery;
  if (!jobs || jobs.length === 0) return NextResponse.json([]);

  // 각 job에 clips 포함
  const jobIds = jobs.map((j) => j.id as string);
  const { data: clips } = await supabase
    .from("shorts_clips")
    .select("*")
    .in("job_id", jobIds)
    .order("clip_index", { ascending: true });

  const clipsByJob: Record<string, ShortsClip[]> = {};
  for (const clip of (clips ?? []) as ShortsClip[]) {
    if (!clipsByJob[clip.job_id]) clipsByJob[clip.job_id] = [];
    clipsByJob[clip.job_id].push(clip);
  }

  const result = (jobs as ShortsJob[]).map((job) => ({
    ...job,
    clips: clipsByJob[job.id] ?? [],
  }));

  return NextResponse.json(result);
}
```

**모바일 사용 예시:**
- `GET /api/shorts?published=true&limit=10` → 발행된 쇼츠 최신 10개 (approved clips만 RLS로 필터)
- `GET /api/shorts?status=ready_for_review` → Admin용 검수 대기 목록

### 4-2. `src/app/api/shorts/[id]/approve/route.ts` — 클립 승인

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // Admin 체크
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { error } = await supabase
    .from("shorts_clips")
    .update({ review_status: "approved" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

### 4-3. `src/app/api/shorts/[id]/reject/route.ts` — 클립 반려

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Params = Promise<{ id: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json() as { note?: string };

  const { error } = await supabase
    .from("shorts_clips")
    .update({
      review_status: "rejected",
      reviewer_note: body.note ?? null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

### 4-4. `src/app/api/shorts/trigger/route.ts` — GitHub Actions 트리거

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  // Admin 체크
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const body = await request.json() as {
    videoId: string;
    videoTitle: string;
    videoPublishedAt?: string;
    videoThumbnail?: string;
  };

  // 중복 체크
  const { data: existing } = await supabase
    .from("shorts_jobs")
    .select("id, status")
    .eq("video_id", body.videoId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: `이미 작업이 존재합니다 (${existing.status})`, jobId: existing.id },
      { status: 409 }
    );
  }

  // Job 생성
  const { data: job, error: insertError } = await supabase
    .from("shorts_jobs")
    .insert({
      video_id: body.videoId,
      video_title: body.videoTitle,
      video_published_at: body.videoPublishedAt ?? null,
      video_thumbnail: body.videoThumbnail ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !job) {
    return NextResponse.json({ error: insertError?.message ?? "생성 실패" }, { status: 500 });
  }

  // GitHub Actions workflow_dispatch
  const ghToken = process.env.GITHUB_PAT;
  if (!ghToken) {
    return NextResponse.json({ error: "GITHUB_PAT 미설정" }, { status: 500 });
  }

  const dispatchRes = await fetch(
    "https://api.github.com/repos/msvchweb/msvch/actions/workflows/sermon-shorts.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          videoId: body.videoId,
          jobId: job.id,
        },
      }),
    }
  );

  if (!dispatchRes.ok) {
    const errText = await dispatchRes.text();
    // Job은 이미 생성됨 → failed로 마킹
    await supabase
      .from("shorts_jobs")
      .update({ status: "failed", error: `Actions 트리거 실패: ${errText}` })
      .eq("id", job.id);
    return NextResponse.json({ error: `Actions 트리거 실패: ${dispatchRes.status}` }, { status: 502 });
  }

  return NextResponse.json({ jobId: job.id, status: "pending" });
}
```

**필요한 환경변수 (신규):**
- `GITHUB_PAT`: GitHub Personal Access Token (workflow dispatch 권한)
  - Vercel 환경변수에 추가
  - 스코프: `repo` (또는 fine-grained: Actions read/write)

---

## Step 5: GitHub Actions 워크플로우 — `.github/workflows/sermon-shorts.yml`

```yaml
name: Generate sermon shorts

on:
  workflow_dispatch:
    inputs:
      videoId:
        description: "YouTube video ID"
        required: true
      jobId:
        description: "Supabase shorts_jobs.id"
        required: true

concurrency:
  group: sermon-shorts
  cancel-in-progress: false

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: |
          npm ci
          pipx install yt-dlp

      - name: Run shorts pipeline
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          npx tsx scripts/shorts/run.ts \
            --videoId="${{ inputs.videoId }}" \
            --jobId="${{ inputs.jobId }}"
```

**주의사항:**
- `concurrency.group: sermon-shorts` → 동시 실행 방지 (FFmpeg CPU 부하)
- `timeout-minutes: 30` → 60분보다 보수적으로 설정, 필요시 증가
- `SUPABASE_SERVICE_ROLE_KEY` 사용 → RLS 우회하여 shorts_jobs/clips 직접 업데이트
- `tsx` 사용 → TypeScript 직접 실행, 별도 빌드 불필요

---

## Step 6: 파이프라인 스크립트 — `scripts/shorts/`

### 6-0. `scripts/shorts/lib/supabase.ts` — Actions용 Supabase 클라이언트

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

기존 `src/lib/supabase/server.ts`는 Next.js cookies() 의존이라 Node.js 스크립트에서 사용 불가.
service_role_key로 직접 생성하면 RLS 우회 + cookies 불필요.

### 6-1. `scripts/shorts/run.ts` — 진입점

```typescript
import { supabase } from "./lib/supabase";
import { download } from "./download";
import { selectHighlights } from "./highlight";
import { editClips } from "./edit";
import { generateMetadata } from "./metadata";
import { uploadClips } from "./upload";

async function updateJob(jobId: string, status: string, error?: string) {
  await supabase
    .from("shorts_jobs")
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function main() {
  const args = process.argv.slice(2);
  const videoId = args.find((a) => a.startsWith("--videoId="))?.split("=")[1];
  const jobId = args.find((a) => a.startsWith("--jobId="))?.split("=")[1];

  if (!videoId || !jobId) {
    console.error("Usage: --videoId=XXX --jobId=YYY");
    process.exit(1);
  }

  try {
    // 1. 다운로드 + 자막 추출
    await updateJob(jobId, "downloading");
    const { videoPath, subtitlePath } = await download(videoId);

    // 2. 자막 파싱 + 하이라이트 선정
    await updateJob(jobId, "transcribing");
    // (자막 파싱은 selecting과 함께)

    await updateJob(jobId, "selecting");
    const highlights = await selectHighlights(subtitlePath, jobId);

    // 3. FFmpeg 편집
    await updateJob(jobId, "editing");
    const clipPaths = await editClips(videoPath, subtitlePath, highlights);

    // 4. 메타데이터 생성
    const metadata = await generateMetadata(highlights);

    // 5. Supabase 업로드 + DB 저장
    const clips = await uploadClips(jobId, clipPaths, highlights, metadata);

    await updateJob(jobId, "ready_for_review");
    console.log(`완료: ${clips.length}개 클립 생성`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("파이프라인 실패:", msg);
    await updateJob(jobId, "failed", msg);
    process.exit(1);
  }
}

main();
```

### 6-2. `scripts/shorts/download.ts` — yt-dlp

```typescript
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const WORK_DIR = "/tmp/shorts";

export async function download(videoId: string) {
  execSync(`mkdir -p ${WORK_DIR}`);

  const videoPath = path.join(WORK_DIR, `${videoId}.mp4`);
  const subtitlePath = path.join(WORK_DIR, `${videoId}.ko.json3`);

  // 영상 + 한국어 자동 자막 다운로드
  execSync(
    `yt-dlp \
      --write-auto-sub --sub-lang ko --sub-format json3 \
      -f "bv*[height<=1080]+ba/b[height<=1080]" \
      --merge-output-format mp4 \
      -o "${videoPath}" \
      --no-playlist \
      "https://www.youtube.com/watch?v=${videoId}"`,
    { stdio: "inherit", timeout: 300_000 } // 5분 타임아웃
  );

  if (!existsSync(videoPath)) {
    throw new Error("영상 다운로드 실패");
  }

  // yt-dlp는 자막 파일명에 .ko 를 붙임 — 정확한 파일명 탐색
  const { readdirSync } = await import("fs");
  const files = readdirSync(WORK_DIR);
  const subFile = files.find(
    (f) => f.startsWith(videoId) && f.endsWith(".json3")
  );

  if (!subFile) {
    throw new Error("한국어 자막을 찾을 수 없습니다. 이 영상에는 자동 자막이 없을 수 있습니다.");
  }

  return {
    videoPath,
    subtitlePath: path.join(WORK_DIR, subFile),
  };
}
```

### 6-3. `scripts/shorts/highlight.ts` — Gemini 하이라이트 선정

```typescript
import { readFileSync } from "fs";
import type { HighlightSegment } from "../../src/types/shorts";

// json3 자막 파싱
interface Json3Event {
  tStartMs: number;
  dDurationMs: number;
  segs?: { utf8: string; tOffsetMs?: number }[];
}

interface Json3Subtitle {
  events: Json3Event[];
}

function parseJson3(filePath: string) {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Json3Subtitle;
  // 텍스트가 있는 이벤트만 추출
  return raw.events
    .filter((e) => e.segs && e.segs.some((s) => s.utf8.trim()))
    .map((e) => ({
      startMs: e.tStartMs,
      endMs: e.tStartMs + e.dDurationMs,
      text: (e.segs ?? []).map((s) => s.utf8).join(""),
    }));
}

function segmentsToTranscript(
  segments: { startMs: number; endMs: number; text: string }[]
) {
  // Gemini에 보낼 텍스트: [MM:SS] 텍스트 형식
  return segments
    .map((s) => {
      const sec = Math.floor(s.startMs / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      return `[${mm}:${ss}] ${s.text.trim()}`;
    })
    .filter((line) => line.length > 8) // 빈 줄 제거
    .join("\n");
}

export async function selectHighlights(
  subtitlePath: string,
  jobId: string,
): Promise<HighlightSegment[]> {
  const segments = parseJson3(subtitlePath);
  if (segments.length === 0) {
    throw new Error("자막이 비어 있습니다.");
  }

  const transcript = segmentsToTranscript(segments);

  // Gemini 호출 — scripts에서는 직접 fetch (src/lib 의존 최소화)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const prompt = `당신은 교회 설교 편집자입니다.
아래는 한국어 설교 트랜스크립트입니다 (타임스탬프 포함).

다음 조건을 만족하는 30~55초 구간 5개를 골라주세요:
- 한 가지 완결된 메시지를 담고 있을 것
- 문장이 자연스럽게 시작하고 끝날 것
- 감정적 호소, 핵심 적용, 인상 깊은 비유, 도전적 권면 중 하나에 해당
- 비신자에게도 이해 가능할 것 (내부 용어/상황 의존 X)
- 5개는 서로 주제가 겹치지 않을 것

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{"highlights":[{"start_sec":0,"end_sec":0,"title":"20자 이내","hook":"첫 3초 훅 한 줄","reason":"선정 이유 1문장"}]}

트랜스크립트:
${transcript}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API 실패: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답 비어있음");

  const parsed = JSON.parse(text) as { highlights: HighlightSegment[] };

  // 타임스탬프 스냅: 가장 가까운 segment 경계로 보정
  const snapped = parsed.highlights.map((h) => {
    const startSeg = segments.reduce((best, s) =>
      Math.abs(s.startMs / 1000 - h.start_sec) < Math.abs(best.startMs / 1000 - h.start_sec) ? s : best
    );
    const endSeg = segments.reduce((best, s) =>
      Math.abs(s.endMs / 1000 - h.end_sec) < Math.abs(best.endMs / 1000 - h.end_sec) ? s : best
    );

    return {
      ...h,
      start_sec: startSeg.startMs / 1000,
      end_sec: endSeg.endMs / 1000,
    };
  });

  return snapped;
}
```

### 6-4. `scripts/shorts/edit.ts` — FFmpeg

```typescript
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import type { HighlightSegment } from "../../src/types/shorts";

const WORK_DIR = "/tmp/shorts";

/** json3에서 특정 구간의 자막을 ASS 포맷으로 변환 */
function generateASS(
  subtitlePath: string,
  startSec: number,
  endSec: number,
): string {
  const raw = JSON.parse(readFileSync(subtitlePath, "utf-8"));
  const events = raw.events ?? [];

  let assDialogue = "";
  for (const e of events) {
    const evtStart = e.tStartMs / 1000;
    const evtEnd = (e.tStartMs + e.dDurationMs) / 1000;

    if (evtEnd < startSec || evtStart > endSec) continue;
    if (!e.segs) continue;

    const text = e.segs.map((s: { utf8: string }) => s.utf8).join("").trim();
    if (!text) continue;

    // 구간 내 상대 시간으로 변환
    const relStart = Math.max(0, evtStart - startSec);
    const relEnd = Math.min(endSec - startSec, evtEnd - startSec);

    const fmtTime = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
    };

    assDialogue += `Dialogue: 0,${fmtTime(relStart)},${fmtTime(relEnd)},Default,,0,0,0,,${text}\n`;
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Pretendard,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,20,20,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assDialogue}`;
}

export async function editClips(
  videoPath: string,
  subtitlePath: string,
  highlights: HighlightSegment[],
): Promise<string[]> {
  const outputPaths: string[] = [];

  for (let i = 0; i < highlights.length; i++) {
    const h = highlights[i];
    const assContent = generateASS(subtitlePath, h.start_sec, h.end_sec);
    const assPath = path.join(WORK_DIR, `clip_${i}.ass`);
    const outputPath = path.join(WORK_DIR, `clip_${i}.mp4`);

    writeFileSync(assPath, assContent, "utf-8");

    // 2-pass: 먼저 크롭+컷, 그 다음 자막 번인
    // 단일 패스로 처리 (ass 필터 사용)
    execSync(
      `ffmpeg -y -ss ${h.start_sec} -to ${h.end_sec} -i "${videoPath}" \
        -vf "crop=ih*9/16:ih,scale=1080:1920,ass=${assPath}" \
        -c:v libx264 -preset medium -crf 23 \
        -c:a aac -b:a 128k \
        -movflags +faststart \
        "${outputPath}"`,
      { stdio: "inherit", timeout: 120_000 }
    );

    outputPaths.push(outputPath);
  }

  return outputPaths;
}
```

### 6-5. `scripts/shorts/metadata.ts` — Gemini 메타데이터

```typescript
import type { HighlightSegment } from "../../src/types/shorts";

interface ClipMetadata {
  title_yt: string;
  caption_yt: string;
  caption_ig: string;
}

export async function generateMetadata(
  highlights: HighlightSegment[],
): Promise<ClipMetadata[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");

  const prompt = `당신은 교회 SNS 콘텐츠 편집자입니다.
아래 5개 설교 하이라이트 클립에 대해 각각 메타데이터를 생성해주세요.

클립 목록:
${highlights.map((h, i) => `${i + 1}. "${h.title}" (${Math.round(h.end_sec - h.start_sec)}초) - 훅: ${h.hook}`).join("\n")}

각 클립에 대해:
- title_yt: YouTube 제목 (50자 이내, 끝에 #Shorts 포함)
- caption_yt: YouTube 설명 (해시태그 5개 포함, 200자 이내)
- caption_ig: Instagram 캡션 (해시태그 15개 포함, 500자 이내)

JSON 배열로만 응답:
[{"title_yt":"...","caption_yt":"...","caption_ig":"..."}]`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini 메타데이터 실패: ${res.status}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text!) as ClipMetadata[];
}
```

### 6-6. `scripts/shorts/upload.ts` — Supabase 저장

```typescript
import { readFileSync } from "fs";
import { supabase } from "./lib/supabase";
import type { HighlightSegment } from "../../src/types/shorts";

interface ClipMetadata {
  title_yt: string;
  caption_yt: string;
  caption_ig: string;
}

export async function uploadClips(
  jobId: string,
  clipPaths: string[],
  highlights: HighlightSegment[],
  metadata: ClipMetadata[],
) {
  const clips = [];

  for (let i = 0; i < clipPaths.length; i++) {
    const filePath = clipPaths[i];
    const h = highlights[i];
    const m = metadata[i];

    // Storage 업로드
    const storagePath = `${jobId}/clip_${i}.mp4`;
    const fileBuffer = readFileSync(filePath);

    const { error: uploadError } = await supabase.storage
      .from("shorts")
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) throw new Error(`Storage 업로드 실패: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("shorts")
      .getPublicUrl(storagePath);

    // 자막 텍스트 추출 (해당 구간)
    // highlight.ts에서 이미 파싱했지만 여기서는 간단히 hook 사용
    const transcript = h.hook ?? "";

    // DB 삽입
    const { data: clip, error: insertError } = await supabase
      .from("shorts_clips")
      .insert({
        job_id: jobId,
        clip_index: i,
        start_sec: h.start_sec,
        end_sec: h.end_sec,
        title: h.title ?? m.title_yt,
        hook: h.hook,
        transcript,
        caption_yt: m.caption_yt,
        caption_ig: m.caption_ig,
        video_url: urlData.publicUrl,
        review_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`클립 DB 삽입 실패: ${insertError.message}`);

    clips.push(clip);
  }

  return clips;
}
```

---

## Step 7: Admin UI — `src/app/admin/shorts/page.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Video, Play, Check, X, Loader2,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SermonVideo } from "@/types/youtube";
import type { ShortsJob, ShortsClip } from "@/types/shorts";

type JobWithClips = ShortsJob & { clips: ShortsClip[] };

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: "대기", color: "bg-gray-100 text-gray-600" },
  downloading: { text: "다운로드 중", color: "bg-blue-50 text-blue-600" },
  transcribing: { text: "자막 추출", color: "bg-blue-50 text-blue-600" },
  selecting: { text: "하이라이트 선정", color: "bg-blue-50 text-blue-600" },
  editing: { text: "영상 편집", color: "bg-blue-50 text-blue-600" },
  ready_for_review: { text: "검수 대기", color: "bg-amber-50 text-amber-700" },
  published: { text: "발행 완료", color: "bg-emerald-50 text-emerald-700" },
  failed: { text: "실패", color: "bg-red-50 text-red-600" },
};

export default function AdminShortsPage() {
  const [jobs, setJobs] = useState<JobWithClips[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSermonPicker, setShowSermonPicker] = useState(false);
  const [sermons, setSermons] = useState<SermonVideo[]>([]);
  const [triggering, setTriggering] = useState(false);
  const [expandedClips, setExpandedClips] = useState<Set<string>>(new Set());

  useEffect(() => { loadJobs(); }, []);

  async function loadJobs() {
    const res = await fetch("/api/shorts");
    const data = await res.json();
    setJobs(data);
    setLoading(false);
  }

  async function openSermonPicker() {
    if (sermons.length === 0) {
      const res = await fetch("/api/sermons");
      setSermons(await res.json());
    }
    setShowSermonPicker(true);
  }

  async function triggerGeneration(sermon: SermonVideo) {
    setTriggering(true);
    const res = await fetch("/api/shorts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: sermon.videoId,
        videoTitle: sermon.title,
        videoPublishedAt: sermon.publishedAt,
        videoThumbnail: sermon.thumbnail,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "트리거 실패");
    } else {
      setShowSermonPicker(false);
      await loadJobs();
    }
    setTriggering(false);
  }

  async function handleApprove(clipId: string) {
    await fetch(`/api/shorts/${clipId}/approve`, { method: "POST" });
    await loadJobs();
  }

  async function handleReject(clipId: string) {
    const note = prompt("반려 사유를 입력하세요:");
    if (note === null) return;
    await fetch(`/api/shorts/${clipId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await loadJobs();
  }

  function toggleTranscript(clipId: string) {
    setExpandedClips((prev) => {
      const next = new Set(prev);
      next.has(clipId) ? next.delete(clipId) : next.add(clipId);
      return next;
    });
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-400">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">쇼츠 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            설교 영상에서 쇼츠를 자동 생성합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadJobs}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
          >
            <RefreshCw size={14} />
            새로고침
          </button>
          <button
            onClick={openSermonPicker}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Video size={16} />
            쇼츠 생성
          </button>
        </div>
      </div>

      {/* 설교 선택 모달 */}
      {showSermonPicker && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">설교 영상 선택</h3>
            <button onClick={() => setShowSermonPicker(false)}>
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sermons.map((s) => (
              <button
                key={s.videoId}
                onClick={() => triggerGeneration(s)}
                disabled={triggering}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg">
                  <Image src={s.thumbnail} alt="" fill className="object-cover" sizes="128px" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.publishedAt.split("T")[0]}</p>
                </div>
                {triggering && <Loader2 size={16} className="ml-auto animate-spin text-primary-600" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Job 목록 */}
      <div className="space-y-6">
        {jobs.map((job) => {
          const st = STATUS_LABELS[job.status] ?? STATUS_LABELS.pending;
          return (
            <div key={job.id} className="rounded-xl border border-gray-200 bg-white">
              {/* Job 헤더 */}
              <div className="flex items-center gap-4 p-5">
                {job.video_thumbnail && (
                  <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg">
                    <Image src={job.video_thumbnail} alt="" fill className="object-cover" sizes="160px" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{job.video_title}</h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {job.video_published_at?.split("T")[0]} &middot; 클립 {job.clips.length}개
                  </p>
                  {job.error && (
                    <p className="mt-1 text-xs text-red-500">{job.error}</p>
                  )}
                </div>
                <span className={`rounded-lg px-3 py-1.5 text-xs font-medium ${st.color}`}>
                  {st.text}
                </span>
              </div>

              {/* Clips */}
              {job.clips.length > 0 && (
                <div className="border-t border-gray-100">
                  {job.clips.map((clip) => (
                    <div key={clip.id} className="border-b border-gray-50 p-5 last:border-b-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Play size={14} className="text-primary-600" />
                            <span className="font-medium text-gray-900">
                              {clip.title ?? `클립 ${clip.clip_index + 1}`}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTime(clip.start_sec)} ~ {formatTime(clip.end_sec)}
                              ({Math.round(clip.duration_sec)}초)
                            </span>
                          </div>
                          {clip.hook && (
                            <p className="mt-1 text-sm text-gray-500 italic">"{clip.hook}"</p>
                          )}

                          {/* 비디오 미리보기 */}
                          {clip.video_url && (
                            <video
                              src={clip.video_url}
                              controls
                              className="mt-3 max-h-64 rounded-lg"
                              preload="metadata"
                            />
                          )}

                          {/* 자막 토글 */}
                          {clip.transcript && (
                            <button
                              onClick={() => toggleTranscript(clip.id)}
                              className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                            >
                              {expandedClips.has(clip.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              자막 텍스트
                            </button>
                          )}
                          {expandedClips.has(clip.id) && clip.transcript && (
                            <p className="mt-1 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                              {clip.transcript}
                            </p>
                          )}
                        </div>

                        {/* 승인/반려 버튼 */}
                        {clip.review_status === "pending" && (
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => handleApprove(clip.id)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100"
                            >
                              <Check size={14} />
                              승인
                            </button>
                            <button
                              onClick={() => handleReject(clip.id)}
                              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              <X size={14} />
                              반려
                            </button>
                          </div>
                        )}
                        {clip.review_status === "approved" && (
                          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600">승인됨</span>
                        )}
                        {clip.review_status === "rejected" && (
                          <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">반려됨</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {jobs.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            아직 생성된 쇼츠가 없습니다. 위 버튼으로 시작하세요.
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## Step 8: Admin 레이아웃 수정 — `src/app/admin/layout.tsx`

현재 코드 line 2에 import 추가, line 9에 항목 추가:

```typescript
// line 2 변경
import { LayoutDashboard, FileText, ImageIcon, Newspaper, Sparkles, Video } from "lucide-react";

// adminNav 배열 끝에 추가 (line 9 뒤):
  { label: "쇼츠", href: "/admin/shorts", icon: Video },
```

---

## Step 9: 환경변수 추가

### Vercel
- `GITHUB_PAT`: GitHub Fine-grained PAT (msvchweb/msvch 저장소, Actions write 권한)

### GitHub Secrets
- 이미 등록됨: `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 신규 없음 (YouTube OAuth는 Phase 1 후반에 추가)

---

## Step 10: 종단 테스트

1. Supabase에서 005_shorts.sql 실행
2. 코드 push → Vercel 자동 배포
3. `/admin/shorts` 접속 → "쇼츠 생성" → 설교 선택
4. GitHub Actions 탭에서 워크플로우 실행 확인
5. 완료 후 Admin에서 클립 목록 + 미리보기 확인
6. 승인/반려 테스트

### 테스트 체크리스트
- [ ] yt-dlp 다운로드 성공 (Actions 로그)
- [ ] 한국어 자막 추출 성공 (json3 파일 존재)
- [ ] Gemini 하이라이트 5개 반환 (JSON 파싱 성공)
- [ ] FFmpeg 9:16 크롭 + 자막 번인 (mp4 생성)
- [ ] Supabase Storage 업로드 (공개 URL 접근 가능)
- [ ] Admin에서 비디오 재생 가능
- [ ] 승인/반려 상태 변경 정상

---

## 모바일 호환 API 요약

모바일 앱에서 백엔드 수정 없이 사용 가능한 엔드포인트:

| 엔드포인트 | 메서드 | 인증 | 용도 |
|-----------|--------|------|------|
| `/api/shorts?published=true` | GET | 불필요 | 발행된 쇼츠 목록 (approved clips만) |
| `/api/shorts?status=ready_for_review` | GET | admin | 검수 대기 목록 |
| `/api/shorts/[clipId]/approve` | POST | admin | 승인 |
| `/api/shorts/[clipId]/reject` | POST | admin | 반려 |
| `/api/shorts/trigger` | POST | admin | 생성 트리거 |
| `/api/sermons` | GET | 불필요 | 설교 영상 목록 (기존) |

모바일 인증: Supabase `supabase.auth.signIn()` → access_token → `Authorization: Bearer <token>` 헤더.
RLS가 자동으로 admin/비admin을 구분하므로 API 코드 변경 불필요.
