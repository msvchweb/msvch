export interface Notice {
  id: string;
  title: string;
  slug: string;
  category: "일반" | "긴급" | "행사";
  content: string;
  images: string[];
  is_public: boolean;
  date: string | null;
  created_at: string;
}

/**
 * 홈 히어로 슬라이드 — 플랫폼 공용 DTO.
 * 웹/모바일 동일 스펙. 데이터 소스가 바뀌어도 이 형태가 안정이면 클라이언트 무수정.
 */
export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  href: string;
  date: string | null;
}

export interface SpecialPraise {
  song: string;
  choir: string;
}

export interface SpecialPraiseField {
  part1: SpecialPraise;
  part2: SpecialPraise;
}

export interface AfternoonService {
  scripture: string;
  title: string;
  pastor: string;
}

export interface WednesdayService {
  leader: string;
  scripture: string;
  title: string;
  pastor: string;
  hymn: string;
  benediction: string;
}

export interface DawnReading {
  date: string;
  passage: string;
}

export interface OfferingMembers {
  p1: string;
  p2: string;
  p3: string;
}

export interface PublishChannels {
  website: boolean;
  alimtalk: boolean;
  instagram: boolean;
}

export interface NewsItem {
  title: string;
  items: string[];
}

export interface MeetingRow {
  group: string;
  when: string;
  place: string;
}

export interface NewMemberRow {
  no: string;
  regNo: string;
  name: string;
  inviter: string;
  dept: string;
}

export interface MemorizeVerse {
  ref: string;
  text: string;
}

export interface WorshipSubRow {
  content: string;
  assignee: string;
}

export interface WorshipItemRow {
  marker: string;
  label: string;
  content: string;
  assignees: string[];
  subRows: WorshipSubRow[];
  emphasize: boolean;
}

export interface GuideCommitteeRow {
  part: string;
  indoor: string;
  outdoor: string;
}

export interface OfferingCategoryRow {
  label: string;
  names: string;
}

export interface Weekly {
  id: string;
  title: string;
  date: string | null;
  created_at: string;
  volume: number | null;
  issue: number | null;
  special_praise: SpecialPraiseField;
  sermon_title: string | null;
  sermon_pastor: string | null;
  closing_hymn: string | null;
  weekly_verse: string | null;
  afternoon_service: AfternoonService;
  /** 주일오후 찬양예배 자리를 "목장모임"(이미지+제목)으로 대체 */
  afternoon_mokjang_mode: boolean;
  wednesday_service: WednesdayService;
  dawn_readings: DawnReading[];
  offering_members: OfferingMembers;
  is_published: boolean;
  publish_channels: PublishChannels;
  // ── migration 011 신규 필드 (주보 레이아웃 직결)
  news: NewsItem[];
  meetings: MeetingRow[];
  north_korea_note: string | null;
  bible_reading: string | null;
  new_members: NewMemberRow[];
  meal_duty_note: string | null;
  volunteer_note: string | null;
  worship_leader: string | null;
  worship_items: WorshipItemRow[];
  memorize_verse: MemorizeVerse;
  next_week_prayer: string[];
  guide_committee: GuideCommitteeRow[];
  offerings: OfferingCategoryRow[];
  /** 부활감사 자리(SPECIAL_OFFERING_INDEX)의 토글/라벨. 비활성 시 주보 미표시. */
  special_offering: { enabled: boolean; label: string };
  /** 페이지 4(교회소식 영역) 섹션별 표시 토글. 비활성 시 주보에서 행 제거 + 번호 재계산. */
  front_toggles: {
    meetings: boolean;
    bibleReading: boolean;
    newMembers: boolean;
    mealDuty: boolean;
    volunteerNote: boolean;
  };
  week_total: string | null;
  cumulative_total: string | null;
  /**
   * 이미지형 주보 — 업로드한 사진들의 Storage public URL 배열 (마이그 040).
   * 비어있지 않으면 공개 상세뷰에서 구조화 렌더링 대신 사진을 표시. DB default '{}' 라 항상 배열.
   */
  photo_images: string[];
}
