# Vercel 연결 CLI용 쇼츠 운영 반영 인계

작성·상태 확인: 2026-10-20 KST. 이 문서는 기존 대화 없이 작업을 이어받기 위한 인계서다. 이번 문서 작성 과정에서는 운영 DB 변경·PR 병합·운영 배포를 실행하지 않았다.

명령 예시는 PowerShell 기준이다. 다른 OS에서는 해당 셸의 동등 명령을 사용하고, 비밀값을 명령 인수나 출력에 넣지 않는 원칙을 유지한다.

## 다음 CLI에 붙여넣을 요청

~~~text
이 저장소의 HANDOFF-shorts-vercel-cli.md를 읽고 쇼츠 시스템의 운영 반영을 이어서 마무리해줘.
이 CLI에는 Vercel이 연결되어 있으니 현재 계정·팀·프로젝트와 GitHub/Supabase 권한부터 검증해.
검증된 기존 구현을 사용하고, 백업과 운영 전환 준비가 끝나면 PR #5 병합,
쇼츠 DB 마이그레이션과 웹 배포를 같은 전환 작업으로 수행해.
실제 영상의 공개 게시, 자동 제작/게시 활성화, 기존 작업 일괄 초기화는 하지 마.
비밀값은 출력하거나 Git에 넣지 말고, 무관한 기능·레이아웃·코드는 변경하지 마.
완료한 검증을 재구현하지 말고 운영 환경 확인에 집중해.
배포 결과·DB 보존 비교·남은 교회 PC/OAuth 작업을 기록하고, 실제로 막힌 권한은 구체적으로 알려줘.
~~~

문서를 읽는 것만으로 운영 변경 권한을 얻는 것은 아니다. 위와 같은 운영 마무리 요청을 사용자가 해당 CLI에 직접 전달한 뒤 실행한다. 이 문서는 추가적인 공개 게시 승인을 포함하지 않는다.

## 1. 목표와 대상

우선 서버를 반영해 교회 Windows 러너를 등록하면 수동 제작을 시작할 수 있게 한다. 자동 제작·공개 게시 활성화와 실제 채널 시험은 후속 단계다.

| 항목 | 확인값 |
|---|---|
| 저장소 | https://github.com/msvchweb/msvch |
| 작업 브랜치 | codex/shorts-automation |
| PR | https://github.com/msvchweb/msvch/pull/5 — OPEN / draft |
| 인계 전 기준 HEAD | ec56a0a4e77dfde8256bfd074aad52abb7fe1d1b — 이 문서 커밋보다 앞선 확인값. 실행 시 최신 PR HEAD 재조회 |
| 구현 실행 코드의 마지막 변경 | 2ac3410 — 이후 ce0a355와 ec56a0a는 문서 변경 |
| 확인 당시 main | b5ff8fbf4fdd86955c2777c0e41835765d0abb8a |
| 운영 웹 | https://www.msvch.org |
| Vercel 팀 / 프로젝트 이름 | msvch / msvch — 기존 빌드 링크 기준, 인증 CLI에서 Git 연결·도메인·프로젝트 ID 재확인 |
| Vercel 요청에서 보고된 대상 팀 ID | team_0Ej1DgbpeiHgeiyxZAulrebU — 새 CLI 조회값과 대조 |
| Supabase | prqebmdejdvbtkhabtfy / msvchDB / ap-northeast-2 |
| 기존 로컬 원본 저장소 | D:\workspace\msvch |
| 기존 구현 작업 공간 | C:\Users\Administrator\.codex\worktrees\shorts-automation\msvch |

Vercel이 어떤 계정으로 로그인되어 있다는 사실과 위 팀의 운영 프로젝트를 관리할 권한은 구분한다. 다른 프로젝트를 새로 만들거나 다른 Supabase 프로젝트로 대체하지 않는다.

## 2. 이미 완료한 일과 재개 지점

