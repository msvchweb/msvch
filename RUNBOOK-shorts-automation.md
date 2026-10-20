# 설교 쇼츠 운영 절차

작성 2026-10-19, 로컬 배포 준비 점검 2026-10-20(KST). 로컬 구현과 실제 운영 확인을 구분한다. 초기 자동 제작·게시·배경음은 OFF.

교회 현장의 설치·등록·첫 제작 순서는 [교회 PC 시작 안내](CHURCH-PC-START.md)를 먼저 따른다.

Vercel 권한이 있는 다른 CLI에서 운영 반영을 이어받을 때는 [CLI 인계서](HANDOFF-shorts-vercel-cli.md)를 사용한다.

## 현재 확인 상태

- Windows 로컬 단위/DB 엔진/합성 렌더 검증 및 최종 코드 검토·중요 문제 수정 완료. 운영 DB 마이그레이션·배포·실제 게시 미실행.
- 교회 PC 접근, 대상 채널 OAuth 연결, 실제 설교의 입 모양·자막 검수는 운영 전 확인 필요.
- SQL/RLS는 PGlite와 별도 PostgreSQL 17.10에서 검증. 실제 다중 연결의 생성·게시 획득·일일 상한·검수 경합과 역할별 권한을 확인함.
- Windows Node 24.11.0/npm 11.6.1과 Linux Node 24.22.0/npm 11.19.1에서 npm ci·전체 테스트 206개·타입 검사 통과. 세 쇼츠 Actions는 검증된 lockfile을 사용하는 npm ci로 전환했다.
- GitHub 스케줄은 15분 간격 점검이며 정각 발행을 보장하지 않는다.

## 교회 PC 설치

1. Windows 버전, CPU/RAM, 여유 디스크(긴 원본 여러 편을 보관할 공간), 방송 겸용 여부, 운영 시간, 담당자, Windows 서비스 계정을 기록한다.
2. GitHub 개인 계정 ymg0924로 msvchweb/msvch의 Settings → Actions → Runners에 접근한다. 2026-10-19에도 저장소 admin/조직 Owner가 확인됐으며 설치 시 재확인한다. 다른 Owner 비밀번호 복구는 선행 조건이 아니다.
3. New self-hosted runner → Windows x64 안내의 다운로드·등록 명령을 실행한다. 등록 토큰은 일회성/단기이므로 문서에 저장하지 않는다. 라벨 shorts를 추가한다.
4. 서비스로 설치하고 Windows 재부팅 뒤 로그온 전 Online을 확인한다. 두 PC를 함께 쓸 경우 교회 PC에 church 라벨을 추가하고 제작 워크플로의 runs-on에도 church를 추가한다.
5. 해당 서비스 계정의 PATH에 Node 24, yt-dlp, FFmpeg와 ffprobe를 설정하고 Noto Sans CJK KR 글꼴을 모든 사용자용으로 설치한다. 작업 경로와 임시 경로 쓰기·외부 HTTPS 통신을 확인한다.
6. 서비스 계정에서 node --import tsx scripts/shorts/preflight.ts --tools-only 실행. 실제 작업에서는 Actions Secrets가 주입된 전체 preflight가 실행된다.
7. 개인 PC 러너를 끈 상태에서 관리자 화면에서 설교 한 편을 수동 제작한다. R2 미리보기, 실제 발언, 입 모양/자막, 길이, 수정 후 재승인을 확인한다.
8. 의도적인 실패를 만든 뒤 해당 작업의 다시 제작만 실행한다. 다른 작업·기존 클립·과거 URL이 보존돼야 한다.

## 로그인과 비밀 설정

- GitHub: 러너 등록 때 관리자 계정 로그인 필요. 서비스 실행 중 브라우저 로그인 유지 불필요.
- Google/YouTube: 계정 연결 때 교회 채널 권한이 있는 Google 계정 필요. 일반 Gmail 계정 로그인만으로 대상 채널 권한이 생기지는 않는다.
- Instagram: 프로페셔널 계정과 Meta 앱의 게시 권한이 필요. 연결 방식은 Instagram Login.
- Supabase, R2, Groq, Gemini: 기존 API 키를 Secrets로 주입하며 교회 PC에서 대시보드 상시 로그인 불필요.
- 비밀값은 Git, 문서, 화면, 채팅에 복사하지 않는다. 키 존재 여부만 점검하고 실제 유효성은 해당 단계 시험으로 확인한다.
- 제작 Secrets: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GROQ_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_CDN_BASE_URL.
- 웹 제작 dispatch에는 GITHUB_PAT(Actions write)가 필요하다. SHORTS_WORKFLOW_REF는 기본 main이며 배포된 코드와 일치해야 한다.

