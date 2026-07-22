export type MobileServiceType = "sunday" | "wednesday" | "friday" | "other";
export type WorshipResourceKind = "creed" | "hymn" | "scripture" | "text" | "link";

export interface MobileServiceItem {
  id: string;
  label: string;
  summary: string;
  assignees: string[];
  emphasized: boolean;
  visible: boolean;
  resourceId: string | null;
  externalUrl: string | null;
}

export interface MobileService {
  id: string;
  type: MobileServiceType;
  label: string;
  startsAt: string;
  endsAt: string;
  primary: boolean;
  visible: boolean;
  leader: string;
  liveUrl: string | null;
  videoId: string | null;
  items: MobileServiceItem[];
}

export interface WorshipResource {
  id: string;
  kind: WorshipResourceKind;
  title: string;
  reference: string;
  content: string;
  external_url: string | null;
  source_label: string | null;
  rights_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MobileBulletinRelations {
  resourcesById: Record<string, WorshipResource>;
  validVideoIds: string[];
}
