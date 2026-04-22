// 주보 마스터 데이터 타입 (migration 012)
// 이 값들은 DB 에서 실시간 조회하여 주보 렌더링에 주입한다.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ChurchSettingRow {
  key: string;
  value: JsonValue;
  updated_at: string;
}

export interface TopicOfYearValue {
  text: string;
  year: number;
}

export interface MokjangEntryRow {
  id: number;
  name: string;
  sub: string;
  year: number | null;
  active: boolean;
  updated_at: string;
}

export interface ServantRow {
  id: string;
  seq: number;
  role: string;
  names: string;
  updated_at: string;
}

export interface SupportSectionRow {
  id: string;
  seq: number;
  heading: string;
  lines: string[];
  updated_at: string;
}

export interface CommunityPrayerRow {
  id: string;
  seq: number;
  text: string;
  updated_at: string;
}

// 주보 매핑 함수에 주입되는 통합 마스터 데이터
export interface BulletinMasterData {
  topicOfYear: string;
  mokjang: { id: number; name: string; sub: string }[];
  servants: { role: string; names: string }[];
  supports: { heading: string; lines: string[] }[];
  communityPrayers: string[];
}