## 생성 복구

- pending/queued 상태로 90분 이상 기다리면 PC/Actions 대기열을 확인한다. 오프라인만으로 실패 처리하지 않는다.
- maintenance는 실제 GitHub 실행의 실패/취소/시간초과를 확인한 시도만 종료한다. 응답이 끊긴 dispatch를 무작정 다시 보내지 않는다.
- 특정 작업 확인: node --import tsx scripts/repair-shorts-jobs.ts --jobId=UUID
- failed 작업은 관리자 화면의 다시 제작. 승인된 클립이 있으면 전체 재생성하지 않는다.
- 새 시도는 별도 임시 폴더와 R2 URL을 사용한다. 검수 포인터는 새 제작 성공 시에만 전환한다.
- 임시 폴더는 서비스 계정 TEMP/shorts/jobId/attemptId. 자동으로 다른 시도의 폴더를 삭제하지 않는다. 종료 상태와 보존 필요를 확인한 뒤 운영자가 개별 폴더를 정리한다.
- R2 키가 이미 존재하는데 DB 저장이 유실됐다면 새 시도로 재생성한다. 기존 immutable URL의 파일은 덮어쓰지 않는다.

## 운영 활성화 순서

수동 제작 → 교회 PC 운영 검증 → YouTube 비공개 시험 → 승인한 영상의 YouTube 게시 → Instagram 게시 → 설교 재생목록 자동 제작.
각 단계는 실제 확인 후 활성화한다. BGM 사용 권한 확인 전 bgm_enabled=false, 미검수 자동 게시 auto_publish=false를 유지한다.

## 스키마·배포 전환

1. 운영 DB를 변경하기 전에 별도 시험 DB에서 선행 스키마와 두 신규 마이그레이션을 순서대로 검증한다. 기존 샘플 ID·영상 URL·선정 이유가 보존되는지 확인한다. 2026-10-20 운영 조회에서는 highlight_count 컬럼과 supabase_migrations.schema_migrations 테이블이 모두 없었다. 저장소의 모든 마이그레이션을 db push로 일괄 적용하지 않으며, 전환 직전에 현재 스키마를 다시 확인한다.
2. 서로 다른 두 DB 연결에서 같은 job의 shorts_create_attempt와 같은 publication의 shorts_claim_publication을 동시에 호출한다. 활성 시도·lease는 하나만 만들어져야 한다. RLS는 anon/member/staff/admin/master/service_role 각각 확인한다.
3. 기본 회귀 테스트는 PGlite를 사용하며, 2026-10-19에는 별도 PostgreSQL 17.10의 실제 다중 연결 경합도 통과했다. 운영 이행 대상 Supabase 시험 DB 확인은 별도로 수행한다.
4. 기존 제작을 잠시 중단하고 실행 중인 GitHub 작업이 종료된 뒤 운영 DB의 jobs/clips 수와 클립별 ID·URL을 보관한다. 조사 시점의 14개는 고정 운영값이 아니므로 전환 직전에 다시 조회한다.
5. highlight_count가 없으면 먼저 042_shorts_highlight_count.sql을 적용한다. 이어서 20261018231828_shorts_generation_reliability.sql → 20261018233233_shorts_publications.sql과 웹 API를 같은 전환 작업으로 적용한다. 새 권한 정책에서는 구버전 API의 직접 쓰기가 차단되므로 구버전 웹과 장시간 혼용하지 않는다.
6. 새 워크플로가 배포되는 main과 웹의 SHORTS_WORKFLOW_REF를 일치시킨다. 세 자동화 스위치는 OFF 상태에서 수동 생성부터 확인한다.
7. 운영 문제 시 publishing_enabled와 auto_generate_enabled를 끄고 새 스키마와 호환되는 API 버전으로 복구한다. 파괴적 down migration이나 기존 클립 삭제로 되돌리지 않는다.

## 게시 계정 연결

