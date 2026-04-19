# 주보 UI 개선 구현 플랜

## Phase 1 — 데이터 레이어
- [x] 1-1. DB 마이그레이션 (010_weeklies_content.sql)
- [x] 1-2. Weekly 타입 확장 (src/types/notice.ts)
- [x] 1-3. WeeklySchema 확장 (src/lib/validation.ts)
- [x] 1-4. getWeeklies() 업데이트 (src/lib/notices.ts)

## Phase 2 — PDF 생성
- [x] 2-1. 패키지 설치 (puppeteer-core, @sparticuz/chromium)
- [x] 2-2. next.config.ts — serverExternalPackages 추가
- [x] 2-3. HTML 템플릿 구현 (src/lib/weekly-html-template.ts)
- [x] 2-4. PDF 생성 API (src/app/api/weeklies/generate-pdf/route.ts)

## Phase 3 — 관리자 UI
- [x] 3-1. WeeklyForm 컴포넌트 (src/components/weekly/WeeklyForm.tsx)
- [x] 3-2. 신규 작성 페이지 (src/app/admin/weeklies/new/page.tsx)
- [x] 3-3. 수정 페이지 (src/app/admin/weeklies/[id]/edit/page.tsx)
- [x] 3-4. 관리자 목록 페이지 업데이트 (src/app/admin/weeklies/page.tsx)

## Phase 4 — 공개 페이지
- [x] 4-1. WeeklyInlineView 컴포넌트 (src/components/weekly/WeeklyInlineView.tsx)
- [x] 4-2. 공개 주보 페이지 업데이트 (src/app/(public)/weekly/page.tsx)

## Phase 5 — 검증 및 문서화
- [x] 5-1. TypeScript 타입 체크 통과
- [x] 5-2. API_SPEC.md 업데이트
- [x] 5-3. ARCHIT.md 업데이트
- [x] 5-4. DB_SCHEMA.md 업데이트
- [x] 5-5. Git 커밋 및 푸시
