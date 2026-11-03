import { describe, expect, it } from "vitest";
import {
  APOSTLES_CREED_RESOURCE_ID,
  collectRelationIds,
  collectStoredResourceIds,
  collectStoredVideoIds,
  createDefaultMobileServices,
  createMobileService,
  extractYouTubeVideoId,
  isServiceLive,
  legacyWeeklyToMobileServices,
  normalizeBulletinText,
  rebaseMobileServices,
  resolveMobileServices,
  selectMobileServiceId,
} from "@/lib/mobile-bulletin";
import { createEmptyWeeklyInput, MobileServicesSchema } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";
import type { Weekly } from "@/types/notice";

const services: MobileService[] = [
  {
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "",
    liveUrl: "https://www.youtube.com/live/live123",
    videoId: "past123",
    items: [{ id: "creed", label: "신앙고백", summary: "사도신경", assignees: [], emphasized: false, standing: false, visible: true, resourceId: APOSTLES_CREED_RESOURCE_ID, externalUrl: null }],
  },
  {
    id: "wed",
    type: "wednesday",
    label: "수요예배",
    startsAt: "2026-07-29T19:30:00+09:00",
    endsAt: "2026-07-29T21:00:00+09:00",
    primary: false,
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: null,
    items: [],
  },
];

const legacyWeekly: Weekly = {
  ...createEmptyWeeklyInput(),
  id: "legacy",
  title: "기존 주보",
  date: "2026-07-26",
  created_at: "2026-07-20T00:00:00Z",
  worship_leader: "인도자",
  worship_items: [
    {
      marker: "",
      label: "신앙고백",
      content: "사도신경",
      assignees: [],
      subRows: [],
      emphasize: false,
    },
  ],
  wednesday_service: {
    leader: "인도자",
    scripture: "요한복음 3:16",
    title: "하나님의 사랑",
    pastor: "담임목사",
    hymn: "310장",
    benediction: "담임목사",
  },
  mobile_services: [],
};

describe("selectMobileServiceId", () => {
  it("selects a service from 15 minutes before start through 30 minutes after end", () => {
    expect(selectMobileServiceId(services, new Date("2026-07-25T22:45:00Z"))).toBe("sun");
    expect(isServiceLive(services[0], new Date("2026-07-26T05:00:00Z"))).toBe(true);
    expect(isServiceLive(services[0], new Date("2026-07-25T22:44:59.999Z"))).toBe(false);
    expect(isServiceLive(services[0], new Date("2026-07-26T05:00:00.001Z"))).toBe(false);
  });

  it("selects today's next service, then falls back to the primary service", () => {
    expect(selectMobileServiceId(services, new Date("2026-07-29T08:00:00Z"))).toBe("wed");
    expect(selectMobileServiceId(services, new Date("2026-07-30T03:00:00Z"))).toBe("sun");
  });

  it("compares calendar days in KST across UTC midnight", () => {
    const midnightService: MobileService = {
      ...services[1],
      id: "midnight",
      startsAt: "2026-07-27T00:30:00+09:00",
      endsAt: "2026-07-27T01:30:00+09:00",
    };
    expect(selectMobileServiceId([midnightService], new Date("2026-07-26T15:00:00Z"))).toBe("midnight");
  });
});

it("rebases copied services by the bulletin date delta", () => {
  const shifted = rebaseMobileServices(services, "2026-07-26", "2026-08-02");
  expect(shifted[1].startsAt).toBe("2026-08-05T19:30:00+09:00");
});

it("creates Sunday and Wednesday defaults for a bulletin date", () => {
  const created = createDefaultMobileServices("2026-07-26");
  expect(created.map((service) => service.type)).toEqual(["sunday", "wednesday"]);
  expect(createMobileService("friday", "2026-07-26").startsAt).toBe(
    "2026-07-31T20:30:00+09:00",
  );
});

it("extracts supported YouTube URLs and rejects unrelated hosts", () => {
  expect(extractYouTubeVideoId("https://youtu.be/abc_123-xyZ")).toBe("abc_123-xyZ");
  expect(extractYouTubeVideoId("https://example.com/watch?v=abc")).toBeNull();
});

it("deduplicates relation IDs", () => {
  expect(collectRelationIds(services)).toEqual({
    resourceIds: [APOSTLES_CREED_RESOURCE_ID],
    videoIds: ["past123"],
  });
});

it("keeps hidden IDs for save-time relation validation but omits them publicly", () => {
  const hidden: MobileService = {
    ...services[1],
    visible: false,
    videoId: "hidden123",
    items: [{ ...services[0].items[0], id: "hidden-creed", resourceId: "00000000-0000-4000-8000-000000000002" }],
  };
  expect(collectRelationIds([...services, hidden])).toEqual({
    resourceIds: [APOSTLES_CREED_RESOURCE_ID],
    videoIds: ["past123"],
  });
  expect(collectStoredResourceIds([...services, hidden])).toEqual([
    APOSTLES_CREED_RESOURCE_ID,
    "00000000-0000-4000-8000-000000000002",
  ]);
  expect(collectStoredVideoIds([...services, hidden])).toEqual(["past123", "hidden123"]);
});

