# 명성비전교회 (msvch) 홈페이지

명성비전교회의 공식 홈페이지와 관리자 시스템. 공개 사이트는 [www.msvch.org](https://www.msvch.org) 에서 운영된다.

> ℹ️ 더나브론비전(thenavron) 교회 SaaS 프로젝트는 **별도 레포에서 진행** — 본 레포는 명성비전교회 홈페이지 개발만 다룬다.

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 16.2 (App Router) |
| UI | React 19.2 (Server + Client Components) |
| 스타일 | Tailwind CSS v4 (@theme) |
| DB / Auth / Storage | Supabase (PostgreSQL + RLS + OAuth) |
| AI | Google Gemini 2.5 Flash |
| 배포 | Vercel (GitHub 자동 배포 + Cron) |
| 언어 | TypeScript |

세부 아키텍처는 [`ARCHIT.md`](./ARCHIT.md) 참조.

---

## 주요 기능

- **공개 사이트**: 홈 히어로 슬라이더, 공지사항, 비전갤러리, 말씀영상, 주보 웹뷰(보호), 자체 캘린더(절기색), 새가족 등록 공개 폼, 챗봇(Gemini).
- **관리자 시스템** (`/admin`): 권한 4계층(`member` / `staff` / `admin` / `master`). 사이드바·하단탭바·메뉴페이지·대시보드 카드가 모두 `src/lib/admin-permissions.ts` 의 단일 매트릭스를 참조.
- **주보 시스템**: 5탭 + 마스터 폼, 4페이지 실시간 미리보기, A5 인쇄 모드, 공개 웹뷰(우클릭/복사/단축키 차단 + 워터마크).
- **소모임 게시판**: ad-hoc 멤버 모델, 모바일 호환 cursor 페이지네이션.
- **AI 도구**: 설교 요약, 포스터 프롬프트 빌더, 주보 교회소식 → 일정 자동 추출(검수 모달).
- **자동화**: YouTube 동기화 cron, 일정 D-1 알림톡 cron(중계사 승인 대기), GitHub Actions 쇼츠 파이프라인.
- **절기색**: 대한예수교장로회(통합) 5색 체계가 사이트 전반에 자동 반영 (계산식, DB 변경 0).

---

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

### 환경변수 (`.env.local`)

| 항목 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (브라우저/RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (서버 전용 — 익명 INSERT 라우트 등) |
| `YOUTUBE_API_KEY` | 설교 영상 동기화 cron |
| `GEMINI_API_KEY` | 챗봇·설교 요약·포스터 프롬프트·일정 AI 추출 |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | 찾아오시는 길 임베드 |
| `REVALIDATE_SECRET` | ISR 온디맨드 무효화 |
| `CRON_SECRET` | Vercel Cron 인증 |
| `GITHUB_PAT` | 쇼츠 생성 트리거 (GitHub Actions) |
| `KAKAO_BIZ_*` | (선택) 카카오 비즈 알림톡 — 미설정 시 noop |

배포·CI/CD 세부사항은 [`ARCHIT.md`](./ARCHIT.md#배포) 참조.

### Vercel Cron

`vercel.json` 에 등록된 두 개의 일일 cron:

| 경로 | 스케줄(UTC) | KST | 역할 |
|---|---|---|---|
| `/api/admin/cron/alimtalk-events` | `0 21 * * *` | 06:00 | D-1 일정 알림톡 발송 |
| `/api/admin/cron/sync-sermons` | `0 6 * * *` | 15:00 | YouTube → `sermon_videos` upsert |

---

## 문서

| 문서 | 내용 |
|---|---|
| [`ARCHIT.md`](./ARCHIT.md) | 디렉토리 구조, 데이터 흐름, 인증·권한 매트릭스, 절기색, 캐싱, 배포 |
| [`API_SPEC.md`](./API_SPEC.md) | 모든 API 라우트 입출력 명세 |
| [`DB_SCHEMA.md`](./DB_SCHEMA.md) | Supabase 테이블·RLS·헬퍼 함수·마이그레이션 이력 |
| [`UPDATES.md`](./UPDATES.md) | 사용자용 변경사항 노트 (`/updates` 페이지 + 관리자 카드의 원본) |
| [`GEMINI.md`](./GEMINI.md) | Gemini CLI 전용 워크플로우·컨벤션 (4단계 하네스) |
| [`AGENTS.md`](./AGENTS.md) | 본 레포에서 작업하는 AI/에이전트의 행동 규칙 |
| [`CLAUDE.md`](./CLAUDE.md) | (Legacy) Claude Code 전용 워크플로우·컨벤션 |
| [`menucategory.md`](./menucategory.md) | (archive) 2025-04 초기 메뉴/콘텐츠 기획서 |

---

## 라이선스 / 운영

- 본 레포는 명성비전교회 내부 운영용. 외부 공개·재사용 전 별도 합의 필요.
- 운영 도메인: `www.msvch.org`.
