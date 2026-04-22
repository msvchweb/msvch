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
  scripture: string;
  title: string;
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

export interface PrayerItem {
  text: string;
}

export interface Announcement {
  text: string;
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
  pdf_url: string | null;
  created_at: string;
  volume: number | null;
  issue: number | null;
  hymn_number: string | null;
  scripture: string | null;
  special_praise: SpecialPraiseField;
  sermon_title: string | null;
  sermon_pastor: string | null;
  closing_hymn: string | null;
  weekly_verse: string | null;
  afternoon_service: AfternoonService;
  wednesday_service: WednesdayService;
  dawn_readings: DawnReading[];
  offering_members: OfferingMembers;
  prayer_items: PrayerItem[];
  announcements: Announcement[];
  servants_text: string | null;
  offering_list_text: string | null;
  sogroup_text?: string | null;
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
  week_total: string | null;
  cumulative_total: string | null;
}
