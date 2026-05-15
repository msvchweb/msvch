# 업데이트 노트

명성비전교회 홈페이지 운영 시스템의 변경 이력을 누적합니다.
관리자 대시보드의 **업데이트 노트** 카드는 이 파일을 파싱해서 보여줍니다.

## 작성 규칙

- 최신 항목이 **위**에 오도록 추가합니다.
- 각 항목은 `## YYYY-MM-DD — 제목` 헤더로 구분합니다.
- 본문은 자유 마크다운. 짧은 한 줄 요약 → 필요 시 상세를 권장합니다.
- 카드 노출은 상위 N개(기본 5개). 전체 보기는 `/admin/updates` 페이지.
- `<!-- highlight -->` 주석을 본문 위에 두면 카드에서 강조 표시됩니다.
- `<!-- staff-only -->` 주석을 두면 관리자 대시보드에만 노출, 공개 API 응답에서 제외됩니다.

## 항목 템플릿

```md
## 2026-05-15 — 제목

<!-- highlight -->

- 한 줄 요약
- 영향 범위: (예) 관리자 / 일반 사용자 / 둘 다
- 관련 PR/커밋: `abc1234`
```

---

## 2026-05-15 — RLS 정책을 UI 권한과 일치 (마이그 037)

<!-- highlight -->
<!-- staff-only -->

- 일부 테이블의 staff 등급 정책을 `is_admin_or_master()` 로 좁힘 — UI 매트릭스와 일치.
- 적용 대상: notices, weeklies(+Storage), 주보 마스터 5종, events INSERT/UPDATE, event_subscribers SELECT, alimtalk_sent SELECT, chat_inquiries SELECT, new_family_registrations SELECT/UPDATE, Storage `blog-images`.
- 보존: 공개 SELECT(공지/주보/일정/설교), 작성자 본인 DELETE(021), anon INSERT(챗봇·새가족 폼).
- 마이그레이션 파일: `supabase/migrations/037_align_rls_with_ui_matrix.sql` — **원격 Supabase 에 수동 적용 필요**.

---

## 2026-05-15 — 관리자 메뉴 권한 매트릭스 정식 적용

<!-- highlight -->

- **공지사항·주보일정·문의새가족**: admin 이상만 노출
- **갤러리게시판·포스터·설교쇼츠**: staff 이상
- **회원관리**: master 단독
- 권한 없는 메뉴는 사이드바·하단 탭바·전체 메뉴·대시보드 카드에서 **자동으로 숨김**.
- URL 직접 입력 시에는 서버 미들웨어가 차단해 대시보드로 되돌립니다.
- 영향 범위: 관리자(직원·관리자·최고관리자) — 일반 사용자에는 영향 없음

---

## 2026-05-15 — 관리자 화면 시각 차별화 + 업데이트 노트 시스템 정식 도입

<!-- highlight -->

- **관리자 화면 식별성 강화**: 슬레이트 톤 배경 + 상단 노란 "관리자 모드 · 역할명" 띠. 일반 화면과 즉시 구별됩니다.
- **업데이트 노트 시스템 GA**: 이 페이지(`/updates`)와 관리자 대시보드 "업데이트 노트" 카드가 같은 `UPDATES.md` 를 읽습니다.
  - 공개 JSON: `GET /api/updates` (모바일 앱 호환, 인증 불필요)
  - 관리자 전체 보기: `/admin/updates` (내부 항목 포함)
  - 일반 공개: `/updates` (내부 항목 자동 제외)
- **메타 주석**: `<!-- highlight -->` 는 NEW 배지, `<!-- staff-only -->` 는 관리자 전용.
- 영향 범위: 관리자 / 일반 사용자(간접 — 직원 실수 감소, 향후 변경 사항 투명 공개)
