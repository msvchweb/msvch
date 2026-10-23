import { act, cleanup, fireEvent, render as baseRender, screen, within } from "@testing-library/react";
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

/**
 * 예배 자동 선택은 실제 시각에 의존한다. 픽스처가 2026-07-26 주간에 묶여 있으므로
 * 주일예배를 전제로 하는 검사는 시계를 고정하지 않으면 실행 날짜에 따라 깨진다.
 */
function atSundayService(assert: () => void): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(baseProps.initialNowIso));
  try {
    assert();
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("BulletinThemeShell", () => {
  it("uses stored dark mode and writes msvch_theme when toggled", () => {
    localStorage.setItem("msvch_theme", "dark");
    render(<MobileServiceExperience {...baseProps} />);

    fireEvent.click(screen.getByLabelText("밝은 화면으로 전환"));
    expect(localStorage.getItem("msvch_theme")).toBe("light");
    expect(screen.getByLabelText("어두운 화면으로 전환")).toBeInTheDocument();
  });
});

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

  it("switches the gradient hero from the fixed service navigator", () => {
    render(<MobileServiceExperience {...baseProps} />);
    const navigator = screen.getByRole("navigation", { name: "예배 빠른 선택" });
    fireEvent.click(within(navigator).getByRole("button", { name: "수요" }));
    expect(screen.getByRole("heading", { name: "수요예배" })).toBeInTheDocument();
  });

  it("labels the fixed navigator with short service names and marks the current one", () => {
    render(<MobileServiceExperience {...baseProps} />);
    const navigator = screen.getByRole("navigation", { name: "예배 빠른 선택" });
    const sunday = screen.getByRole("button", { name: "주일" });
    const wednesday = screen.getByRole("button", { name: "수요" });
    expect(navigator).toContainElement(sunday);
    expect(navigator).toContainElement(wednesday);

    fireEvent.click(wednesday);
    expect(wednesday).toHaveAttribute("aria-current", "true");
    expect(sunday).not.toHaveAttribute("aria-current");
  });

  it("shortens 기도회 names the same way the handoff does", () => {
    const named = (id: string, label: string): MobileService => ({
      ...services[0],
      id,
      label,
      items: [],
    });
    render(
      <MobileServiceExperience
        {...baseProps}
        services={[
          named("a", "주일예배"),
          named("b", "오후예배"),
          named("c", "금요기도회"),
          named("d", "새벽기도회"),
          named("e", "예배"),
        ]}
      />,
    );
    const navigator = screen.getByRole("navigation", { name: "예배 빠른 선택" });
    expect(
      within(navigator)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["주일", "오후", "금요", "새벽", "예배"]);
  });

  it("returns the reading position to the top of the bulletin on every service switch", () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this.tagName);
    };

    try {
      render(<MobileServiceExperience {...baseProps} />);
      const navigator = screen.getByRole("navigation", { name: "예배 빠른 선택" });

      // 하단 고정 선택바
      fireEvent.click(within(navigator).getByRole("button", { name: "수요" }));
      expect(scrolled).toEqual(["ARTICLE"]);

      // 상단 탭
      fireEvent.click(screen.getByRole("tab", { name: "주일예배" }));
      expect(scrolled).toEqual(["ARTICLE", "ARTICLE"]);

      // 화살표 키
      fireEvent.keyDown(screen.getByRole("tab", { name: "주일예배" }), {
        key: "ArrowRight",
      });
      expect(scrolled).toEqual(["ARTICLE", "ARTICLE", "ARTICLE"]);
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("does not move the reading position when no one picked a service", () => {
    const scrolled: string[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this.tagName);
    };

    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(baseProps.initialNowIso));
      render(<MobileServiceExperience {...baseProps} />);
      act(() => vi.advanceTimersByTime(60_000));
      expect(scrolled).toEqual([]);
    } finally {
      vi.useRealTimers();
      Element.prototype.scrollIntoView = original;
    }
  });

  it("keeps an accessible resource trigger inside an order card", () => {
    atSundayService(() => {
      render(
        <MobileServiceExperience
          {...baseProps}
          resourcesById={{ [creed.id]: creed }}
        />,
      );
      const trigger = screen.getByRole("button", { name: /사도신경.*전문 보기/ });
      expect(trigger.closest("li")).toHaveTextContent("신앙고백");
    });
  });

  it("opens and closes the linked creed in a named dialog", () => {
    atSundayService(() => {
      render(
        <MobileServiceExperience
          {...baseProps}
          resourcesById={{ [creed.id]: creed }}
        />,
      );
      const trigger = screen.getByRole("button", { name: "사도신경 전문 보기" });
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: "사도신경" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByRole("dialog", { name: "사도신경" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("does not expose an inactive linked resource", () => {
    atSundayService(() => {
      render(
        <MobileServiceExperience
          {...baseProps}
          resourcesById={{ [creed.id]: { ...creed, is_active: false } }}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "사도신경 전문 보기" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("사도신경")).toBeInTheDocument();
    });
  });

  it("does not expose an unsafe resource URL", () => {
    const unsafeCreed: WorshipResource = {
      ...creed,
      external_url: "http://example.com/resource",
    };
    atSundayService(() => {
      render(
        <MobileServiceExperience
          {...baseProps}
          resourcesById={{ [unsafeCreed.id]: unsafeCreed }}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "사도신경 전문 보기" }));
      expect(
        screen.queryByRole("link", { name: "원문 링크 열기" }),
      ).not.toBeInTheDocument();
    });
  });
});

describe("예배 순서 레이아웃", () => {
  /** "예배 순서" 제목을 감싼 바깥 블록 (mt-6 scroll-mt-20 …) */
  function orderBlock(): HTMLElement {
    const heading = screen.getByRole("heading", { name: "예배 순서" });
    return heading.parentElement!.parentElement!;
  }

  function withItem(item: Partial<MobileService["items"][number]>): MobileService[] {
    return [{ ...services[0], items: [{ ...services[0].items[0], ...item }] }];
  }

  it("puts the assignee on the order name row and the summary on the next line", () => {
    atSundayService(() => {
      render(
        <MobileServiceExperience
          {...baseProps}
          services={withItem({
            label: "성 경 봉 독",
            summary: "빌 3:12 - 14",
            assignees: ["다 함 께"],
            resourceId: null,
          })}
        />,
      );

      const label = screen.getByText("성경봉독");
      const assignee = screen.getByText("다함께");
      const summary = screen.getByText("빌 3:12 - 14");

      // 순서명과 담당자는 같은 행 컨테이너 안에 있다.
      expect(label.parentElement).toContainElement(assignee);
      // 내용은 그 행 밖 — 아랫줄이다.
      expect(label.parentElement).not.toContainElement(summary);
    });
  });

  it("marks a standing item and shows the footnote", () => {
    atSundayService(() => {
      render(<MobileServiceExperience {...baseProps} services={withItem({ standing: true })} />);
      expect(screen.getByText("▲ 표는 일어서 주시기 바랍니다")).toBeInTheDocument();
      expect(screen.getByText("기립")).toBeInTheDocument();
    });
  });

  it("omits the standing footnote when nothing stands", () => {
    atSundayService(() => {
      render(<MobileServiceExperience {...baseProps} />);
      expect(
        screen.queryByText("▲ 표는 일어서 주시기 바랍니다"),
      ).not.toBeInTheDocument();
    });
  });

  it("pins the video and drops the order snap while a video plays", () => {
    atSundayService(() => {
      const { container } = render(<MobileServiceExperience {...baseProps} />);
      const iframe = container.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe!.parentElement!.className).toContain("sticky");
      expect(iframe!.getAttribute("allow")).toContain("fullscreen");
      expect(orderBlock().className).not.toContain("snap-start");
    });
  });

  it("keeps the order snap when no video is available", () => {
    atSundayService(() => {
      const { container } = render(
        <MobileServiceExperience {...baseProps} services={[services[1]]} />,
      );
      expect(container.querySelector("iframe")).toBeNull();
      expect(orderBlock().className).toContain("snap-start");
    });
  });
});
