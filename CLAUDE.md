@AGENTS.md
# <명성비전교회> Claude Code Configuration

(전역 ~/.claude/CLAUDE.md를 상속받음. 아래는 프로젝트별 추가 룰)

## 이 프로젝트의 gstack 활용
- 메인 워크플로우: `/office-hours` → `/design-consultation` → 구현 → `/design-review`
- 코드 리뷰는 항상 `/review`보다 `/codex`를 먼저 (외부 시각 우선)
- 배포는 `/ship` 후 반드시 `/canary`로 모니터링

## 프로젝트 특화 컨벤션
- 디자인 톤: 검은 배경 + 굵은 숫자 (데답 시그니처 룩)
- 컬러: 빨강(하락) / 초록(상승) / 노랑(강조) / 파랑(중립)
- AI 슬롭 점수 B+ 이상 필수, A 권장

## 하네스: 기능 풀 스프린트

**목표:** 새 기능 추가·수정 요청을 planner-architect → implementer → qa → scribe 파이프라인으로 자동 실행하고, push 직전에서 사용자 검토 대기로 멈춘다.

**트리거:** "기능 추가해줘", "이거 만들어줘", "구현해줘", "스프린트 돌려줘", "PLAN부터 다시", "QA만 다시" 같은 풀 스프린트 요청 시 `feature-sprint` 스킬을 사용한다. 단일 단계 요청(단순 diff 리뷰·브라우저 QA·배포)은 트리거하지 않고 기존 gstack 스킬(/code-review, /qa, /ship 등)에 위임한다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-27 | 초기 구성 (4 에이전트 + qa-crosscheck + feature-sprint 오케스트레이터) | 전체 | 풀 스프린트 자동화 |