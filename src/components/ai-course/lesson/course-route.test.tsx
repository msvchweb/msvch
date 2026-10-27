import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WeekPage, { generateMetadata, generateStaticParams } from "@/app/(public)/ai-course/[week]/page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("weekly lesson route", () => {
  it("prerenders only new weeks while retaining the existing week-one route", () => {
    expect(generateStaticParams()).toEqual([2, 3, 4, 5, 6, 7, 8].map(week => ({ week: `week-${week}` })));
  });
  it("awaits Next route params and presents the selected week", async () => {
    const page = await WeekPage({ params: Promise.resolve({ week: "week-5" }) });
    render(page);
    expect(screen.getByText("AI 활용 · 5주차")).toBeVisible();
    const metadata = await generateMetadata({ params: Promise.resolve({ week: "week-5" }) });
    expect(metadata.alternates?.canonical).toBe("https://www.msvch.org/ai-course/week-5");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it.each(["week-9", "week-02", "week-2-extra"])("rejects %s", async week => {
    await expect(WeekPage({ params: Promise.resolve({ week }) })).rejects.toThrow("NOT_FOUND");
    await expect(generateMetadata({ params: Promise.resolve({ week }) })).rejects.toThrow("NOT_FOUND");
  });
});
