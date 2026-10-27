import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RootFurniture } from "./RootFurniture";
let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
afterEach(cleanup);
function show(pathname: string) {
  path = pathname;
  render(<RootFurniture navigation={<nav>교회 메뉴</nav>} footer={<footer>교회 푸터</footer>} chatbot={<button>상담</button>} noticeBanner={<aside>공지</aside>}><h1>내용</h1></RootFurniture>);
}
describe("RootFurniture lecture boundary", () => {
  it.each(["/ai-course/lessons", ...Array.from({ length: 8 }, (_, i) => `/ai-course/week-${i + 1}`)])("presents the lecture without competing global furniture at %s", pathname => {
    show(pathname);
    expect(screen.getByRole("heading", { name: "내용" })).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "상담" })).not.toBeInTheDocument();
  });
  it.each(["/ai-course", "/ai-course/week-1-extra", "/ai-course/week-9", "/ai-course/week-2/extra", "/ai-course/lessons-extra", "/sermons"])("preserves other pages at %s", (pathname) => {
    show(pathname);
    expect(screen.getByRole("navigation")).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
    expect(screen.getByRole("button", { name: "상담" })).toBeVisible();
  });
});