공통으로 연결 CLI와 호스팅 게시 워커에 동일한 SHORTS_CREDENTIAL_ENCRYPTION_KEY(32바이트 난수의 base64)를 설정한다. 키 교체 시 기존 연결과 checkpoint를 다시 암호화할 수 없으면 복구할 수 없으므로 안전한 비밀 저장소에서 보관한다. 웹 클라이언트에는 전달하지 않는다.

### YouTube

- Google Cloud에서 YouTube Data API와 Desktop OAuth client를 준비한다. 대상 교회 채널에 접근 가능한 Google 계정으로 연결한다.
- YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_CHANNEL_ID를 연결 환경과 게시 Actions Secrets에 등록한다. 조사한 기존 업로드 목록 기준 채널은 UCcJc6fm6McCxvpizoe3T4YQ이며 실제 채널 관리 화면에서 다시 대조한다.
- 연결: node --env-file=.env.local --import tsx scripts/shorts/connect-youtube.ts
- 도구가 출력한 Google 주소를 브라우저에서 열면 localhost callback을 받는다. state와 PKCE를 확인하며 youtube.force-ssl scope와 실제 채널을 대조한 뒤 offline 자격증명을 암호화 저장한다.
- 동의 화면의 앱 상태·테스트 사용자·권한 검증 조건은 Google 콘솔 기준으로 설정한다. 토큰이 만료·철회되면 화면에 재연결 필요로 표시한다.
- 관리자 화면에서 검증된 클립과 예약 시각을 선택하고 YouTube 비공개 시험으로 1건 예약한다. 게시 스위치를 켠 뒤 private-test workflow를 실행한다.
- test_uploaded는 공개 게시 완료가 아니다. 실제 YouTube Studio의 private 상태와 내용·자막·싱크를 확인한다. 공개 시험은 게시할 클립을 live 예약으로 별도 승인한다.

### Instagram

- 프로페셔널(Business/Creator) 계정과 Instagram Login용 Meta 앱을 준비한다. Facebook Login으로 자동 전환하지 않는다.
- INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_ACCOUNT_ID, INSTAGRAM_REDIRECT_URI, INSTAGRAM_API_VERSION을 연결 CLI 환경에 설정한다.
- INSTAGRAM_REDIRECT_URI는 배포된 HTTPS 주소 /api/shorts/connections/instagram/callback으로 설정하고 Meta 앱에 정확히 같은 URI를 등록한다. 웹 배포가 먼저 필요하다.
- INSTAGRAM_API_VERSION은 Meta 앱에서 지원·검증한 버전을 명시한다. 연결 시 /me의 계정 필드와 OAuth 응답의 부여된 permissions를 실제 계정에서 확인하며 실패하면 연결을 저장하지 않는다.
- 연결: node --env-file=.env.local --import tsx scripts/shorts/connect-instagram.ts
- 도구가 출력한 Instagram 주소를 열고 동의 후 callback 주소 전체를 로컬 도구에 붙여넣는다. 입력은 숨겨지며 서버·도구는 callback code/token을 로그로 출력하지 않는다.
- 도구는 state, 대상 계정, 프로페셔널 유형, OAuth 응답에 실제로 부여된 instagram_business_basic 및 instagram_business_content_publish 권한을 확인하고 long-lived token을 암호화 저장한다.
- 게시 워크플로에는 INSTAGRAM_ACCOUNT_ID Secret과 INSTAGRAM_API_VERSION repository variable을 설정한다. 앱 ID/Secret은 최초 연결에 사용하며 워커의 장기 토큰 갱신에는 주입하지 않는다.
- private 릴스 시험이 있다고 가정하지 않는다. 컨테이너 처리·모킹 검증 후 실제 게시할 영상으로 공개 시험을 한다.

