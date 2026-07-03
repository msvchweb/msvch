/**
 * 명비 기도인 신청 — 공개 폼 + admin DTO.
 * 마이그레이션 044 와 1:1 대응.
 */

export interface MyeongbiPrayerApplicationInput {
  name: string;
  phone: string;
  affiliation: string;
  available: true;
  message?: string;
}

export interface MyeongbiPrayerApplication {
  id: string;
  name: string;
  phone: string;
  affiliation: string;
  available: boolean;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}
