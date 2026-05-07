// 주보 폼에서 사용하는 고정 템플릿.
// 사용자 요청: 예배순서/헌금카테고리/다음주기도/안내위원/새벽예배 일자는 항목 구성을 변경할 수 없고,
// 관리자는 각 슬롯 안의 값(내용, 이름, 본문 등)만 수정한다.

import type {
  WorshipItemRow,
  OfferingCategoryRow,
  GuideCommitteeRow,
  DawnReading,
} from "@/types/notice";

/** 주일예배 순서 — 16행 고정. marker/label 은 수정 불가, content/assignees 만 편집 */
export const WORSHIP_ITEMS_TEMPLATE: readonly WorshipItemRow[] = [
  { marker: "※", label: "예배의 부름",       content: "",      assignees: ["인 도 자"],   subRows: [], emphasize: false },
  { marker: "※", label: "영광의 찬송",       content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "※", label: "기    원",           content: "",      assignees: ["인 도 자"],   subRows: [], emphasize: false },
  { marker: "※", label: "감사와 참회의 기도", content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "※", label: "신 앙 고 백",       content: "사도신경", assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "※", label: "성 시 교 독",       content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "",  label: "찬    송",            content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "",  label: "고백과 감사의 기도", content: "대표기도", assignees: ["", "", ""], subRows: [], emphasize: false },
  { marker: "※", label: "봉헌 및 기도",       content: "(* 헌금은 입구 헌금함에 드리시기 바랍니다)", assignees: ["다 함 께"], subRows: [], emphasize: false },
  { marker: "※", label: "성 경 봉 독",       content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "",  label: "찬    양",            content: "",      assignees: [],           subRows: [
    { content: "1부 :", assignee: "" },
    { content: "2부 :", assignee: "" },
  ], emphasize: false },
  { marker: "",  label: "말    씀",            content: "",      assignees: [""],         subRows: [], emphasize: true  },
  { marker: "",  label: "결단의 찬송",         content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "",  label: "교 회 소 식",         content: "",      assignees: ["인 도 자"],   subRows: [], emphasize: false },
  { marker: "",  label: "성도의 교제",         content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "※", label: "송    영",            content: "",      assignees: ["다 함 께"],   subRows: [], emphasize: false },
  { marker: "※", label: "축    도",            content: "",      assignees: [""],         subRows: [], emphasize: false },
] as const;

/**
 * 슬롯 힌트(폼 UI 가이드용):
 *   - assigneeLabels: assignees 각 슬롯에 어떤 이름을 넣는지 안내 (길이 = assignees 수)
 *   - subRowLabels : subRows 에 해당하는 행의 역할 안내
 *   - quoteContent : content 저장 시 양쪽에 쌍따옴표("") 자동 부여 (말씀 등)
 */
export const WORSHIP_SLOT_HINTS: readonly {
  assigneeLabels?: string[];
  subRowLabels?: string[];
  quoteContent?: boolean;
}[] = [
  {},                                                                           // 0 예배의 부름
  {},                                                                           // 1 영광의 찬송
  {},                                                                           // 2 기원
  {},                                                                           // 3 감사와 참회의 기도
  {},                                                                           // 4 신앙고백
  {},                                                                           // 5 성시교독
  {},                                                                           // 6 찬송
  { assigneeLabels: ["1부 대표기도자", "2부 대표기도자", "3부 대표기도자"] },   // 7 고백과 감사의 기도
  {},                                                                           // 8 봉헌 및 기도
  {},                                                                           // 9 성경봉독
  { subRowLabels: ["1부 찬양", "2부 찬양"] },                                    // 10 찬양
  { assigneeLabels: ["설교자"], quoteContent: true },                           // 11 말씀
  {},                                                                           // 12 결단의 찬송
  {},                                                                           // 13 교회소식
  {},                                                                           // 14 성도의 교제
  {},                                                                           // 15 송영
  { assigneeLabels: ["축도자"] },                                               // 16 축도
] as const;

/** 향기로운 예물 — 10 카테고리 고정. label 은 수정 불가, names 만 편집.
 *  단, 인덱스 3(SPECIAL_OFFERING_INDEX) 슬롯은 "특별헌금"으로 토글/라벨 변경 가능. */
export const OFFERING_CATEGORIES: readonly string[] = [
  "십일조",
  "감사헌금",
  "생일감사",
  "부활감사",
  "장학헌금",
  "구제헌금",
  "선교헌금",
  "일천번제",
  "주정헌금",
  "성전헌금",
] as const;

/** 특별헌금 슬롯 인덱스(부활감사 자리). 토글/라벨 변경 가능. */
export const SPECIAL_OFFERING_INDEX = 3;
export const SPECIAL_OFFERING_DEFAULT_LABEL = "부활감사";

/** 다음주 기도 — 부 라벨 3개 고정. 이름만 입력 */
export const NEXT_WEEK_PRAYER_PARTS: readonly string[] = ["1부", "2부", "3부"] as const;

/** 안내위원 — 부 라벨 3개 고정. 실내/실외 이름만 입력 */
export const GUIDE_COMMITTEE_PARTS: readonly string[] = ["1부", "2부", "3부"] as const;

/** 새벽예배 신앙일기 — 월~토 6개 고정. 본문만 입력 (날짜 자동) */
export const DAWN_WEEKDAY_LABELS: readonly string[] = ["월", "화", "수", "목", "금", "토"] as const;

/** 고정 헌금 10 카테고리 기본값 (names 빈 문자열) */
export function emptyOfferings(): OfferingCategoryRow[] {
  return OFFERING_CATEGORIES.map((label) => ({ label, names: "" }));
}

/** 고정 예배순서 기본값 (템플릿의 얕은 복사본) */
export function emptyWorshipItems(): WorshipItemRow[] {
  return WORSHIP_ITEMS_TEMPLATE.map((it) => ({
    marker: it.marker,
    label: it.label,
    content: it.content,
    assignees: [...it.assignees],
    subRows: it.subRows.map((s) => ({ ...s })),
    emphasize: it.emphasize,
  }));
}

/** 안내위원 3행 기본값 */
export function emptyGuideCommittee(): GuideCommitteeRow[] {
  return GUIDE_COMMITTEE_PARTS.map((part) => ({ part, indoor: "", outdoor: "" }));
}

/** 다음주기도 3칸 기본값 */
export function emptyNextWeekPrayer(): string[] {
  return NEXT_WEEK_PRAYER_PARTS.map(() => "");
}

/**
 * 주보(주일) 날짜로부터 그 다음날부터 토요일까지 월·화·수·목·금·토 6개의 날짜를 자동 생성한다.
 * dateISO 가 비어있거나 파싱 실패 시 date 는 "월" 같은 라벨만 사용.
 */
export function buildDawnReadings(
  dateISO: string | undefined,
  previous?: DawnReading[],
): DawnReading[] {
  const labels = DAWN_WEEKDAY_LABELS;
  const base = dateISO ? new Date(dateISO + "T00:00:00") : null;
  return labels.map((label, idx) => {
    const prev = previous?.[idx];
    let dateStr: string;
    if (base && !Number.isNaN(base.getTime())) {
      const d = new Date(base);
      d.setDate(base.getDate() + idx + 1); // 주일(+0) 다음날이 월요일(+1)
      const m = d.getMonth() + 1;
      const day = d.getDate();
      dateStr = `${m}월 ${day}일(${label})`;
    } else {
      dateStr = `(${label})`;
    }
    return { date: dateStr, passage: prev?.passage ?? "" };
  });
}
