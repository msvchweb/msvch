/**
 * 새가족 등록 — 공개 폼 + admin DTO.
 * 마이그레이션 024 와 1:1 대응.
 */

export type NewFamilyVisitPath =
  | "website"
  | "youtube"
  | "recommendation"
  | "visited_first"
  | "etc";

export type NewFamilyFaithStatus = "accepted" | "not_yet" | "unsure";

export type NewFamilyGender = "male" | "female";

export type NewFamilyChurchHistory =
  | "never"
  | "attended_no_baptism"
  | "baptized_inactive"
  | "baptized_active"
  | "etc";

export type NewFamilyStatus = "new" | "contacted" | "assigned" | "done";

/** 공개 폼 → 서버 전송 페이로드 */
export interface NewFamilyRegistrationInput {
  visitPaths?: NewFamilyVisitPath[];
  visitPathsEtc?: string;
  faithStatus?: NewFamilyFaithStatus;
  name: string;
  gender: NewFamilyGender;
  birth?: string;
  ageGroup?: string;
  phone?: string;
  instagramId?: string;
  region?: string;
  churchHistory?: NewFamilyChurchHistory;
  churchHistoryEtc?: string;
  message?: string;
  privacyConsent: true;
}

/** admin UI / DB row → DTO */
export interface NewFamilyRegistration {
  id: string;
  visitPaths: NewFamilyVisitPath[];
  visitPathsEtc: string | null;
  faithStatus: NewFamilyFaithStatus | null;
  name: string;
  gender: NewFamilyGender;
  birth: string | null;
  ageGroup: string | null;
  phone: string | null;
  instagramId: string | null;
  region: string | null;
  churchHistory: NewFamilyChurchHistory | null;
  churchHistoryEtc: string | null;
  message: string | null;
  privacyConsent: boolean;
  privacyConsentedAt: string;
  status: NewFamilyStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 한국어 라벨 매핑 — 폼/관리자 페이지 공용 */
export const VISIT_PATH_LABELS: Record<NewFamilyVisitPath, string> = {
  website: "웹사이트 검색을 통해서",
  youtube: "유튜브 검색을 통해서",
  recommendation: "지인의 추천에 의해서",
  visited_first: "직접 방문해 본 후에 새가족으로 등록하고 싶어서",
  etc: "기타",
};

export const FAITH_STATUS_LABELS: Record<NewFamilyFaithStatus, string> = {
  accepted: "네, 이미 예수님을 주님으로 영접했습니다.",
  not_yet: "아니요, 아직 예수님을 영접하지 않았습니다.",
  unsure: "잘 모르겠습니다.",
};

export const GENDER_LABELS: Record<NewFamilyGender, string> = {
  male: "남성",
  female: "여성",
};

export const CHURCH_HISTORY_LABELS: Record<NewFamilyChurchHistory, string> = {
  never: "교회를 다녀 본 적이 없습니다.",
  attended_no_baptism:
    "세례를 받지 않았지만, 다른 교회에 몇 달, 혹은 몇 년 다녔습니다.",
  baptized_inactive:
    "다른 교회에서 세례를 받았지만 지금은 다니고 있지 않습니다.",
  baptized_active:
    "다른 교회에서 세례를 받았고, 지금도 여전히 다니고 있습니다.",
  etc: "기타",
};

export const STATUS_LABELS: Record<NewFamilyStatus, string> = {
  new: "신규",
  contacted: "연락완료",
  assigned: "교구배정",
  done: "완료",
};