it("ignores a hidden item while retaining its stored reference", () => {
  const hidden = structuredClone(services);
  hidden[0].items[0].visible = false;
  expect(collectRelationIds(hidden)).toEqual({ resourceIds: [], videoIds: ["past123"] });
  expect(collectStoredResourceIds(hidden)).toEqual([APOSTLES_CREED_RESOURCE_ID]);
});

it("ignores hidden services publicly but validates their stored relations", () => {
  const hidden = structuredClone(services);
  hidden[0].visible = false;
  expect(collectRelationIds(hidden)).toEqual({ resourceIds: [], videoIds: [] });
  expect(collectStoredResourceIds(hidden)).toEqual([APOSTLES_CREED_RESOURCE_ID]);
  expect(collectStoredVideoIds(hidden)).toEqual(["past123"]);
});

it("maps legacy Sunday and Wednesday content and links the creed", () => {
  const mapped = legacyWeeklyToMobileServices(legacyWeekly);
  expect(mapped.map((service) => service.type)).toEqual(["sunday", "wednesday"]);
  expect(mapped[0].items[0].resourceId).toBe(APOSTLES_CREED_RESOURCE_ID);
});

describe("normalizeBulletinText", () => {
  it("joins HWP letter-spacing padding into one word", () => {
    expect(normalizeBulletinText("성 경 봉 독")).toBe("성경봉독");
    expect(normalizeBulletinText("기     원")).toBe("기원");
    expect(normalizeBulletinText("신 앙 고 백")).toBe("신앙고백");
    expect(normalizeBulletinText("다 함 께")).toBe("다함께");
  });

  it("keeps real word boundaries and collapses runs to one space", () => {
    expect(normalizeBulletinText("봉헌  및  기도")).toBe("봉헌 및 기도");
    expect(normalizeBulletinText("예배의 부름")).toBe("예배의 부름");
    expect(normalizeBulletinText("  결단의 찬송  ")).toBe("결단의 찬송");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeBulletinText("")).toBe("");
    expect(normalizeBulletinText("   ")).toBe("");
  });
});

it("carries the paper bulletin standing marker into the mobile order", () => {
  const mapped = legacyWeeklyToMobileServices({
    ...legacyWeekly,
    worship_items: [
      { marker: "※", label: "성 경 봉 독", content: "빌 3:12 - 14", assignees: ["다 함 께"], subRows: [], emphasize: false },
      { marker: "", label: "찬    양", content: "모든 이름 위에", assignees: [], subRows: [], emphasize: false },
    ],
  });
  expect(mapped[0].items[0]).toMatchObject({
    label: "성경봉독",
    standing: true,
    assignees: ["다함께"],
  });
  expect(mapped[0].items[1]).toMatchObject({ label: "찬양", standing: false });
});

it("appends a legacy closing hymn when an earlier hymn is not the closing item", () => {
  const mapped = legacyWeeklyToMobileServices({
    ...legacyWeekly,
    closing_hymn: "310장",
    worship_items: [{
      marker: "",
      label: "찬송",
      content: "20장",
      assignees: [],
      subRows: [],
      emphasize: false,
    }],
  });
  expect(mapped[0].items.at(-1)).toMatchObject({ label: "찬송", summary: "310장" });
});

it("falls back to legacy content when stored mobile JSON is invalid", () => {
  const invalid = {
    ...legacyWeekly,
    mobile_services: [{ id: "broken" }] as unknown as MobileService[],
  };
  expect(resolveMobileServices(invalid).map((service) => service.type)).toEqual([
    "sunday",
    "wednesday",
  ]);
});

it("rejects duplicate IDs, multiple primary services, bad URLs, and reversed time", () => {
  const invalid = structuredClone(services);
  invalid[1].id = invalid[0].id;
  invalid[1].primary = true;
  invalid[1].liveUrl = "http://example.com/live";
  invalid[1].endsAt = invalid[1].startsAt;
  const result = MobileServicesSchema.safeParse(invalid);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "예배 ID가 중복되었습니다",
        "기본 예배는 하나만 지정할 수 있습니다",
        "YouTube HTTPS 라이브 주소만 사용할 수 있습니다",
        "종료 시각은 시작 시각 이후여야 합니다",
      ]),
    );
  }
});

it("defaults standing to false for order items saved before the field existed", () => {
  const legacy = structuredClone(services) as unknown as Array<{
    items: Array<Record<string, unknown>>;
  }>;
  for (const service of legacy) {
    for (const item of service.items) delete item.standing;
  }

  const result = MobileServicesSchema.safeParse(legacy);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.flatMap((service) => service.items).every((item) => item.standing === false)).toBe(true);
  }
});
