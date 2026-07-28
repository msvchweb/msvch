import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ChurchNews,
  NextWeekServing,
  OfferingAccount,
  PrayerTopics,
} from "./MobileBulletinSections";

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

  it("shows the first news item as an expanded handoff card", () => {
    render(<ChurchNews news={[{ title: "소식", items: ["내용"] }]} />);
    expect(screen.getByText("내용")).toBeVisible();
  });

  it("renders the offering account from master values", () => {
    render(
      <OfferingAccount
        account={{
          bank: "농협",
          number: "355-0068-1115-73",
          holder: "명성비전교회",
          note: "입금자명에 이름과 헌금종류를 함께 적어주세요.",
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "온라인 헌금" })).toBeInTheDocument();
    expect(
      screen.getByText("농협 355-0068-1115-73 명성비전교회"),
    ).toBeInTheDocument();
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
