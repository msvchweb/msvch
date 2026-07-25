import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChurchNews, NextWeekServing, PrayerTopics } from "./MobileBulletinSections";

afterEach(cleanup);

describe("MobileBulletinSections", () => {
  it("hides completely empty serving and news sections", () => {
    render(
      <>
        <NextWeekServing
          prayer={[]}
          offering={{ p1: "", p2: "", p3: "" }}
          guides={[]}
        />
        <ChurchNews news={[]} />
        <PrayerTopics prayers={["", "   "]} />
      </>,
    );
    expect(
      screen.queryByRole("heading", { name: "다음 주 섬김" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "교회소식" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "기도제목" }),
    ).not.toBeInTheDocument();
  });

  it("numbers the community prayer topics", () => {
    render(<PrayerTopics prayers={["복음의 열매를 맺게 하소서", "  ", "믿음의 가정이 되게 하소서"]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent("2믿음의 가정이 되게 하소서");
  });

  it("opens the first non-empty news group", () => {
    render(
      <ChurchNews
        news={[
          { title: "", items: [""] },
          { title: "이번 주 안내", items: ["새가족 환영회가 있습니다."] },
        ]}
      />,
    );
    expect(screen.getByText("이번 주 안내").closest("details")).toHaveAttribute(
      "open",
    );
  });
});
