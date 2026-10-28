import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LessonsPage from "@/app/(public)/ai-course/lessons/page";
import { courseChapters, getCourseLesson } from "./course-content";
import CourseLesson from "./CourseLesson";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("course chapters", () => {
  it("opens eight actual lessons, including the existing first lesson", () => {
    render(<LessonsPage />);
    expect(screen.queryByText(/60분/)).not.toBeInTheDocument();
    expect(courseChapters.map(chapter => chapter.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const chapter of courseChapters) {
      expect(screen.getByRole("link", { name: `${chapter.week}강 ${chapter.title}` })).toHaveAttribute("href", `/ai-course/week-${chapter.week}`);
    }
  });

  it.each(["week-0", "week-9", "week-02", "week-2x", "lessons", "week-2/extra"])("does not resolve invalid lesson %s", slug => {
    expect(getCourseLesson(slug)).toBeUndefined();
  });

  it.each([2, 3, 4, 5, 6, 7, 8])("shows week %i with working controls and chapter return", week => {
    const lesson = getCourseLesson(`week-${week}`)!;
    window.history.replaceState(null, "", `/ai-course/week-${week}`);
    render(<CourseLesson lesson={lesson} />);
    expect(screen.getByText(`AI 활용 · ${week}강`)).toBeVisible();
    expect(screen.getByRole("link", { name: "챕터 선택으로 돌아가기" })).toHaveAttribute("href", "/ai-course/lessons");
    expect(screen.getByRole("heading", { name: lesson.slides[0].title })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다음 슬라이드" }));
    expect(screen.getByRole("heading", { name: lesson.slides[1].title })).toBeVisible();
    expect(window.location.hash).toBe("#slide-2");
    fireEvent.keyDown(document, { key: "End" });
    expect(screen.getByRole("heading", { name: lesson.slides.at(-1)!.title })).toBeVisible();
  });

  it("opens an official guide separately without treating it as a downloaded file", () => {
    window.history.replaceState(null, "", "/ai-course/week-7#slide-5");
    render(<CourseLesson lesson={getCourseLesson("week-7")!} />);
    const guide = screen.getByRole("link", { name: "안내 보기" });
    expect(guide).toHaveAttribute("href", "https://learn.chatgpt.com/docs/remote-connections");
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).not.toHaveAttribute("download");
  });
});
