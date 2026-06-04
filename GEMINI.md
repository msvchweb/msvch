# Gemini CLI Workflow: Vibe Coding Harness

본 프로젝트는 AI 협업을 위해 4단계의 역할 기반 워크플로우(Harness)를 사용합니다. Gemini CLI는 이 구조를 그대로 계승하여 작업을 수행합니다.

## Core Roles & Workflow

모든 복합 작업은 `_workspace/` 디렉토리의 문서들을 통해 관리됩니다.

1.  **Planner (`01_planner_plan.md`)**:
    *   요구사항 분석 및 아키텍처 설계.
    *   Goal, Non-Goals, Data Model, API Spec, Risk, Open Questions 정의.
    *   사용자의 최종 승인을 받은 후 다음 단계로 진행.
2.  **Implementer (`02_implementer_summary.md`)**:
    *   실제 코드 구현 및 파일 변경 내역 기록.
    *   구현 중 발견된 이슈나 설계 변경 사항(Open Issues) 기록.
3.  **QA (`03_qa_report.md`)**:
    *   구현 결과 검증 (TypeCheck, Lint, API 매칭, RLS, 보안 등).
    *   `_workspace/01_planner_plan.md`의 목표 달성 여부 체크.
4.  **Scribe (`04_scribe_handoff.md`)**:
    *   최종 커밋 메시지 및 PR Body 초안 작성.
    *   사용자에게 전달할 가이드 및 후속 조치 사항 정리.

## Technical Standards

*   **Framework**: Next.js 16.2 (App Router)
*   **UI/Styling**: React 19.2, Tailwind CSS v4 (@theme)
*   **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
*   **AI**: Google Gemini 2.5 Flash
*   **Conventions**:
    *   **DTO**: 항상 camelCase 사용 (DB snake_case와 맵핑).
    *   **Security**: RLS(Row Level Security)를 진실의 원천으로 활용. API 라우트에서 `createApiClient(request)`를 사용하여 Bearer/Cookie 인증 공용화.
    *   **Stability**: 모바일 앱 호환성을 위해 API 스키마 변경 시 보수적으로 접근.
    *   **Safety**: `dangerouslySetInnerHTML` 사용 금지. 외부 라이브러리 추가 최소화.

## Interaction Guidelines

*   **Vibe Coding**: 기술적 완성도뿐만 아니라 사용자 경험(UX)과 시각적 완성도(Aesthetics)를 중요시합니다.
*   **Verification**: 모든 변경 사항은 `npm run typecheck` 및 `npm run lint`를 통해 검증되어야 합니다. (현재 환경 이슈로 직접 실행이 어려울 경우 사용자에게 가이드 제공)
*   **Documentation**: `API_SPEC.md`, `DB_SCHEMA.md`, `ARCHIT.md`, `UPDATES.md`를 항상 최신 상태로 유지합니다.

## Tooling Compatibility

*   **gstack**: `.gstack/`의 브라우징 로그 및 보안 보고서를 참조하여 작업 품질을 높입니다.
*   **harness**: `_workspace/`의 4단계 문서를 작업의 유일한 진실의 원천(Single Source of Truth)으로 삼습니다.
