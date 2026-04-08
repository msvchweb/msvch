# 메뉴 구조 개편 상세 보고서

## 1. 현재 메뉴 구조 (nav-config.ts)

```
교회소개 (/intro)
  ├ 인사말 (/greetings)
  ├ 교회소개 (/intro)
  └ 오시는 길 (/map)

예배 (/worship)
  ├ 예배 안내 (/worship)
  ├ 주보 (/weekly) [badge]
  ├ 설교 영상 (/sermons) [badge]
  └ 시간표 (/timetable)

교회학교 (/churchschool)
  ├ 유아부 (/churchschool/infant)
  ├ 초등부 (/churchschool/elementary)
  ├ 청소년부 (/churchschool/teen)
  └ 청년부 (/churchschool/youth)

소식 (/notice)
  ├ 공지사항 (/notice) [badge]
  └ 갤러리 (/gallery) [badge]

문화사역 (/ministry)
  ├ 미용봉사 (/ministry/beauty)
  ├ 탁구 (/ministry/tabletennis)
  └ 반찬사역 (/ministry/sidedish)

커뮤니티 (/groups)
  ├ 그룹 (/groups)
  └ 봉사 (/volunteer)
```

## 2. 목표 메뉴 구조 (menucategory.md)

```
교회소개
  ├ 인사말         → greeting.avif 사진 한 장
  ├ 공지사항       → 기존 공지사항 게시판
  ├ 예배안내       → worship-time.avif 시간표 그대로 구현
  ├ 섬기는 이들    → 6명 스태프 카드 (staff1~6.avif)
  ├ 찾아오시는 길  → 추후 구글맵 연동
  └ 주보           → 이미지 업로드 게시판

말씀영상
  └ (단일 페이지) → 기존 설교영상 페이지

비전갤러리
  └ (단일 페이지) → 기존 갤러리, 카테고리에 교회학교/봉사센터 선택 시 하위부서 선택 가능

교회학교
  ├ 영유치부
  ├ 아동부
  ├ 청소년부
  └ 청년부

봉사센터
  ├ 사랑의 반찬나눔
  ├ 사랑의 이미용봉사
  ├ 비전문화학교
  └ 탁구교실
```

## 3. 변경점 분석 (현재 → 목표)

### 3-1. 상위 메뉴 변경

| 현재 (6개) | 목표 (5개) | 변화 |
|------------|------------|------|
| 교회소개 (3개 하위) | 교회소개 (6개 하위) | 하위 메뉴 대폭 변경 |
| 예배 (4개 하위) | (삭제) | 하위 항목이 교회소개/말씀영상으로 분산 |
| 교회학교 (4개) | 교회학교 (4개) | 유지 (부서명 변경: 유아부→영유치부, 초등부→아동부) |
| 소식 (2개) | (삭제) | 공지사항→교회소개, 갤러리→비전갤러리 독립 |
| 문화사역 (3개) | 봉사센터 (4개) | 이름 변경 + 비전문화학교 추가 |
| 커뮤니티 (2개) | (삭제) | 그룹/봉사 메뉴 제거 |
| (없음) | 말씀영상 (단일) | 새 카테고리 |
| (없음) | 비전갤러리 (단일) | 새 카테고리 |

### 3-2. 항목별 이동 추적

| 항목 | 현재 위치 | 목표 위치 |
|------|-----------|-----------|
| 인사말 | 교회소개 > 인사말 | 교회소개 > 인사말 |
| 교회소개 (/intro) | 교회소개 > 교회소개 | 삭제 (인사말에 통합) |
| 오시는 길 | 교회소개 > 오시는 길 | 교회소개 > 찾아오시는 길 |
| 예배 안내 | 예배 > 예배 안내 | 교회소개 > 예배안내 |
| 주보 | 예배 > 주보 | 교회소개 > 주보 |
| 설교 영상 | 예배 > 설교 영상 | 말씀영상 (독립) |
| 시간표 | 예배 > 시간표 | 삭제 (예배안내에 통합) |
| 공지사항 | 소식 > 공지사항 | 교회소개 > 공지사항 |
| 갤러리 | 소식 > 갤러리 | 비전갤러리 (독립) |
| 미용봉사 | 문화사역 > 미용봉사 | 봉사센터 > 사랑의 이미용봉사 |
| 탁구 | 문화사역 > 탁구 | 봉사센터 > 탁구교실 |
| 반찬사역 | 문화사역 > 반찬사역 | 봉사센터 > 사랑의 반찬나눔 |
| 섬기는 이들 | (없음) | 교회소개 > 섬기는 이들 (신규) |
| 비전문화학교 | (없음) | 봉사센터 > 비전문화학교 (신규) |
| 그룹 | 커뮤니티 > 그룹 | 삭제 |
| 봉사 | 커뮤니티 > 봉사 | 삭제 |

