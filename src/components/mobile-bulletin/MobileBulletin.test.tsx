import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBulletin } from "./MobileBulletin";
import { createDefaultMobileServices } from "@/lib/mobile-bulletin";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { OfferingAccountValue } from "@/types/bulletin-master";
import type { MobileService } from "@/types/mobile-bulletin";
import type { Weekly } from "@/types/notice";

const { loadRelationsMock, loadPrayersMock, loadAccountMock } = vi.hoisted(() => ({
  loadRelationsMock: vi.fn(async () => ({ resourcesById: {}, validVideoIds: [] })),
  loadPrayersMock: vi.fn(async () => [] as string[]),
  loadAccountMock: vi.fn(async (): Promise<OfferingAccountValue | null> => null),
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

  it("composes service, news, serving, prayer and offering sections in the handoff order", async () => {
    loadPrayersMock.mockResolvedValueOnce(["나라와 민족을 위하여"]);
    loadAccountMock.mockResolvedValueOnce({
      bank: "농협",
      number: "355-0068-1115-73",
      holder: "명성비전교회",
      note: "",
    });

    render(await MobileBulletin({
      weekly: {
        ...baseWeekly,
        mobile_services: createDefaultMobileServices("2026-07-26"),
        news: [{ title: "교육부 소식", items: ["여름성경학교가 열립니다."] }],
        next_week_prayer: ["김집사"],
      },
    }));

    for (const name of ["교회소식", "다음 주 섬김", "기도제목", "온라인 헌금"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }

    // 핸드오프 순서: 교회소식 → 다음 주 봉사 → 기도제목 → 온라인 헌금
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["교회소식", "다음 주 섬김", "기도제목", "온라인 헌금"]);
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