- 설교 구간 선정·실제 자막·제작 시도/재시도·검수 수정/승인·플랫폼별 예약·게시 복구·자동 검색의 코드 구현과 최종 검토 수정은 끝났다.
- Windows/Linux Node 24에서 npm ci, 전체 테스트 206개, 타입 검사를 통과했다. Windows 린트는 오류 0·기존 무관 경고 9개, 프로덕션 빌드 통과. 합성 FFmpeg의 두 편집 경로도 별도 통과했다.
- 실제 PostgreSQL 다중 연결에서 생성/게시 획득·한도·검수 경합·lease 복구·RLS를 검증했다. 중요 검토 문제 3건도 수정했다. 추가적인 전체 설계·구현·최종 리뷰를 처음부터 반복할 단계가 아니다.
- 운영 쇼츠 3개 테이블의 실제 구조·정책과 작업 14개/클립 14개를 로컬 PostgreSQL 17.10에 복원했다. 선행 042와 신규 두 마이그레이션, 모든 기존 필드 보존, 역할별 접근, 동시 게시 획득, 비공개 시험 분리 검증을 통과했다.
- 원본 서버는 PostgreSQL 17.6이며 로컬 Auth UID/profiles는 최소 fixture를 썼다. 같은 Supabase 서버·Data API·실제 회원 세션을 검증한 결과와 구분한다.
- 인계용 SQL 묶음도 같은 실제 스냅샷에서 8개 검증을 통과했다. 실패 시 전체 이행 rollback과 이미 적용된 DB 재실행 거부를 포함한다.
- ec56a0a의 Vercel Preview 빌드와 Preview Comments는 SUCCESS였다. 이것은 운영 DB 적용·운영 배포·실제 계정 업로드의 증거가 아니다.
- 보류된 경미한 문제 1건: 다른 클립을 예약 없이 승인하면 작업 전체의 published 표시가 다음 예약/완료 전이 전까지 늦게 갱신될 수 있다. 개별 게시 보호는 유지된다. 이번 인계 범위에서 임의로 확대 수정하지 않는다.

**재개 지점은 Vercel 운영 환경 확인 → 전환 직전 백업/점검 → DB·웹 전환이다.**

앞선 로컬 환경에서는 Vercel 커넥터가 해당 팀 조회에서 403이었고, CLI에는 인증이 없었다. CLI 자동 로그인은 한국어 호스트명이 포함된 HTTP 헤더 오류도 보였다. 이것은 이전 환경의 차단 기록이다. 이미 로그인된 새 CLI에서는 자체 자격증명으로 먼저 확인하고, 같은 실패를 무작정 반복하지 않는다.

## 3. 아직 완료되지 않은 운영 상태

- 운영에는 highlight_count 컬럼, shorts_job_attempts, shorts_publications가 없었다. supabase_migrations.schema_migrations도 없었다. 운영 DB는 아직 변경하지 않았다.
- 확인 당시 작업 14개·클립 14개이며 작업 상태는 failed 8, pending 3, ready_for_review 3이었다. 고정값이 아니므로 전환 직전에 재조회한다. pending 3건을 실행 중이라고 단정하거나 일괄 실패 처리하지 않는다.
- 별도 Supabase 시험 DB와 시험 브랜치는 없다. 사용자는 추가 비용 없는 로컬 복제본 검증을 선택했다. 새 유료 프로젝트/브랜치를 생성하지 않는다.
- 저장소 수준 러너 조회는 0대였다. 조직 수준 조회는 현재 토큰의 admin:org 부족으로 실패했으므로 조직 전체에 러너가 없다고 단정하지 않는다.
- 사용자는 준비 후 교회 PC에서 설치할 예정이다. 이 PC에 교회용 러너를 대신 등록하지 않는다.
- 기존 정기 DB backup 실행은 실패했고 SUPABASE_DB_URL Secret도 목록에 없었다. 정기 백업이 정상이라고 간주하지 않는다. 이번 범위를 교회 전체 백업 시스템 개편으로 확장하지 않는다.
- 실제 설교의 의미·자막·입 모양 검수, YouTube/Instagram OAuth, 실계정 업로드와 교회 PC를 끈 예약 게시 시험은 아직 하지 않았다.

## 4. 코드와 인증 확인

같은 컴퓨터라면 위 기존 작업 공간과 Supabase CLI 인증을 재사용할 수 있다. 다른 컴퓨터의 Vercel 로그인은 GitHub/Supabase 로그인까지 이전하지 않는다.

