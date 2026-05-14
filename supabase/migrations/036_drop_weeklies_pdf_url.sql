-- 036: weeklies.pdf_url 컬럼 DROP
--
-- 배경:
--   003 에서 만든 pdf_url 컬럼은 PDF 자동 생성 라우트(/api/weeklies/generate-pdf)가
--   채워줬으나, 그 라우트를 호출하는 클라이언트 동선이 모두 제거되어 컬럼이
--   항상 NULL 인 dead 상태. 공개 페이지의 PDF 버튼도 같은 이유로 절대 노출되지 않음.
--
-- 영향:
--   - 공개 페이지(/weekly, /weekly/[id]) 의 {weekly.pdf_url && ...} 분기 제거와 함께
--   - admin 삭제 시 Storage PDF cascade 제거 로직도 함께 정리
--   - Weekly 타입에서 pdf_url 필드 제거 (TS 타입 추론 동기화)
--   - puppeteer-core / @sparticuz/chromium / @sparticuz/chromium-min 의존성 동시 제거
--   - /api/weeklies/generate-pdf 라우트 디렉토리 삭제
--
-- 보존:
--   - storage.buckets 'weeklies' 와 storage.objects 정책은 그대로 둠
--     (과거 staff 가 수동 업로드한 PDF 가 남아있을 수 있음 — 운영자가 수동 정리)

ALTER TABLE public.weeklies DROP COLUMN IF EXISTS pdf_url;
