import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBulletin } from "./MobileBulletin";
import { createDefaultMobileServices } from "@/lib/mobile-bulletin";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";
import type { Weekly } from "@/types/notice";

const { loadRelationsMock, loadPrayersMock, loadAccountMock } = vi.hoisted(() => ({
  loadRelationsMock: vi.fn(async () => ({ resourcesById: {}, validVideoIds: [] })),
  loadPrayersMock: vi.fn(async () => [] as string[]),
  loadAccountMock: vi.fn(async () => null),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/mobile-bulletin-data", () => ({
  loadMobileBulletinRelations: loadRelationsMock,
}));
vi.mock("@/lib/bulletin-master", () => ({
  loadCommunityPrayers: loadPrayersMock,
  loadOfferingAccount: loadAccountMock,
}));
vi.mock("./MobileServiceExperience", () => ({
  MobileServiceExperience: ({ services }: { services: MobileService[] }) => (
    <div data-testid="digital-service">{services[0].label}</div>
  ),
}));

const baseWeekly: Weekly = {
  ...createEmptyWeeklyInput(),
  id: "weekly",
  title: "테스트 주보",
  date: "2026-07-26",
  created_at: "2026-07-20T00:00:00Z",
  worship_items: [
    { marker: "", label: "신앙고백", content: "사도신경", assignees: [], subRows: [], emphasize: false },
  ],
  photo_images: ["https://example.com/paper-weekly.jpg"],
  mobile_services: [],
};

describe("MobileBulletin", () => {
  afterEach(cleanup);
  beforeEach(() => {
    loadRelationsMock.mockClear();
    loadPrayersMock.mockClear();
    loadAccountMock.mockClear();
  });

  it("renders valid saved mobile services", async () => {
    render(await MobileBulletin({
      weekly: { ...baseWeekly, mobile_services: createDefaultMobileServices("2026-07-26") },
    }));
    expect(screen.getByTestId("digital-service")).toHaveTextContent("주일예배");
    expect(loadRelationsMock).toHaveBeenCalledOnce();
  });

  it("does not convert legacy fields or fall back to paper photos", async () => {
    render(await MobileBulletin({ weekly: baseWeekly }));
    expect(screen.getByText("모바일 주보가 준비 중입니다")).toBeInTheDocument();
    expect(screen.queryByTestId("digital-service")).not.toBeInTheDocument();
    expect(loadRelationsMock).not.toHaveBeenCalled();
  });

  it("uses the same prepared state for a missing weekly or invalid mobile JSON", async () => {
    const { rerender } = render(await MobileBulletin({ weekly: null }));
    expect(screen.getByText("모바일 주보가 준비 중입니다")).toBeInTheDocument();

    rerender(await MobileBulletin({
      weekly: { ...baseWeekly, mobile_services: [{ id: "broken" }] as unknown as MobileService[] },
    }));
    expect(screen.getByText("모바일 주보가 준비 중입니다")).toBeInTheDocument();
  });
});
