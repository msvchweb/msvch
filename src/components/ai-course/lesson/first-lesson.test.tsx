import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FirstLessonPage from "@/app/(public)/ai-course/week-1/page";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("resumes the presentation exercise in lecture one after a class break", () => {
  window.history.replaceState(null, "", "/ai-course/week-1#slide-14");
  render(<FirstLessonPage />);
  expect(screen.getByText("AI 활용 · 1강")).toBeVisible();
  expect(screen.getByRole("heading", { name: /준비 보고서를\s+발표자료로 만들기/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "다음 슬라이드" }));
  expect(screen.getByRole("heading", { name: /웹에서 여는\s+발표자료 만들기/ })).toBeVisible();
  expect(window.location.hash).toBe("#slide-15");
});
