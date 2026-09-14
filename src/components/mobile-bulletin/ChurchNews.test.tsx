import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChurchNews } from "./ChurchNews";

afterEach(cleanup);

// jsdom 은 scrollIntoView 를 구현하지 않는다. 호출 여부만 검증하면 되므로 스텁으로 대체한다.
const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe("ChurchNews", () => {
  it("hides the section when every news group is empty", () => {
    render(<ChurchNews news={[]} />);
    expect(
      screen.queryByRole("heading", { name: "교회소식" }),
    ).not.toBeInTheDocument();
  });

  it("shows the first news item as an expanded handoff card", () => {
    render(<ChurchNews news={[{ title: "소식", items: ["내용"] }]} />);
    expect(screen.getByText("내용")).toBeVisible();
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

  it("does not scroll for the group that renders open on mount", () => {
    render(<ChurchNews news={[{ title: "소식", items: ["내용"] }]} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls a newly opened group into view", async () => {
    render(
      <ChurchNews
        news={[
          { title: "첫 소식", items: ["가"] },
          { title: "둘째 소식", items: ["나"] },
        ]}
      />,
    );
    const details = screen.getByText("둘째 소식").closest("details");
    expect(details).not.toBeNull();

    // jsdom 의 summary 클릭 활성화 동작에 기대지 않고 toggle 을 직접 발생시킨다.
    details!.open = true;
    fireEvent(details!, new Event("toggle"));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("does not scroll when a group is collapsed", async () => {
    render(<ChurchNews news={[{ title: "소식", items: ["내용"] }]} />);
    const details = screen.getByText("소식").closest("details");
    details!.open = false;
    fireEvent(details!, new Event("toggle"));

    await waitFor(() => expect(scrollIntoView).not.toHaveBeenCalled());
  });
});
