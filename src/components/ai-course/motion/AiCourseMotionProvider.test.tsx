import React from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiCourseMotionControls, AiCourseMotionProvider, useAiCourseMotion } from "./AiCourseMotionProvider";

let reduced = false;
const listeners = new Set<() => void>();
function Probe() {
  const state = useAiCourseMotion();
  return <><output aria-label="모션 상태">{state.mode}</output><input aria-label="입력" /><AiCourseMotionControls /></>;
}
beforeEach(() => {
  reduced = false; listeners.clear(); window.history.replaceState(null, "", "/ai-course");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return reduced; }, addEventListener: (_: string, callback: () => void) => listeners.add(callback), removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("server content is readable before effects", () => {
  const html = renderToString(<AiCourseMotionProvider><h1>만들고 싶던 앱은 내 손으로.</h1><a href="#apply">신청</a></AiCourseMotionProvider>);
  expect(html).toContain('data-ai-course-motion="static"'); expect(html).toContain('href="#apply"'); expect(html).toContain("만들고 싶던 앱은");
});
it("user can disable motion without focus change", () => {
  render(<AiCourseMotionProvider><Probe /></AiCourseMotionProvider>);
  expect(screen.getByLabelText("모션 상태")).toHaveTextContent("animated");
  const button = screen.getByRole("button", { name: "모션 끄기" }); button.focus(); fireEvent.click(button);
  expect(screen.getByLabelText("모션 상태")).toHaveTextContent("static"); expect(button).toHaveFocus();
});
it("reduced motion updates during use and overrides enable", () => {
  render(<AiCourseMotionProvider><Probe /></AiCourseMotionProvider>);
  const input = screen.getByLabelText("입력"); input.focus(); fireEvent.change(input, { target: { value: "작성 중" } });
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(screen.getByLabelText("모션 상태")).toHaveTextContent("static"); expect(input).toHaveFocus(); expect(input).toHaveValue("작성 중");
  const control = screen.getByRole("button", { name: "동작 줄이기 적용 중" });
  expect(control).toHaveAttribute("aria-disabled", "true"); fireEvent.click(control);
  expect(screen.getByLabelText("모션 상태")).toHaveTextContent("static");
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(screen.getByLabelText("모션 상태")).toHaveTextContent("animated");
});
it("retains the control focus when the OS reduces motion", () => {
  render(<AiCourseMotionProvider><Probe /></AiCourseMotionProvider>);
  const button = screen.getByRole("button", { name: "모션 끄기" }); button.focus();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(button).not.toBeDisabled(); expect(button).toHaveAttribute("aria-disabled", "true"); expect(button).toHaveFocus();
});
it("removes its visibility and media listeners", () => {
  const add = vi.spyOn(document, "addEventListener"); const remove = vi.spyOn(document, "removeEventListener");
  const view = render(<AiCourseMotionProvider><Probe /></AiCourseMotionProvider>);
  const callback = add.mock.calls.find(([event]) => event === "visibilitychange")?.[1];
  expect(callback).toBeDefined(); expect(listeners.size).toBe(1); view.unmount();
  expect(remove).toHaveBeenCalledWith("visibilitychange", callback); expect(listeners.size).toBe(0);
});
it("provides a static fallback without a provider", () => {
  render(<Probe />); expect(screen.getByLabelText("모션 상태")).toHaveTextContent("static"); expect(listeners.size).toBe(0);
});