## 4. 파일별 상세 변경 계획

### 4-1. nav-config.ts (핵심)

```ts
// 목표 구조
교회소개 (/greetings)
  ├ 인사말 (/greetings)
  ├ 공지사항 (/notice) [badge: notices]
  ├ 예배안내 (/worship)
  ├ 섬기는 이들 (/staff)          ← 신규 페이지
  ├ 찾아오시는 길 (/map)
  └ 주보 (/weekly) [badge: weeklies]

말씀영상 (/sermons) [badge: sermons]  ← 하위 메뉴 없음

비전갤러리 (/gallery) [badge: gallery] ← 하위 메뉴 없음

교회학교 (/churchschool)
  ├ 영유치부 (/churchschool/infant)
  ├ 아동부 (/churchschool/elementary)
  ├ 청소년부 (/churchschool/teen)
  └ 청년부 (/churchschool/youth)

봉사센터 (/volunteer-center)
  ├ 사랑의 반찬나눔 (/volunteer-center/sidedish)
  ├ 사랑의 이미용봉사 (/volunteer-center/beauty)
  ├ 비전문화학교 (/volunteer-center/culture)    ← 신규 페이지
  └ 탁구교실 (/volunteer-center/tabletennis)
```

### 4-2. Header.tsx 수정 사항

현재 드롭다운은 `children`이 있는 메뉴만 펼쳐짐. **말씀영상**, **비전갤러리**는 children이 없으므로 바로 링크로 이동해야 함. 현재 Header 코드에서 `item.children && (...)` 조건이 있어서 children 없는 항목은 자연스럽게 단일 링크로 동작함. **수정 불필요**.

### 4-3. 신규 생성 페이지

| 페이지 | 경로 | 파일 경로 | 내용 |
|--------|------|-----------|------|
| 섬기는 이들 | /staff | src/app/(public)/staff/page.tsx | 6명 스태프 프로필 카드 |
| 비전문화학교 | /volunteer-center/culture | src/app/(public)/volunteer-center/culture/page.tsx | 내용 추후 결정 |
| 봉사센터 메인 | /volunteer-center | src/app/(public)/volunteer-center/page.tsx | 4개 봉사 사역 목록 |

#### 섬기는 이들 (/staff) 데이터

| 순서 | 이미지 | 이름 | 직분 | 담당 |
|------|--------|------|------|------|
| 1 | staff1.avif | 이양재 | 담임목사 | - |
| 2 | staff2.avif | 우 영 | 목사 | 교구 / 목장 |
| 3 | staff3.avif | 이준영 | 전도사 | 기획 / 청년부 |
| 4 | staff4.avif | 최희성 | 전도사 | 행정 미디어 / 청소년부 |
| 5 | staff5.avif | 임한나 | 전도사 | 아동부 |
| 6 | staff6.avif | 박가람 | 교육사 | 영유치부 |

### 4-4. 기존 페이지 수정

#### /greetings (인사말)
- **현재**: pastor.avif (160x200) + 텍스트 3문단
- **목표**: greetings.avif "사진 한 장으로" (92.6KB, 대형 이미지)
- **작업**: PageHeader + 이미지만 표시하도록 단순화

#### /worship (예배안내)
- **현재**: 6개 예배 정보 카드 (이름, 시간, 요일, 장소, 설명)
- **목표**: worship-time.avif의 시간표를 "하나도 빼먹지 말고 그대로 구현"
- **작업**: worship-time.avif 내용을 확인하여 시간표를 정확히 재현
- **주의**: 현재 6개 예배만 있지만, 이미지에 더 많은 시간 정보가 있을 수 있음

#### /churchschool/[department] (교회학교 부서)
- **현재**: 간단한 InfoRow 3개 (대상/시간/담당) + 프로그램 4개
- **목표**: menucategory.md의 상세 내용으로 전면 교체
- **변경 상세**:

