# 교회 PC에서 쇼츠 작업 시작하기

2026-10-20 기준. 먼저 설교 1편을 수동 제작하고 영상을 검수한다. 공개 게시와 설교 자동 검색은 계정 연결·실제 영상 확인 후 켠다.

## 현재 준비 상태

- 제작·검수·예약 코드와 Windows/Linux 설치 검증, 운영 쇼츠 데이터의 로컬 복제본 이행 검증은 완료했다.
- 운영 DB와 웹의 새 버전 반영은 아직 하지 않았다. 이 단계가 끝나기 전에는 새 제작 요청을 보내지 않는다.
- 저장소 수준 러너 목록은 현재 0대다. 조직 수준 목록은 현재 GitHub 토큰 권한으로 확인하지 못했다.
- Vercel의 msvch 팀 연결은 현재 403이며 CLI 로그인도 없다. 운영 환경변수 확인과 DB·웹 동시 전환에 해당 팀 접근이 필요하다.
- GitHub 제작용 Secret 이름들은 등록돼 있다. 값의 유효성은 첫 실제 작업에서 확인한다. 게시 계정용 Secret과 YouTube/Instagram 동의는 별도로 준비해야 한다.

교회 PC에서 필요한 로그인은 GitHub 개인 계정과 교회 사이트 관리자 계정이다. Supabase/R2/Groq/Gemini 브라우저 로그인을 유지하거나 개인 PC의 .env를 옮길 필요는 없다. YouTube/Instagram 로그인은 게시 연결 단계에서 한다.

## 1. Windows 도구와 글꼴 설치

관리자 권한이 있는 Windows x64 PC에서 설치한다. 서비스가 사용하는 계정도 도구를 실행할 수 있도록 모든 사용자용 설치와 시스템 PATH를 사용한다.