[Google OAuth 문서](https://developers.google.com/identity/protocols/oauth2/native-app), [YouTube 재개 가능한 업로드](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol), [Meta 공식 Instagram Login 권한](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login).

## 클라우드 실행과 새 설교 자동 제작

- shorts-publish.yml: ubuntu-latest, 20분 제한, UTC 7/22/37/52분. 수동 dry-run/private-test/live 모드 지원. private-test는 시험 행만 처리하며 주기 live 실행은 시험 행을 건너뛴다.
- shorts-maintenance.yml: 별도 호스팅 러너, GitHub Actions read/write와 YouTube 조회 권한으로 상태 대조·새 설교 검색을 수행한다.
- 유지보수용 추가 Secret은 YOUTUBE_API_KEY와 YOUTUBE_CHANNEL_ID다. API 키는 채널 조회·재생목록 조회에만 사용한다.
- 관리자의 운영 설정에서 설교 전용 재생목록 ID와 허용 분류를 지정한 뒤 자동 제작을 켠다. 예배 전체 영상은 목록에 넣지 않는다.
- 활성화 이전·3분 이하·다른 채널·목록 밖·진행/예정 라이브·이미 생성한 원본·시스템이 게시한 쇼츠는 제외한다.
- 자동 dispatch가 확정 실패한 작업은 실패 기록을 유지하고 관리자가 재시도한다. 이미 존재하는 작업을 주기 점검이 반복 초기화하지 않는다.
- 업로드 전후에 교회 PC를 끈 상태로 예약 처리와 화면 상태 갱신이 계속되는지 실제 운영 시험을 한다.
- lockfile의 WASM 선택 의존성 두 항목 누락을 보완했다. 기존 패키지 버전은 유지하며 Windows와 Linux 설치 확인 후 세 쇼츠 workflow를 npm ci로 고정했다.

## 중단·부분 실패·결과 불명확

- publishing_enabled=false는 다음 게시 변경 요청 직전에 확인한다. 이미 시작된 외부 요청은 완료될 수 있으므로 플랫폼에 이미 게시된 영상을 자동 삭제하지 않는다.
- 아직 runner가 획득하지 않은 요청은 관리자 화면의 대기 요청 취소로 종료할 수 있다. 특정 작업만 취소하려면 repair-shorts-jobs.ts --jobId=UUID --cancelQueued를 사용한다.
- 실행 중인 제작은 GitHub에서 종료한 뒤 maintenance 대조를 기다린다. 단순 오프라인·오래된 heartbeat만으로 강제 소유권을 바꾸지 않는다.
- YouTube 성공 후 Instagram 실패는 각각 별도 기록한다. 실패한 publication만 재시도하며 성공한 영상을 다시 올리지 않는다.
- YouTube만 게시한 승인 클립은 내용을 수정하지 않고 같은 버전으로 Instagram을 추가 예약할 수 있다. 이미 예약·게시된 대상은 중복 선택할 수 없다.
- YouTube 세션·영상 ID가 있으면 같은 세션/영상에서 상태를 확인한다. 세션 만료로 결과를 알 수 없으면 새 업로드 대신 확인 필요 상태로 멈춘다.
- Instagram 게시 요청의 응답이 유실되면 같은 컨테이너를 무작정 다시 게시하지 않는다. 확인 필요 상태에서 플랫폼의 실제 게시 내역을 대조한다.
- 결과 불명확·checkpoint 저장 실패는 일반 재시도 버튼으로 초기화되지 않는다. 운영자가 실제 provider ID·공개 상태를 확인하고 보존된 checkpoint와 대조해야 한다.
- daily_publish_limit은 한국 날짜와 플랫폼별로 적용한다. 진행·게시·결과 불명확 예약은 한도를 계속 점유하며 시험 업로드는 집계하지 않는다.
- 재연결 후에도 기존 암호화 checkpoint를 삭제하지 않는다. 승인 버전이 바뀐 예약·처리 중인 클립은 서버가 변경을 거부한다.
- 공개 전환·media_publish 요청 전에 public_request_started를 checkpoint와 함께 저장한다. 이후 retry_wait가 되어도 이 표시는 지워지지 않으며 결과 확인 전 수정·반려·예약 취소와 한도 해제를 막는다. 아직 공개 요청을 하지 않은 대기 건은 취소할 수 있다.
- 최초 세션·컨테이너 생성의 명시적인 401/403 응답은 재연결 후 같은 예약에서 다시 시도할 수 있다. 생성 응답 자체가 유실된 경우는 안전한 재시작으로 간주하지 않는다.

## 검증 기록과 운영 전 미완료 항목

- 기본 검증: npm run typecheck, npm run lint, npm test, npm run build.
- 최종 회귀 검증: 206개 통과, 합성 미디어 검증 1개는 기본 실행에서 제외하고 별도 실행 통과. 타입 검사·린트·프로덕션 빌드 통과. 린트의 기존 무관 경고 9개는 이번 범위에서 변경하지 않았다.
- 최종 검토에서 결과 불확실 게시의 수정·취소, 최초 인증 거절 후 재연결, YouTube 게시 후 Instagram 추가 예약을 재현하고 회귀 테스트로 수정했다. 실제 context와 어댑터 결과를 격리 PostgreSQL 전이에 연결해 한도 보존까지 확인했다.
- 보류한 경미한 문제: 다른 클립을 예약 없이 승인하면 작업 전체의 published 표시가 예약/완료 전이 때까지 갱신되지 않을 수 있다. 개별 클립 승인·게시 기록과 실제 업로드 제한은 별도로 유지된다.
- 실제 FFmpeg 경로 검증: SHORTS_MEDIA_TEST=1을 설정하고 scripts/shorts/render.integration.test.ts 실행. 두 편집 경로의 코덱·해상도·48kHz AAC·길이를 확인한다. 실제 사람의 입 모양·발언 의미 검수는 별도로 필요하다.
- 현재 미완료: 원격 Supabase 시험 DB 검증·운영 DB 적용, 교회 PC 서비스·재부팅·네트워크·디스크 검증, Noto Sans CJK KR 설치, 실제 설교 검수, YouTube/Instagram OAuth와 실계정 게시, PC 종료 상태 예약 시험.
- 자동 제작·게시·배경음은 실제 단계별 확인 전 OFF를 유지한다.

### 2026-10-20 로컬 배포 준비 점검

- 최초 점검에서는 사용자 선택에 따라 원격 시험 DB 생성·변경과 운영 반영을 보류하고 로컬 검증만 진행했다. 당시 Supabase 커넥터의 프로젝트 목록에 교회 프로젝트가 없었으며 CLI 로그인도 없었다. 이후 CLI 연결과 운영 데이터의 로컬 복제본 검증 결과는 아래에 기록한다.
- Ubuntu WSL2의 별도 홈 캐시 디렉터리에 공식 SHA-256을 확인한 Linux Node 24를 설치하고 커밋된 소스만 추출했다. 운영 .env나 자격증명을 복사하지 않았다.
- 최초 npm ci는 @rolldown/binding-wasm32-wasi가 요구하는 @emnapi/core와 @emnapi/runtime 1.11.1의 중첩 lock 항목 누락으로 실패했다. 두 항목만 추가했으며 기존 의존성 버전 변경은 없다.
- 보완 후 Windows/Linux 각각 npm ci·전체 테스트 206개·타입 검사를 통과했다. DB 회귀 테스트는 격리된 PostgreSQL 엔진에서 기존 클립 URL·선정 이유 보존, 권한, 경합 및 불확실 게시 보호를 검증한다. 실제 운영 데이터의 마이그레이션 후 비교는 아직 하지 않았다.
- Windows npm ci는 선택 의존성의 기존 디렉터리 정리에서 EPERM 경고 1건을 남겼지만 종료 코드 0이며 설치 후 전체 회귀·타입 검사는 통과했다. Linux npm의 설치 스크립트 정책 경고와 기존 테스트의 Supabase 다중 클라이언트 경고는 로그에 보존했다.
- 2026-10-19의 운영 기준 기록은 작업 14개/클립 14개와 ID·URL·기존 transcript의 fingerprint다. 전체 데이터 백업이 아니므로 실제 전환 직전에 새 백업과 기준값 조회가 필요하다.
- GitHub 설정은 이름만 조회했다. 기존 제작용 Secrets는 등록되어 있다. 게시용 SHORTS_CREDENTIAL_ENCRYPTION_KEY, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_CHANNEL_ID, INSTAGRAM_ACCOUNT_ID와 repository variable INSTAGRAM_API_VERSION은 아직 없다. 값의 유효성 시험·설정 변경은 하지 않았다.
- 웹의 GITHUB_PAT 및 SHORTS_WORKFLOW_REF는 실제 배포 환경에서 별도 확인해야 한다. 현재 점검을 원격 시험 DB나 실계정 게시 검증 완료로 해석하지 않는다.

### 2026-10-20 운영 쇼츠 데이터의 로컬 복제본 이행 검증

- 사용자 토큰으로 Supabase CLI 인증과 교회 프로젝트 prqebmdejdvbtkhabtfy의 SELECT 1을 확인했다. 플러그인 OAuth 연결이 복구됐다는 의미는 아니다.
- CLI에서 접근 가능한 프로젝트는 운영 msvchDB 하나이며 시험 브랜치는 없었다. 사용자가 별도 시험 DB가 없음을 확인하고 추가 비용 없는 로컬 복제본 검증을 선택했다.
- 운영의 shorts_jobs/shorts_clips/shorts_settings 구조·제약·인덱스·RLS 정책·권한과 전체 쇼츠 행을 읽어 Git에서 제외된 로컬 검증 폴더에 보관했다. 회원 데이터·인증 토큰·외부 서비스 자격증명은 복사하지 않았다. 이 자료는 쇼츠 3개 테이블에 대한 기록이며 전체 DB 백업은 아니다.
- 저장소 초기 SQL과 운영 정책은 달랐다. 운영 정책이 참조하는 is_staff 및 is_admin_or_master의 실제 정의도 복원했다. Auth UID와 profiles는 필요한 최소 로컬 fixture를 사용했다.
- 독립 PostgreSQL 17.10에서 실제 운영 스냅샷을 복원하고 042_shorts_highlight_count.sql → 제작 안정화 → 예약 발행 마이그레이션 적용을 통과했다. 운영 DB는 PostgreSQL 17.6이므로 동일 서버 환경을 검증한 것은 아니다.
- 기존 작업 14개·클립 14개·설정 행의 모든 기존 필드가 이행 후에도 동일했다. ID·영상 URL·기존 transcript를 포함한 독립 비교 hash가 일치했다. 기존 transcript는 선정 이유로 복사되고 자막은 unverified이며, 신규 제작 자동화·게시·배경음 스위치는 모두 OFF였다.
- 실제로 분리된 두 DB 연결에서 게시 획득이 하나만 성공했다. 게시 OFF·예약 시각 전 획득 차단, 중복 예약의 동일 행 반환, 오래된 lease 차단, 게시 중 수정 차단을 확인했다. anon/member/staff/admin/master/service_role의 초안 조회·함수 실행·비밀 테이블 차단도 확인했다.
- YouTube 시험 예약은 live 큐·일일 한도·published 집계와 분리되며 test_uploaded로 끝났다. 이는 로컬 DB 상태 전이 검증으로, YouTube/Instagram API 호출이나 실제 업로드는 없었다.
- 검증 후 운영을 다시 조회해 쇼츠 행·구조·권한 정책이 검증 전과 동일함을 확인했다. 운영 쇼츠 데이터/스키마 변경, 원격 시험 DB 생성, 배포, 실제 게시는 수행하지 않았다. 로컬 PostgreSQL 프로세스는 종료했다.
- 상세 JSON 결과와 복원/검증 스크립트는 .superpowers/sdd/PLAN-shorts-automation/에 보관한다. PowerShell의 날짜 자동 변환으로 정밀도·표기가 달라지지 않도록 운영 스냅샷은 CLI 원본 JSON으로 저장한다. 원격 Supabase 서비스와 실제 OAuth/게시 시험은 여전히 미완료다.

### 교회 현장 인계 준비

- CHURCH-PC-START.md에 Windows 도구·모든 사용자용 글꼴·시스템 PATH·개인 GitHub 계정으로 러너 등록·서비스 재부팅·첫 제작 확인 순서를 정리했다. 사용자는 이 개인 PC에서 준비한 뒤 교회 PC에서 설치할 예정이다.
- Vercel msvch 팀은 현재 연결에서 403이며 CLI에도 로그인 정보가 없다. CLI로 같은 팀을 조회한 시도도 인증 단계에서 실패했다. 사용자가 현재 해당 팀 접근이 어렵다고 확인했으므로 DB·웹 운영 전환은 미실행으로 유지한다.
- 2026-10-20 저장소 수준 러너 목록은 0대다. 조직 수준 조회는 현재 토큰의 admin:org scope 부족으로 거절됐으므로 조직 전체에 러너가 없다고 단정하지 않는다. 러너 등록에는 확인된 저장소 admin 권한을 사용한다.
- 인계 ZIP은 설치 안내·운영 절차·기존 세 마이그레이션·보존 검사와 트랜잭션을 추가한 적용 SQL·검증 결과·체크섬만 포함한다. .env, 토큰, 원본 운영 데이터와 회원 자료는 포함하지 않는다.
- 인계용 적용 SQL도 실제 운영 스냅샷의 로컬 복제본에서 실행했다. 기존 값·행 수 검사, 자동 스위치 OFF 검사를 통과했으며 검사 실패 시 전체 이행의 rollback과 이미 적용된 DB의 재실행 거부를 확인했다. 제공 파일은 준비물이며 운영 반영 완료를 의미하지 않는다.

### 다중 연결 DB 검증 재실행

별도 임시 폴더에 embedded-postgres@17.10.0-beta.17을 설치하고 SHORTS_NATIVE_POSTGRES_MODULE에 해당 패키지의 dist/index.js 절대 경로를 지정한 뒤 node --import tsx scripts/shorts/verify-database.mjs를 실행한다. 도구는 임시 포트·디렉터리의 독립 클러스터를 생성하고 검증 후 종료·정리하며 운영 DB 주소나 자격증명을 사용하지 않는다. 테스트용 OS 계정을 자동 생성하지 않는다.

## 구현 중 판단한 사항

| 판단 | 이유와 한계 |
|---|---|
| 별도 codex/shorts-automation 작업 공간 사용 | 기존 main 작업과 분리. 실제 적용 전 통합이 필요하다. |
| 로컬 구현을 진행하고 외부 계정·교회 PC 확인은 별도 단계로 남김 | 접근·동의가 없는 운영 환경을 검증했다고 주장하지 않는다. 실제 가동은 아직 입증되지 않았다. |
| Docker 대신 격리 DB 사용 | 처음 PGlite로 전이를 검증한 뒤 native PostgreSQL 17.10의 실제 다중 연결 검증까지 완료했다. 운영 Supabase 환경 검증은 남아 있다. |
| Node 테스트에서 DOM 설정 분리 | 기존 DOM 전용 테스트 설정이 워커 테스트를 막았다. 브라우저 테스트도 전체 회귀로 재확인했다. |
| 선정 ID 계약을 확정한 뒤 워커 연결 | 중복 구현을 피했다. 중간 단계만 따로 배포할 수 없는 결합이 있다. |
| 침묵 제거 전에 타임스탬프·프레임 간격 정규화 | 실제 렌더러의 합성 검증을 통과했다. 실제 설교의 입 모양과 싱크를 보장하는 증거는 아니다. |
| PublishResult는 별도 kind 대신 저장 상태와 같은 status 사용 | 타입·DB 상태 변환의 불일치를 줄였다. 제안 인터페이스를 사용하는 후속 호출자는 새 타입을 따라야 한다. |
| queued 취소와 구버전 실행 종료 확인 추가 | 유실된 dispatch를 무작정 재전송하지 않는다. 늦게 시작한 러너는 획득 단계에서 거부된다. |
| 결과 조회 오류는 429여도 한도 유지 | 실제 게시가 성공했을 수 있다. 확인 전 한도가 보수적으로 점유될 수 있다. |
| 새 제작 중 이전 클립의 승인·수정 제한 | 교체 성공 뒤 승인된 이전 결과가 숨겨지는 경합을 막는다. 실패·종료 전에는 미리보기만 가능하다. |
| 스키마·API·워커를 함께 커밋 | 중간 계약 불일치 방지. 세부 변경을 커밋 단위로 나눠 추적하기 어렵다. |
| 교회 PC 설치·재부팅·용량·글꼴·네트워크 검증 보류 | 실제 하드웨어에 접근하지 않았다. 서비스 계정에서 운영 전 확인이 필요하다. |
| 실제 설교의 자막·입 모양·구도·fallback 응답 검증 보류 | 합성 테스트로 대체할 수 없다. 실제 설교 표본 검수가 필요하다. |
| OAuth 동의·실계정 게시·PC 종료 예약 시험 보류 | 모킹은 외부 권한과 서비스 응답을 입증하지 않는다. 실계정 단계 시험이 필요하다. |
| 운영 DB 보존·Linux 설치 검증 보류 | 격리 DB/Windows 결과를 운영 환경으로 확대 해석하지 않는다. 전환 전 기준값 재조회와 대상 환경 검증이 필요하다. |
| BGM·미검수 발행·추적·재렌더·통계는 제한/후속 범위 유지 | 승인된 계획의 범위를 따른다. 이용 조건·별도 요청이 없는 기능은 제공하지 않는다. |
| 병합·공개 없이 검토 가능한 로컬 브랜치와 작업 공간 보존 | 배포·운영 전환은 별도 단계다. 현재 구현은 아직 main과 운영 환경에 적용되지 않았다. |