| 부서 | 현재 이름 | 목표 이름 | 현재 시간 | 목표 시간 |
|------|-----------|-----------|-----------|-----------|
| infant | 유아부 | 영유치부 | 주일 오전 11:00 | 주일 낮 12시 / 본관 1층 / 0~7세 |
| elementary | 초등부 | 아동부 | 주일 오전 11:00 | 주일 낮 10시 / 교육관 2층 / 초1~6 |
| teen | 청소년부 | 청소년부 | 주일 오후 1:30 | 주일 낮 12시 / 교육관 3층 갈릴리실 / 14~19세 |
| youth | 청년부 | 청년부 | 주일 오후 2:00 | 매월 첫째주일 14:30 / 본관 2층 |

- **추가 섹션**: 2026표어, 주제말씀, 교육목표(3항목), 조직(지도교역자/부장/총무 등), 기도제목(3항목)
- **갤러리 연동**: 비전갤러리에서 각 부서 사진을 가져와 배치 (menucategory.md: "갤러리의 각 부서 사진을 각 페이지에 배치")

#### /ministry → /volunteer-center (봉사센터)
- **경로 변경**: /ministry/[slug] → /volunteer-center/[slug]
- **이름 변경**:
  - beauty: "미용봉사" → "사랑의 이미용봉사"
  - tabletennis: "탁구" → "탁구교실"
  - sidedish: "반찬사역" → "사랑의 반찬나눔"
- **추가**: culture: "비전문화학교" (내용 추후 결정)

#### /gallery (비전갤러리)
- **현재 카테고리**: 전체, 예배, 교회학교, 교회행사, 봉사센터, 새가족
- **목표**: 교회학교/봉사센터 선택 시 하위부서 2단계 필터 추가
  - 교회학교 → 영유치부 | 아동부 | 청소년부 | 청년부
  - 봉사센터 → 반찬 | 이미용 | 비전문화 | 탁구
- **DB 영향**: gallery_albums.category가 현재 "교회학교" 등 단일 값. 하위부서 구분을 위해:
  - 방법 A: sub_category 컬럼 추가 (권장)
  - 방법 B: category를 "교회학교/영유치부" 형태로 변경
- **admin/gallery도 수정 필요**: 앨범 생성 시 하위부서 선택 UI

### 4-5. 삭제/제거 대상