~~~powershell
git status --short --branch
git remote -v
gh auth status
gh pr view 5 --repo msvchweb/msvch --json headRefOid,baseRefOid,state,isDraft,mergeable,statusCheckRollup
vercel --version
vercel whoami
vercel --scope msvch project list
~~~

Supabase CLI는 확인 당시 2.121.0이었으며 SELECT 1이 성공했다. 새 환경에서는 해당 CLI의 도움말을 확인하고 교회 프로젝트 접근을 다시 검증한다. 서비스 역할 API 키는 Supabase Management API 로그인 토큰과 다르다.

~~~powershell
supabase --version
supabase db query --help
supabase db query --linked --project-ref prqebmdejdvbtkhabtfy 'SELECT 1 AS connection_ok'
~~~

CLI가 PATH에 없고 같은 PC를 사용하는 경우 확인된 실행 파일은 아래에 있다. 다른 PC에 이 경로가 있다고 가정하지 않는다.

~~~text
C:\Users\Administrator\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe
~~~

실행 시점 HEAD와 원격 main이 달라졌다면 차이를 먼저 읽는다. 기존 로컬 변경을 reset/clean으로 지우지 않는다. 이 문서와 연결된 RUNBOOK/RESEARCH/CHURCH-PC-START는 Git에 있지만 PLAN과 .superpowers 검증 작업물은 Git에서 제외되어 있다. 새 clone에서 PLAN이 없다고 진행을 중단하지 않는다.

**배포 소스는 깨끗한 clone을 권한다.** 기존 작업 공간에는 Git에서 제외된 운영 스냅샷·로컬 PostgreSQL 파일이 있다. 그것들을 배포하거나 다른 CLI 환경으로 통째로 복사하지 않는다.

~~~powershell
$shortsReleaseRoot = Join-Path ([IO.Path]::GetTempPath()) ('msvch-shorts-release-' + [guid]::NewGuid().ToString('N'))
git clone --branch codex/shorts-automation https://github.com/msvchweb/msvch.git $shortsReleaseRoot
Set-Location $shortsReleaseRoot
git status --short --branch
git rev-parse HEAD
vercel link --scope msvch --project msvch
~~~

기존 프로젝트를 선택하고 연결된 project ID·Git 저장소·운영 도메인을 확인한다. 미확인 신규 프로젝트 생성이나 개인 기본 팀으로의 배포를 진행하지 않는다. 설치된 CLI의 --help를 우선한다.

## 5. 환경변수와 자격증명

Vercel과 GitHub Actions는 별도 저장소다. GitHub Secret이 있다는 사실로 Vercel Production 설정이 완료됐다고 판단하지 않는다.

~~~powershell
vercel env ls production --scope msvch
gh secret list --repo msvchweb/msvch
gh variable list --repo msvchweb/msvch
~~~

| 위치/단계 | 확인할 설정 |
|---|---|
| Vercel: 관리자 인증·DB | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY |
| Vercel: 제작·게시 dispatch | GITHUB_PAT, SHORTS_WORKFLOW_REF |
| Vercel: 미리보기 URL | NEXT_PUBLIC_CDN_BASE_URL |
| 제작 Actions | .github/workflows/sermon-shorts.yml의 Supabase/R2/Gemini/Groq/CDN Secrets |
| 검색/점검 Actions | YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID. 자동 검색 OFF를 유지 |
| 게시 Actions·OAuth 도구 | SHORTS_CREDENTIAL_ENCRYPTION_KEY, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_CHANNEL_ID |
| Instagram 게시 Actions | INSTAGRAM_ACCOUNT_ID Secret, INSTAGRAM_API_VERSION repository variable |
| Instagram 최초 연결 도구 | INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI와 위 계정·버전 설정 |

