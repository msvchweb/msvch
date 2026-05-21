/**
 * 주보 HWP/HWPX 자동 채우기 — 파싱 결과 DTO.
 *
 * 서버: 표 매핑(휴리스틱) + Gemini 자유 텍스트 구조화의 합집합.
 * 클라이언트: 검수 모달이 항목별로 토글한 뒤 WeeklyForm 의 form state 에 patch.
 *
 * 모든 항목은 confidence(0~1) 와 함께 옵셔널로 채워진다.
 *   ≥ 0.7 : 자동 체크 (사용자가 끄지 않는 한 채워짐)
 *   < 0.7 : amber 경고 + 자동 OFF (사용자가 명시적으로 켜야 채움)
 */

import type {
  WorshipItemRow,
  OfferingCategoryRow,
  GuideCommitteeRow,
  DawnReading,
  NewsItem,
  MeetingRow,
  NewMemberRow,
} from "@/types/notice";

export type WeeklyImportStatus =
  | "uploaded"
  | "converting"
  | "parsing"
  | "parsed"
  | "failed";

export type WeeklyImportSourceFormat = "hwp" | "hwpx";

/** 한 항목의 추출 결과 — value 와 confidence 묶음 */
export interface ImportField<T> {
  value: T;
  confidence: number;
}

/**
 * 추출 결과 — 모든 필드 옵셔널.
 * 검수 모달은 정의된 필드만 토글로 보여준다.
 */
export interface WeeklyImportResult {
  date?: ImportField<string>;
  worshipItems?: ImportField<WorshipItemRow[]>;
  offerings?: ImportField<OfferingCategoryRow[]>;
  dawnReadings?: ImportField<DawnReading[]>;
  guideCommittee?: ImportField<GuideCommitteeRow[]>;
  nextWeekPrayer?: ImportField<string[]>;
  news?: ImportField<NewsItem[]>;
  meetings?: ImportField<MeetingRow[]>;
  newFamily?: ImportField<NewMemberRow[]>;
  sermonTitle?: ImportField<string>;
  sermonPastor?: ImportField<string>;
  /** 마스터(올해 표어 등)와 다른 값을 발견했거나, 알 수 없는 셀이 있을 때 — Q3=B: 경고만 */
  warnings: string[];
}

/** Storage + DB 상태 폴링 응답 (Phase 2: .hwp 비동기 변환 흐름) */
export interface WeeklyImportRecord {
  id: string;
  fileName: string;
  sourceFormat: WeeklyImportSourceFormat;
  status: WeeklyImportStatus;
  errorMessage: string | null;
  result: WeeklyImportResult | null;
  createdAt: string;
  updatedAt: string;
}

/** 검수 모달에서 사용자가 선택한 항목 키 */
export type WeeklyImportFieldKey =
  | "date"
  | "worshipItems"
  | "offerings"
  | "dawnReadings"
  | "guideCommittee"
  | "nextWeekPrayer"
  | "news"
  | "meetings"
  | "newFamily"
  | "sermonTitle"
  | "sermonPastor";

export const WEEKLY_IMPORT_FIELD_LABELS: Record<WeeklyImportFieldKey, string> = {
  date: "날짜",
  worshipItems: "예배순서 (16행)",
  offerings: "헌금 명세 (10항목)",
  dawnReadings: "새벽예배 (월~토)",
  guideCommittee: "안내위원 (1·2·3부)",
  nextWeekPrayer: "다음주 기도제목",
  news: "교회소식",
  meetings: "정기모임",
  newFamily: "새가족",
  sermonTitle: "설교 제목",
  sermonPastor: "설교자",
};

/** confidence ≥ THRESH_AUTO_ON 이면 검수 모달이 기본 체크 */
export const IMPORT_CONFIDENCE_AUTO_ON = 0.7;
/** confidence < THRESH_WARN 이면 amber 경고 */
export const IMPORT_CONFIDENCE_WARN_BELOW = 0.6;