| 페이지/메뉴 | 경로 | 파일 | 사유 |
|-------------|------|------|------|
| 교회소개 페이지 | /intro | src/app/(public)/intro/page.tsx | 인사말에 통합, menucategory.md에 별도 없음 |
| 시간표 | /timetable | src/app/(public)/timetable/page.tsx | 예배안내에 통합 |
| 그룹 | /groups | src/app/(member)/groups/ | 목표 메뉴에 없음 |
| 봉사 | /volunteer | src/app/(public)/volunteer/page.tsx | 봉사센터로 대체 |
| 문화사역 경로 | /ministry/* | src/app/(public)/ministry/ | /volunteer-center로 이전 |
| 메뉴 페이지 | /menu | src/app/(public)/menu/page.tsx | 모바일 전용, 추후 별도 개발 시 재구성 |

### 4-6. 유지 (변경 없음)

| 페이지 | 경로 | 비고 |
|--------|------|------|
| 공지사항 목록 | /notice | 메뉴 위치만 변경 (소식→교회소개) |
| 공지 상세 | /notice/[slug] | 변경 없음 |
| 설교 목록 | /sermons | 메뉴 위치만 변경 (예배→말씀영상 독립) |
| 설교 상세 | /sermons/[id] | 변경 없음 |
| 주보 | /weekly | 메뉴 위치만 변경 (예배→교회소개) |
| 찾아오시는 길 | /map | 메뉴 위치만 변경 |

## 5. 리다이렉트 (next.config.ts)

기존 URL 호환을 위해 추가 필요:

```
/ministry → /volunteer-center (permanent)
/ministry/beauty → /volunteer-center/beauty (permanent)
/ministry/tabletennis → /volunteer-center/tabletennis (permanent)
/ministry/sidedish → /volunteer-center/sidedish (permanent)
/intro → /greetings (permanent, 교회소개가 인사말로 통합될 경우)
```

기존 next.config.ts에 이미 여러 리다이렉트가 설정되어 있음:
- /beauty → /ministry/beauty (이것도 /volunteer-center/beauty로 변경 필요)
- /sidedish → /ministry/sidedish (마찬가지)
- /tabletennis → /ministry/tabletennis (마찬가지)

## 6. 홈페이지 영향

### QuickLinks (src/components/home/QuickLinks.tsx)
현재 4개 링크:
- 예배안내 → /worship (유지)
- 비전갤러리 → /gallery (유지)
- 교회학교 → /churchschool (유지)
- 봉사센터 → /volunteer (→ /volunteer-center로 변경)

### WorshipTimeCard (src/components/home/WorshipTimeCard.tsx)
- 현재 4개 예배 카드 (주일/수요/금요/새벽)
- 예배안내 페이지 변경과 별개로 유지 가능

## 7. 이미지 자산 현황

| 파일 | 크기 | 현재 사용 | 목표 사용 |
|------|------|-----------|-----------|
| greetings.avif | 92.6KB | 미사용 | 인사말 페이지 메인 이미지 |
| worship-time.avif | 47.1KB | 미사용 | 예배안내 시간표 참고용 (내용 확인 필요) |
| staff1.avif | 22.6KB | 미사용 | 섬기는 이들 - 이양재 담임목사 |
| staff2.avif | 21.6KB | 미사용 | 섬기는 이들 - 우 영 목사 |
| staff3.avif | 23.7KB | 미사용 | 섬기는 이들 - 이준영 전도사 |
| staff4.avif | 19.2KB | 미사용 | 섬기는 이들 - 최희성 전도사 |
| staff5.avif | 17.8KB | 미사용 | 섬기는 이들 - 임한나 전도사 |
| staff6.avif | 24.9KB | 미사용 | 섬기는 이들 - 박가람 교육사 |
| pastor.avif | 22.6KB | 인사말 페이지 | 인사말 변경 후 불필요 가능 |
| banner.avif | 5.5KB (164x40) | 헤더 로고 | 유지 |
| main.jpg | 83.5KB | 히어로 배경 | 유지 |

## 8. DB/백엔드 영향

### gallery_albums 테이블
- 현재 category: "예배", "교회학교", "교회행사", "봉사센터", "새가족"
- 하위부서 필터를 위해 **sub_category 컬럼 추가** 필요
- admin/gallery 페이지에서 하위부서 선택 UI 추가 필요

### 교회학교 부서 페이지 갤러리 연동
- 각 부서 페이지에서 해당 부서의 갤러리 사진을 표시하려면
- gallery_albums에서 category="교회학교" AND sub_category="영유치부" 등으로 필터링
- `getGalleryAlbums()` 함수에 카테고리/서브카테고리 필터 파라미터 추가

## 9. 작업 우선순위

### Phase 1: 메뉴 구조 + 신규 페이지
1. nav-config.ts 메뉴 구조 변경
2. /staff 페이지 신규 생성 (섬기는 이들)
3. /greetings 페이지 수정 (greetings.avif 사진 한 장)
4. /volunteer-center 경로 생성 + 기존 ministry 이전

### Phase 2: 기존 페이지 내용 개편
5. /worship 예배안내 - worship-time.avif 시간표 구현
6. /churchschool/[department] 부서 상세 정보 전면 교체
7. 비전문화학교 페이지 생성

### Phase 3: 갤러리 고도화 + 정리
8. 갤러리 하위부서 필터 (DB 스키마 변경 포함)
9. 교회학교 부서 페이지에 갤러리 사진 연동
10. 불필요 페이지 삭제 (/intro, /timetable, /volunteer, /ministry)
11. next.config.ts 리다이렉트 설정
12. 홈페이지 QuickLinks 업데이트

## 10. 주의사항

1. **worship-time.avif**: "하나도 빼먹지 말고 그대로 구현" — 이미지 내용을 정확히 확인 후 구현 필수
2. **교회학교 데이터**: menucategory.md에 조직, 기도제목까지 상세 기재 — 모두 반영
3. **갤러리 하위부서**: DB 마이그레이션 필요 (sub_category 컬럼)
4. **커뮤니티(그룹) 제거**: 로그인 기반 기능이므로 코드 삭제 전 확인 필요
5. **기존 리다이렉트**: next.config.ts에 /beauty, /sidedish, /tabletennis 등 기존 리다이렉트가 /ministry/*로 가고 있으므로 /volunteer-center/*로 갱신 필요