| 도구 | 설치할 것 |
|---|---|
| [Git for Windows](https://git-scm.com/install/windows) | x64 Git |
| [Node.js](https://nodejs.org/en/download) | **24.x**, Windows x64. 다른 메이저 버전을 고르지 않는다. |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) | 공식 릴리스의 Windows x64 yt-dlp.exe |
| [FFmpeg](https://ffmpeg.org/download.html) | 공식 페이지에서 안내하는 Windows 빌드의 ffmpeg.exe와 ffprobe.exe |
| [Noto Sans CJK KR](https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/Korean) | NotoSansCJKkr-Regular.otf와 NotoSansCJKkr-Bold.otf. 글꼴 파일의 **모든 사용자용 설치** 사용 |

yt-dlp.exe, ffmpeg.exe, ffprobe.exe는 C:\shorts-tools에 함께 둘 수 있다. 압축 파일 자체나 bin 상위 폴더가 아닌 실행 파일의 위치를 확인한다.

그 폴더를 사용할 경우 관리자 PowerShell에서 기존 시스템 PATH를 보존하며 추가한다.

~~~powershell
$shortsTools = 'C:\shorts-tools'
$shortsMachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if (($shortsMachinePath -split ';') -notcontains $shortsTools) {
    [Environment]::SetEnvironmentVariable(
        'Path', ($shortsMachinePath.TrimEnd(';') + ';' + $shortsTools), 'Machine'
    )
}
~~~

설치 후 새 PowerShell을 열어 확인한다. 서비스 등록·시작은 도구 설치 뒤에 한다.

~~~powershell
git --version
node --version
yt-dlp --version
ffmpeg -version
ffprobe -version
~~~

## 2. 코드 받기와 설치 점검

아래 C:\church-shorts는 **새 폴더** 기준이다. 이미 있는 폴더를 지우거나 덮어쓰지 않는다. 비공개 저장소 인증이 나오면 저장소 접근 권한이 있는 개인 GitHub 계정을 사용한다.

~~~powershell
git clone --branch main --single-branch https://github.com/msvchweb/msvch.git C:\church-shorts
Set-Location C:\church-shorts
npm ci --no-audit --no-fund
node --import tsx scripts/shorts/preflight.ts --tools-only
~~~

성공 조건은 yt-dlp: OK, ffmpeg: OK, ffprobe: OK, font / temp / banner: OK가 모두 나오고 종료 코드가 0인 것이다. 글꼴 검사에서 멈추면 Noto Sans CJK KR의 설치 범위부터 확인한다.

이미 main을 받은 작업 폴더라면 로컬 변경을 먼저 확인하고 git pull --ff-only를 사용한다. 개인 설정과 파일을 강제로 초기화하지 않는다.

## 3. GitHub 러너를 Windows 서비스로 등록

1. 교회 PC 브라우저에서 저장소 관리 권한이 있는 개인 GitHub 계정으로 [러너 등록 화면](https://github.com/msvchweb/msvch/settings/actions/runners/new)을 연다. 다른 GitHub Owner의 비밀번호를 사용할 필요는 없다.
2. Windows / x64를 선택한다. 화면의 최신 다운로드·해시 확인·압축 해제 안내를 따라 **C:\actions-runner**에 설치한다. 코드 작업 폴더와 분리한다.
3. 관리자 PowerShell에서 해당 폴더의 config.cmd를 실행한다. 저장소 URL은 https://github.com/msvchweb/msvch 이며 등록 토큰은 그 자리에서 발급한다. 토큰은 1시간 뒤 만료되므로 미리 문서·채팅에 복사해 두지 않는다.
4. 러너 이름은 church-shorts로 정하고 추가 라벨에 **shorts,church**를 넣는다. 기존 제작 워크플로는 self-hosted / windows / shorts 라벨로 대상을 찾는다.
5. 서비스 설치 질문에는 Y를 선택한다. 사용할 서비스 계정에서 시스템 PATH·설치 글꼴·임시 폴더·C:\actions-runner 접근이 가능해야 한다.
6. [러너 목록](https://github.com/msvchweb/msvch/settings/actions/runners)에서 Online을 확인한다. PC를 재부팅한 뒤 다시 Online인지 확인한다.

서비스 확인 명령:

~~~powershell
Get-Service 'actions.runner.*'
~~~

일반 로그인 계정의 사전 점검 성공만으로 서비스 계정도 준비됐다고 판단하지 않는다. 첫 GitHub 작업의 Preflight 단계까지 통과해야 한다. 개인 PC에도 shorts 러너가 있다면 첫 시험 때는 그 러너를 중지해 교회 PC에서 실행되는지 확인한다.

공식 절차: [러너 추가](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners), [Windows 서비스 설정](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application).

## 4. 운영 DB와 웹 전환은 준비 담당자가 완료

이 부분은 PC 설치와 별개다. 운영 환경 확인 없이 SQL만 먼저 실행하지 않는다.

- 대상 Supabase 프로젝트: prqebmdejdvbtkhabtfy / msvchDB.
- 대상 GitHub PR: [#5](https://github.com/msvchweb/msvch/pull/5), codex/shorts-automation → main.
- 대상 웹: [www.msvch.org](https://www.msvch.org). Vercel msvch 팀의 해당 프로젝트를 확인한다.
- 실행 중인 제작이 없음을 GitHub에서 확인하고, 전환 직전 쇼츠 구조·행 백업과 기준값을 다시 저장한다.
- 적용 순서는 042_shorts_highlight_count.sql → 20261018231828_shorts_generation_reliability.sql → 20261018233233_shorts_publications.sql이다. 운영에 마이그레이션 이력 테이블이 없으므로 전체 db push로 대체하지 않는다.
- 웹에 GITHUB_PAT의 저장소 Actions 읽기/쓰기 권한과 Supabase 서버 환경변수가 있어야 한다. SHORTS_WORKFLOW_REF는 배포된 workflow 버전과 맞춘다. main으로 전환한 뒤에는 main을 사용한다.
- DB와 웹은 같은 전환 작업으로 반영한다. 구버전의 직접 쓰기와 새 RLS를 장시간 혼용하지 않는다.
- auto_publish, publishing_enabled, auto_generate_enabled, bgm_enabled는 초기 OFF를 확인한다.
- 상세 검증·복구 방법은 [운영 절차서](RUNBOOK-shorts-automation.md)를 따른다. 제공된 쇼츠 백업은 전체 교회 DB 백업과 구분한다.

## 5. 최초 수동 제작과 검수

1. 4번의 운영 전환 완료를 확인한 뒤 [쇼츠 관리자](https://www.msvch.org/admin/shorts)에 admin 또는 master 계정으로 로그인한다.
2. 설교 영상 1편을 선택해 **5개**로 수동 제작한다. 공개 게시는 하지 않는다.
3. [제작 Actions](https://github.com/msvchweb/msvch/actions/workflows/sermon-shorts.yml)에서 해당 작업을 열고 실행 러너가 church-shorts인지 확인한다.
4. Preflight → Generate clips 성공과 관리자 미리보기를 확인한다. 자막이 실제 발언인지, 설교 맥락·얼굴 구도·입 모양/자막 싱크·음량·길이를 사람이 확인한다.
5. 생성 실패 시 오류가 난 작업 한 건만 다시 제작한다. 기존 14개 작업/클립을 일괄 초기화하거나 삭제하지 않는다. 기존 pending 3건도 자동으로 재시도하지 않는다.
6. 품질 확인 뒤 YouTube 연결과 비공개 업로드 시험을 진행한다. Instagram에는 동일한 비공개 릴스 시험이 있다고 가정하지 않는다. 공개할 영상과 계정이 확정된 후 실제 게시를 한다.

교회 PC 설치가 끝났다는 기준은 **서비스 재부팅 후 Online + 교회 러너의 실제 제작 성공 + 사람이 미리보기 검수**다. 예약 게시의 PC 전원 독립성은 계정 연결 후 별도 시험한다.
