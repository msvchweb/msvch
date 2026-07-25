import { act, cleanup, fireEvent, render as baseRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APOSTLES_CREED_RESOURCE_ID } from "@/lib/mobile-bulletin";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";
import { BulletinThemeShell } from "./BulletinThemeShell";
import { MobileServiceExperience } from "./MobileServiceExperience";

// MobileServiceExperience 는 테마 토글을 shell 컨텍스트에서 받으므로 항상 감싸서 렌더한다.
function render(ui: React.ReactNode) {
  return baseRender(<BulletinThemeShell>{ui}</BulletinThemeShell>);
}

const services: MobileService[] = [
  {
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "담임목사",
    liveUrl: "https://www.youtube.com/live/live123",
    videoId: "past123",
    items: [
      {
        id: "creed",
        label: "신앙고백",
        summary: "사도신경",
        assignees: [],
        emphasized: false,
        standing: false,
        visible: true,
        resourceId: APOSTLES_CREED_RESOURCE_ID,
        externalUrl: null,
      },
    ],
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
    videoId: "wed123",
    items: [
      {
        id: "word",
        label: "말씀",
        summary: "요한복음 3:16",
        assignees: ["담임목사"],
        emphasized: true,
        standing: false,
        visible: true,
        resourceId: null,
        externalUrl: null,
      },
    ],
  },
];

const creed = {
  id: APOSTLES_CREED_RESOURCE_ID,
  kind: "creed",
  title: "사도신경",
  reference: "신앙고백",
  content: "전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며",
  external_url: null,
  source_label: null,
  rights_note: null,
  is_active: true,
  created_at: "",
  updated_at: "",
} satisfies WorshipResource;

const baseProps = {
  title: "7월 넷째 주 주보",
  date: "2026-07-26",
  liturgyLabel: "성령강림 후",
  services,
  resourcesById: {},
  validVideoIds: [],
  initialNowIso: "2026-07-25T23:00:00Z",
};

afterEach(cleanup);

describe("MobileServiceExperience", () => {
  it("selects the active service and marks it LIVE", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T23:00:00Z"));
    try {
      render(<MobileServiceExperience {...baseProps} />);
      expect(screen.getByRole("tab", { name: "주일예배" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a manual tab selection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T00:00:00Z"));
    try {
      render(<MobileServiceExperience {...baseProps} />);
      fireEvent.click(screen.getByRole("tab", { name: "수요예배" }));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("tab", { name: "수요예배" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves between tabs with arrow keys", () => {
    render(<MobileServiceExperience {...baseProps} />);
    const sunday = screen.getByRole("tab", { name: "주일예배" });
    fireEvent.keyDown(sunday, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "수요예배" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "수요예배" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("points every tab at an existing tabpanel", () => {
    render(<MobileServiceExperience {...baseProps} />);
    for (const tab of screen.getAllByRole("tab")) {
      const panelId = tab.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId!)).toBeInTheDocument();
    }
  });

  it("moves to the last and first tabs with End and Home", () => {
    render(<MobileServiceExperience {...baseProps} />);
    const sunday = screen.getByRole("tab", { name: "주일예배" });
    const wednesday = screen.getByRole("tab", { name: "수요예배" });

    fireEvent.keyDown(sunday, { key: "End" });
    expect(wednesday).toHaveFocus();
    expect(wednesday).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(wednesday, { key: "Home" });
    expect(sunday).toHaveFocus();
    expect(sunday).toHaveAttribute("aria-selected", "true");
  });

  it("changes both the order and the recording with the selected service", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T03:00:00Z"));
    try {
      render(
        <MobileServiceExperience
          {...baseProps}
          validVideoIds={["past123", "wed123"]}
          initialNowIso="2026-07-30T03:00:00Z"
        />,
      );
      expect(screen.getByTitle("주일예배 영상")).toHaveAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/past123",
      );
      fireEvent.click(screen.getByRole("tab", { name: "수요예배" }));
      expect(screen.getByTitle("수요예배 영상")).toHaveAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/wed123",
      );
      expect(screen.getByText("요한복음 3:16")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens and closes the linked creed in a named dialog", () => {
    render(
      <MobileServiceExperience
        {...baseProps}
        resourcesById={{ [creed.id]: creed }}
      />,
    );
    const trigger = screen.getByRole("button", { name: "사도신경 내용 보기" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "사도신경" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "사도신경" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("does not expose an inactive linked resource", () => {
    render(
      <MobileServiceExperience
        {...baseProps}
        resourcesById={{ [creed.id]: { ...creed, is_active: false } }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "사도신경 내용 보기" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("사도신경")).toBeInTheDocument();
  });

  it("does not expose an unsafe resource URL", () => {
    const unsafeCreed: WorshipResource = {
      ...creed,
      external_url: "http://example.com/resource",
    };
    render(
      <MobileServiceExperience
        {...baseProps}
        resourcesById={{ [unsafeCreed.id]: unsafeCreed }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "사도신경 내용 보기" }));
    expect(
      screen.queryByRole("link", { name: "원문 링크 열기" }),
    ).not.toBeInTheDocument();
  });
});