- Vercel의 Supabase URL이 prqebmdejdvbtkhabtfy를 가리키는지 확인한다. 서버 키를 NEXT_PUBLIC_ 이름으로 넣지 않는다.
- GITHUB_PAT는 msvchweb/msvch의 Actions 읽기/쓰기와 필요한 저장소 조회 권한을 가진 서버용 토큰이다. Actions 내부에서는 github.token을 쓰므로 같은 이름의 GitHub Secret을 추가할 필요는 없다.
- SHORTS_WORKFLOW_REF는 최종 main으로 맞춘다. PR의 새 workflow와 main의 구버전 workflow가 섞인 동안에는 제작/게시 요청을 보내지 않는다.
- 확인 당시 제작용 Secret 이름은 등록돼 있었다. 게시용 암호화 키·YouTube OAuth 3종·Instagram 계정과 버전 변수는 없었다. 실시간으로 다시 확인하고, 수동 제작의 선행 조건과 후속 게시 조건을 구분한다.
- 암호화 키는 32바이트 난수의 base64이며 OAuth 연결 도구와 게시 워커가 같은 값을 써야 한다. 기존 암호화 연결/checkpoint가 있다면 무작정 교체하지 않는다.
- 이미 있는 비밀값을 문서·명령 인수·로그에 출력하지 않는다. 관리 환경에서 읽을 수 없는 Secret을 빈 문자열로 덮어쓰지 않는다. 환경변수 변경은 새 배포에 반영되므로 필요한 설정을 끝낸 뒤 후보를 빌드한다. [Vercel 공식 설명](https://vercel.com/docs/environment-variables/managing-environment-variables)

현재 확인된 채널 ID 후보는 UCcJc6fm6McCxvpizoe3T4YQ다. 실제 교회 채널 관리 권한과 OAuth 응답의 채널을 대조한 후 사용한다. 계정 동의가 없으면 임의로 대신 연결하지 않는다.

## 6. 백업과 DB 사전 점검

1. 새 제작 요청을 잠시 중단하고 GitHub의 실제 제작 실행이 없는지 확인한다. DB pending 표시만으로 실행 여부를 판단하지 않는다.
2. Supabase 프로젝트를 확인하고 shorts_jobs/shorts_clips/shorts_settings 전체 행과 구조·제약·정책·권한을 전환 직전에 다시 보관한다. 단순 행 수나 hash는 복구용 백업이 아니다.
3. 백업은 로컬 보호 경로 또는 승인된 비공개 저장소에 보관한다. 이 쇼츠 3개 테이블 기록을 전체 교회 DB 백업이라고 부르지 않는다.
4. 원격 스키마가 최초 확인과 다르거나 부분 이행되어 있으면 차이를 분석한 후 계획을 조정한다. 이미 이행된 파일을 반복 적용하지 않는다.

~~~powershell
gh run list --repo msvchweb/msvch --workflow sermon-shorts.yml --status in_progress
gh run list --repo msvchweb/msvch --workflow sermon-shorts.yml --status queued
~~~

waiting/requested/pending 등 다른 대기 상태와 Actions 화면도 확인한다. 시간만 지났다는 이유로 기존 작업을 취소하거나 실패로 바꾸지 않는다.

Supabase db dump를 사용할 경우 해당 환경의 DB 접속·Docker/pg_dump 요건부터 확인한다. 성공하지 않은 dump나 이름만 있는 백업 파일을 근거로 운영을 변경하지 않는다. 같은 PC에는 아래의 실제 복제 검증 자료가 있으나 전환 직전 백업을 대체하지 않는다.

~~~text
C:\Users\Administrator\.codex\worktrees\shorts-automation\msvch\.superpowers\sdd\PLAN-shorts-automation\production-shorts-snapshot.sql
C:\Users\Administrator\.codex\worktrees\shorts-automation\msvch\.superpowers\sdd\PLAN-shorts-automation\production-shorts-snapshot.json
C:\Users\Administrator\.codex\worktrees\shorts-automation\msvch\.superpowers\sdd\PLAN-shorts-automation\live-snapshot-verification.json
~~~

스냅샷 SQL은 쇼츠 3개 테이블의 행·구조·정책·권한과 관리 helper를 읽는다. PowerShell의 날짜 자동 변환을 피하려면 CLI 원본 JSON 문자열을 그대로 파일로 저장한다.

운영 정책은 초기 005 SQL과 달랐고 is_staff()도 참조했다. 복원할 때 is_staff()와 is_admin_or_master() 등 실제 helper 의존성을 함께 확보한다. 같은 PC의 추가 helper/시간대 기록은 위 작업 폴더의 production-shorts-dependencies.json에 있다. 회원 행을 검증용으로 통째로 복사하지 않는다.

## 7. 적용할 SQL

순서는 아래와 같다. highlight_count가 이미 있으면 042의 IF NOT EXISTS 동작과 현재 정의를 확인한다.

1. supabase/migrations/042_shorts_highlight_count.sql
2. supabase/migrations/20261018231828_shorts_generation_reliability.sql
3. supabase/migrations/20261018233233_shorts_publications.sql

운영에는 migration history 테이블이 없었으므로 **저장소 전체 supabase db push를 실행하지 않는다.** 005 등 기존 테이블을 만드는 파일을 재실행하지 않는다.

같은 PC의 검증된 적용 묶음은 아래에 있다. 먼저 내용을 읽고 현재 Git 원본 3개와 대조한다. 그 파일이 없는 새 환경에서는 원본 세 파일을 하나의 트랜잭션으로 묶고 아래 검사를 포함한 실행 파일을 준비·검증한다.

~~~text
C:\Users\Administrator\.codex\worktrees\shorts-automation\msvch\.superpowers\sdd\PLAN-shorts-automation\church-handoff\APPLY-SHORTS-MIGRATIONS.sql
~~~

검증된 묶음은 BEGIN/COMMIT, 잠금/실행 시간 제한, 대상 legacy 구조와 활성 제작 단계 검사, 기존 모든 행/필드 보존 검사, 자동 스위치 OFF와 transcript 변환 검사를 포함한다. 검사 실패는 전체 트랜잭션을 취소하고, 이미 이행된 DB 재실행은 거절한다. 기존 데이터가 다르면 정상적인 차이인지 확인한 뒤 새 기준값으로 검증한다.

새 clone에서도 세 원본 마이그레이션은 Git에 있다. 기존 SQL 묶음이 없으면 이 문서 부록의 PowerShell로 검증된 wrapper를 재생성한다. 현재 스냅샷 기준 보존 hash는 4f8498dba113c58cef45b42aa1912df8d23890297859a8e62344e1193b7349d4이며 새 실행의 고정 합격값으로 쓰지 않는다.

## 8. DB와 웹을 같은 전환 작업으로 반영

핵심은 운영 환경으로 빌드된 후보를 먼저 준비하고, DB 적용 뒤 호환 웹을 빠르게 전환하며, GitHub main의 workflow까지 일치시키는 것이다. 작업 중에는 새 제작·예약 요청을 보내지 않는다.

### 8-1. 후보 준비

- 대상 계정·팀·프로젝트·최신 PR HEAD와 운영 환경변수를 확인한다.
- 현재 소스/환경에서 필요한 npm ci, 테스트·타입 검사·빌드를 확인한다. 코드 수정이 필요하면 관련 Next.js 번들 문서를 먼저 읽고 변경 범위만 검증한다.
- 현재 운영 배포 ID/URL과 Git SHA, 후보의 소스 HEAD를 기록한다.
- 도메인을 바꾸지 않고 Production 환경의 후보를 빌드한다.

~~~powershell
$shortsCandidateHead = git rev-parse HEAD
vercel deploy --prod --skip-domain --scope msvch
~~~

출력된 실제 후보 URL을 기록하고 inspect로 READY, 프로젝트, Production 환경을 확인한다. Preview 빌드의 단순 승격으로 대신하지 않는다. [skip-domain](https://vercel.com/docs/cli/deploy#skip-domain), [promote](https://vercel.com/docs/cli/promote)

이 시점에는 운영 DB가 구형이므로 새 DB 기능의 종단 성공을 주장하지 않는다. 후보 빌드 실패·환경변수 누락·전환 권한 부족을 해결하기 전 DB를 변경하지 않는다.

### 8-2. 짧은 전환 구간

1. GitHub 실행 없음·백업 유효성·운영 프로젝트·후보 READY와 PR HEAD가 후보 소스와 같음을 마지막으로 확인한다.
2. 준비한 SQL을 교회 프로젝트에 **한 트랜잭션**으로 적용한다. 쿼리 오류나 응답 유실 시 실제 적용 상태부터 조회하며 즉시 재적용하지 않는다.
3. 보존 검사와 새 테이블·설정을 확인하고, 준비된 호환 웹 후보를 바로 승격한다.

~~~powershell
# $shortsCandidateUrl에는 8-1에서 실제 반환된 후보 URL만 지정한다.
vercel promote $shortsCandidateUrl --scope msvch
~~~

4. PR HEAD가 검증한 후보와 같은지 확인하고 draft를 해제한 뒤 PR #5를 병합한다. 코드나 다른 변경이 끼어들면 다시 비교한다. 브랜치는 현장 안내에서 사용하므로 삭제하지 않는다.

~~~powershell
$shortsVerifiedHead = (gh pr view 5 --repo msvchweb/msvch --json headRefOid --jq '.headRefOid')
if ($shortsVerifiedHead -ne $shortsCandidateHead) { throw 'PR HEAD changed after candidate build; reconcile before merge.' }
gh pr ready 5 --repo msvchweb/msvch
gh pr merge 5 --repo msvchweb/msvch --squash --match-head-commit $shortsVerifiedHead
~~~

5. 병합으로 발생한 Vercel Git 배포도 확인한다. Production의 최종 도메인이 어느 배포·커밋을 가리키는지 추적한다. 이전에 자동 도메인 할당이 꺼져 있었다면 검증된 main 배포를 명시적으로 승격한다.
6. main의 세 쇼츠 workflow와 Vercel SHORTS_WORKFLOW_REF=main이 일치한 뒤 새 관리자 작업을 허용한다.

DB·도메인 전환·Git 병합은 여러 서비스에 걸쳐 있어 원자적이지 않다. 전환 중 어느 단계가 실패하면 새 제작을 계속 중단하고 적용된 상태와 미완료 단계를 기록한다. 실패한 상태를 두고 교회 사용 준비가 완료됐다고 보고하지 않는다.

## 9. 전환 후 확인

아래는 각각 확인하며, 빌드 성공만으로 대체하지 않는다.

- 전환 직전 대비 작업/클립/설정의 **기존 모든 필드**가 같고 ID·URL·기존 transcript가 보존되는지 비교한다. 현재 행 수 14/14는 재조회한 기준값과 다를 수 있다.
- 신규 테이블 4개(shorts_job_attempts, shorts_connections, shorts_publications, shorts_publish_private)와 서버 전이 함수가 존재하고 API에서 사용할 수 있는지 확인한다.
- 기존 transcript가 selection_reason으로 보존되고 transcript_status=unverified인지 확인한다. 검증 없이 기존 클립을 자동 승인·게시하지 않는다.
- auto_publish=false, publishing_enabled=false, auto_generate_enabled=false, bgm_enabled=false를 확인한다. 기존 auto_publish가 true이면 이유를 확인하고 합의 없이 묶음을 억지로 통과시키지 않는다.
- https://www.msvch.org/admin/shorts에서 admin/master로 목록·설정·기존 미리보기를 확인한다.
- GET /api/shorts/settings: 미로그인 401, staff 403, admin/master 정상 응답을 확인한다. GET /api/shorts는 공개 게시분 조회를 허용하는 별도 동작이므로 미로그인 401을 기대하지 않는다.
- 비밀 테이블과 credentials/checkpoint가 브라우저 응답에 포함되지 않는지 확인한다. native 테스트만으로 Supabase Data API 노출·스키마 캐시까지 검증했다고 간주하지 않는다.
- main의 게시 workflow를 dry-run으로 실행하고 외부 업로드·claim·게시 상태 변경이 없는지 확인한다.

~~~powershell
gh workflow run shorts-publish.yml --repo msvchweb/msvch --ref main -f mode=dry-run
gh run list --repo msvchweb/msvch --workflow shorts-publish.yml --limit 3
~~~

실제 private-test/live 워커는 GitHub 실행 ID를 요구한다. 로컬에서 환경변수를 위조해 게시 실행 제한을 우회하지 않는다. dry-run 성공은 OAuth·실제 업로드 성공을 입증하지 않는다.

## 10. 교회 PC와 게시 계정의 후속 작업

교회 현장 설치는 CHURCH-PC-START.md를 따른다. 사용자는 휴대폰에서 GitHub 안내를 보면서 설치할 예정이다.

- Node 24, Git, yt-dlp, FFmpeg/ffprobe, 모든 사용자용 Noto Sans CJK KR 글꼴.
- Windows 서비스 러너: 이름 church-shorts, 라벨 shorts,church. 서비스 재부팅 뒤 Online과 실제 Actions의 Preflight를 확인한다.
- 서버 전환 후 실제 설교 1편을 5개로 수동 제작하고 의미·자막·구도·싱크를 사람이 검수한다. 교회 PC가 없으면 이 검증은 미완료로 남긴다.
- YouTube는 관리자 채널 대조·OAuth 후 비공개 1건과 재개/복구를 확인한다. Instagram에는 같은 의미의 비공개 릴스 시험이 없다.
- 공개할 계정·클립에 대한 사용자 의도가 확인된 뒤 실제 게시를 시험한다. PC를 끈 예약 게시 시험도 실제 계정 준비 후에 한다.
- BGM 이용 조건 확인 전 OFF, 미검수 자동 게시 OFF를 유지한다. 자동 검색은 설교 전용 재생목록·허용 분류·활성화 기준을 확인한 뒤 별도 활성화한다.

## 11. 실패 시 복구와 완료 보고

- DB 트랜잭션이 실패했다면 rollback과 현재 구조를 확인한다. 테이블 삭제·파괴적 down migration·기존 클립 삭제로 되돌리지 않는다.
- DB 적용 후 웹 전환이 실패했다면 준비한 새 스키마 호환 후보의 배포/승격을 복구한다. 구형 b5ff8fb 웹만 무작정 rollback하면 새 RLS와 맞지 않는다.
- 게시 스위치는 OFF를 유지한다. 암호화 key/checkpoint와 불확실 게시 결과를 지우지 않는다.
- Vercel 환경변수를 고쳤다면 해당 환경으로 새 후보를 빌드한다. 이전 배포에 새 값이 소급 반영됐다고 가정하지 않는다.
- 실제 배포 URL·프로젝트 ID·Git SHA·병합 SHA·적용 SQL·백업 위치·보존 비교·API 검사·workflow 결과를 기록한다. 비밀값이나 회원 자료를 결과 보고에 넣지 않는다.
- 완료 상태를 **서버 운영 반영**, **교회 PC 실제 제작**, **실계정 게시**로 나눠 보고한다. 실행하지 못한 하드웨어·사람 검수·OAuth는 완료 처리하지 않는다.

관련 문서: RUNBOOK-shorts-automation.md, CHURCH-PC-START.md, RESEARCH-shorts-automation.md. AGENTS.md의 쇼츠 범위 제한을 지키고 무관한 리팩터링·기능·레이아웃 변경을 하지 않는다.

## 부록: 새 환경에서 적용 SQL 재생성

아래는 기존 검증 묶음의 wrapper를 그대로 사용하는 생성 명령이다. 저장소 루트의 PowerShell에서 실행한다. 임시 SQL 파일만 생성하며 **DB에 실행하지 않는다**. 생성된 SQL을 읽고 원본·백업·현재 DB 사전 조건을 확인한 뒤 8번의 전환 구간에서 사용한다.

~~~powershell
$shortsMigrationFiles = @(
    '042_shorts_highlight_count.sql',
    '20261018231828_shorts_generation_reliability.sql',
    '20261018233233_shorts_publications.sql'
)
$shortsSqlHeader = @'
-- Target: Supabase prqebmdejdvbtkhabtfy / msvchDB.
-- Prepared only: do not apply before backup, GitHub idle check and coordinated web rollout.
-- Generated from the three existing, locally validated Shorts migration files.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
do $guard$
begin
  if to_regclass('public.shorts_jobs') is null or to_regclass('public.shorts_clips') is null
     or to_regclass('public.shorts_settings') is null then
    raise exception 'shorts_legacy_schema_missing';
  end if;
  if to_regclass('public.shorts_job_attempts') is not null
     or to_regclass('public.shorts_publications') is not null then
    raise exception 'shorts_already_migrated_or_partial_schema';
  end if;
  if exists(select 1 from public.shorts_jobs where status in ('downloading','transcribing','selecting','editing')) then
    raise exception 'active_legacy_generation_requires_operator_check';
  end if;
  if (select count(*) from public.shorts_settings where id=1) <> 1 then
    raise exception 'shorts_settings_missing';
  end if;
end $guard$;
-- Preserve the exact pre-migration values for transaction-local assertions.
create temporary table shorts_release_before on commit drop as
  select 'shorts_jobs'::text as table_name,id::text as row_id,to_jsonb(t) as data from public.shorts_jobs t
  union all select 'shorts_clips',id::text,to_jsonb(t) from public.shorts_clips t
  union all select 'shorts_settings',id::text,to_jsonb(t) from public.shorts_settings t;
'@
$shortsSqlFooter = @'
-- All prior rows/fields must still exist with exactly the same JSON values.
do $verify$
declare v_before record; after_row jsonb; v_table text; before_count bigint; after_count bigint;
begin
  for v_before in select * from shorts_release_before loop
    execute format('select to_jsonb(t) from public.%I t where id::text=$1', v_before.table_name)
      into after_row using v_before.row_id;
    if after_row is null or exists(
      select 1 from jsonb_each(v_before.data) e where (after_row->e.key) is distinct from e.value
    ) then raise exception 'legacy_shorts_value_changed_in_%', v_before.table_name; end if;
  end loop;
  foreach v_table in array array['shorts_jobs','shorts_clips','shorts_settings'] loop
    select count(*) into before_count from shorts_release_before s where s.table_name=v_table;
    execute format('select count(*) from public.%I', v_table) into after_count;
    if before_count <> after_count then raise exception 'legacy_shorts_count_changed_in_%', v_table; end if;
  end loop;
  if exists(select 1 from public.shorts_settings
    where auto_publish or publishing_enabled or auto_generate_enabled or bgm_enabled) then
    raise exception 'automatic_switch_not_off';
  end if;
  if exists(select 1 from public.shorts_clips where transcript_status<>'unverified'
    or selection_reason is distinct from transcript) then
    raise exception 'legacy_transcript_conversion_mismatch';
  end if;
end $verify$;
commit;
select 'migration_applied_switches_off' as result,
  (select count(*) from public.shorts_jobs) as jobs_count,
  (select count(*) from public.shorts_clips) as clips_count;
'@
$shortsSqlParts = @($shortsSqlHeader)
foreach ($shortsMigrationFile in $shortsMigrationFiles) {
    $shortsMigrationPath = Join-Path 'supabase/migrations' $shortsMigrationFile
    if (-not (Test-Path -LiteralPath $shortsMigrationPath)) { throw ('Missing migration: ' + $shortsMigrationFile) }
    $shortsSqlParts += ('-- Source migration: ' + $shortsMigrationFile)
    $shortsSqlParts += [IO.File]::ReadAllText((Join-Path (Get-Location) $shortsMigrationPath))
}
$shortsSqlParts += $shortsSqlFooter
$shortsReleaseSql = Join-Path ([IO.Path]::GetTempPath()) ('msvch-shorts-apply-' + [guid]::NewGuid().ToString('N') + '.sql')
[IO.File]::WriteAllText($shortsReleaseSql, ($shortsSqlParts -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
Write-Output $shortsReleaseSql
Get-FileHash -LiteralPath $shortsReleaseSql -Algorithm SHA256
~~~

8번의 사전 조건과 후보 READY를 모두 확인한 뒤에만, 생성된 실제 파일을 대상으로 실행한다.

~~~powershell
supabase db query --linked --project-ref prqebmdejdvbtkhabtfy --file $shortsReleaseSql
~~~

적용 오류·연결 끊김 뒤에는 먼저 대상 테이블과 기존 값 보존 상태를 조회한다. 성공 메시지를 못 받았다는 이유만으로 재실행하지 않는다.
