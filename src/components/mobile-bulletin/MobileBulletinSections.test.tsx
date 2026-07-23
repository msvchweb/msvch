import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChurchNews, NextWeekServing } from "./MobileBulletinSections";

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
      </>,
    );
    expect(
      screen.queryByRole("heading", { name: "다음 주 섬김" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "교회소식" }),
    ).not.toBeInTheDocument();
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
