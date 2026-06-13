# 🎬 쇼츠 자동 생성 시스템 가이드 (Shorts System)

이 문서는 AI 기반 설교 쇼츠 생성 시스템의 구조와 운영 방법을 설명합니다. 시스템이 대기 상태에서 넘어가지 않을 때 이 가이드를 참조하십시오.

## 🚀 1. 러너(Runner) 실행 방법 (필독)

현재 쇼츠 생성은 **Self-hosted Runner (로컬 Windows PC)**에서 실행되도록 설정되어 있습니다. GitHub Actions에서 작업이 '대기 중(Waiting)'으로 뜬다면 아래 절차를 따르세요.

### 실행 위치
*   **경로**: `C:\Users\Administrator\actions-runner`
*   **실행 파일**: `run.cmd`

### 실행 명령어 (PowerShell/CMD)
```powershell
cd C:\Users\Administrator\actions-runner
.\run.cmd
```
> **참고**: 터미널 창에 `Listening for Jobs` 메시지가 나타나면 정상입니다. 창을 닫으면 쇼츠 생성이 다시 중단되므로 작업을 마칠 때까지 열어두세요.

---

## 🏗️ 2. 시스템 아키텍처

쇼츠 생성은 6단계 파이프라인으로 구성되며, `scripts/shorts/run.ts`가 이를 오케스트레이션합니다.

1.  **Download**: `yt-dlp`를 이용해 유튜브 영상 및 오디오 추출.
2.  **Transcribe**: `Groq Whisper`를 이용해 음성을 텍스트로 변환 (실패 시 유튜브 자동 자막 폴백).
3.  **Highlight**: `Gemini 1.5 Flash`가 자막을 분석하여 핵심 구간 5개 선정.
4.  **Edit**: `FFmpeg` 필터를 사용하여 9:16 세로형 변환, 자막 번인, BGM 믹싱.
5.  **Metadata**: AI가 쇼츠 제목 및 제목 해시태그 생성.
6.  **Upload**: Supabase Storage 업로드 및 DB 상태 업데이트 (`ready_for_review`).

---

## 🛠️ 3. 기술 요구사항 (Runner 환경)

이 작업을 수행하는 컴퓨터에는 다음 도구들이 설치되어 있어야 합니다 (이미 설정됨).
*   **Node.js v20+**
*   **FFmpeg**: 영상 인코딩 핵심 도구
*   **yt-dlp**: 유튜브 영상 다운로드
*   **환경 변수**: GitHub Secrets에 저장되어 러너 실행 시 주입됨.

---

## ❓ 4. 트러블슈팅 (Q&A)

### Q: GitHub Actions에서 노란색 불(Pending)이 계속 떠 있어요.
*   **A**: `C:\Users\Administrator\actions-runner\run.cmd`가 실행 중인지 확인하세요.

### Q: 특정 구간에서 에러가 나면서 실패(Failed)해요.
*   **A**: `scripts/shorts/` 내의 개별 스크립트 로그를 확인하십시오. 대부분 API 할당량 초과나 유튜브 영상 접근 권한 문제입니다.

### Q: 배경음악(BGM)을 바꾸고 싶어요.
*   **A**: `scripts/shorts/bgm/` 폴더에 `peaceful.mp3`, `uplifting.mp3` 등의 이름으로 파일을 교체하면 분위기에 맞춰 자동 적용됩니다.

---

*최종 업데이트: 2026-06-13*
