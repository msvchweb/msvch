import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LessonDeck from "./LessonDeck";

const slides = [
  { title: "첫 화면", phase: "도입", time: "0–5분" },
  { title: "두 번째", phase: "실습", time: "5–10분" },
  { title: "마지막", phase: "마무리", time: "55–60분" },
];
const fullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "requestFullscreen");
function showDeck() {
  return render(<LessonDeck slides={slides}>{slides.map(({ title }, index) => <div key={title}><h1 id={`lesson-title-${index}`}>{title}</h1>{index === 0 && <textarea aria-label="실습 메모" />}</div>)}</LessonDeck>);
}
afterEach(() => {
  cleanup(); window.history.replaceState(null, "", "/"); vi.restoreAllMocks();
  if (fullscreenDescriptor) Object.defineProperty(HTMLElement.prototype, "requestFullscreen", fullscreenDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
});
describe("LessonDeck", () => {
  it("moves one slide at a time without wrapping and keeps a reloadable URL", () => {
    showDeck();
    expect(screen.getByRole("heading", { name: "첫 화면" })).toBeVisible();
    expect(screen.getByRole("button", { name: "이전 슬라이드" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "다음 슬라이드" }));
    expect(screen.getByRole("heading", { name: "두 번째" })).toBeVisible();
    expect(window.location.hash).toBe("#slide-2");
    fireEvent.keyDown(document, { key: "End" });
    expect(screen.getByRole("heading", { name: "마지막" })).toBeVisible();
    expect(screen.getByRole("button", { name: "다음 슬라이드" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(window.location.hash).toBe("#slide-3");
    fireEvent.keyDown(document, { key: "Home" });
    expect(screen.getByRole("heading", { name: "첫 화면" })).toBeVisible();
  });
  it("restores a direct link and responds to external hash changes", () => {
    window.history.replaceState(null, "", "/ai-course/week-1#slide-2");
    showDeck();
    expect(screen.getByRole("heading", { name: "두 번째" })).toBeVisible();
    act(() => { window.history.replaceState(null, "", "#slide-3"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(screen.getByRole("heading", { name: "마지막" })).toBeVisible();
  });
  it.each(["#slide-0", "#slide-999", "#slide-2x", "#other"])("falls back safely for %s", (hash) => {
    window.history.replaceState(null, "", `/ai-course/week-1${hash}`); showDeck();
    expect(screen.getByRole("heading", { name: "첫 화면" })).toBeVisible();
  });
  it("leaves input and select key handling alone while supporting direct selection", () => {
    showDeck();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "실습 메모" }), { key: "ArrowRight" });
    const select = screen.getByRole("combobox", { name: "슬라이드 선택" });
    fireEvent.keyDown(select, { key: "End" });
    expect(screen.getByRole("heading", { name: "첫 화면" })).toBeVisible();
    fireEvent.change(select, { target: { value: "2" } });
    expect(screen.getByRole("heading", { name: "마지막" })).toBeVisible();
  });
  it("reports fullscreen rejection and keeps navigation usable", async () => {
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: async () => { throw new Error("unsupported"); } });
    showDeck(); fireEvent.click(screen.getByRole("button", { name: "전체화면" }));
    expect(await screen.findByText(/전체화면을 열지 못했어요/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다음 슬라이드" }));
    expect(screen.getByRole("heading", { name: "두 번째" })).toBeVisible();
    expect(screen.queryByText(/전체화면을 열지 못했어요/)).not.toBeInTheDocument();
  });
});
