import React, { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiCourseMotionControls, AiCourseMotionProvider } from "./AiCourseMotionProvider";
import AiCourseWorkbench from "./AiCourseWorkbench";
import { useWorkbenchPlayback } from "./useWorkbenchPlayback";

const animation = vi.hoisted(() => ({ animate: vi.fn() }));
vi.mock("motion/react", async (original) => ({ ...await original<object>(), animate: animation.animate }));
let visible = true;
let reduced = false;
const mediaListeners = new Set<() => void>();
let options: { onUpdate(value: number): void; onComplete(): void };
let stops: ReturnType<typeof vi.fn>[];
function Example({ inView = true }: { inView?: boolean }) {
  const scope = useRef<HTMLDivElement>(null);
  const { scene, playing, replay } = useWorkbenchPlayback({ scope, inView });
  return <div ref={scope}><output aria-label="장면">{scene}</output><button disabled={playing} onClick={replay}>다시 보기</button></div>;
}
beforeEach(() => {
  stops = []; visible = true; reduced = false; mediaListeners.clear(); window.history.replaceState(null, "", "/ai-course");
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, callback: () => void) => mediaListeners.add(callback), removeEventListener: (_: string, callback: () => void) => mediaListeners.delete(callback) }));
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden");
  animation.animate.mockReset().mockImplementation((_from, _to, next) => { options = next; const stop = vi.fn(); stops.push(stop); return { stop }; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("apply hash skips autoplay", async () => {
  window.history.replaceState(null, "", "/ai-course#apply");
  render(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  await act(async () => {}); expect(animation.animate).not.toHaveBeenCalled(); expect(screen.getByLabelText("장면")).toHaveTextContent("settled");
});
it("hide stops playback and returning does not autoreplay", async () => {
  render(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  await waitFor(() => expect(animation.animate).toHaveBeenCalledTimes(1));
  act(() => { options.onUpdate(0.25); }); expect(screen.getByLabelText("장면")).toHaveTextContent("document");
  act(() => { visible = false; document.dispatchEvent(new Event("visibilitychange")); });
  expect(stops[0]).toHaveBeenCalled(); expect(screen.getByLabelText("장면")).toHaveTextContent("settled");
  act(() => { visible = true; document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => {}); expect(animation.animate).toHaveBeenCalledTimes(1);
});
it("leaving the viewport cancels and unmount cleans the latest replay", async () => {
  const view = render(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  await waitFor(() => expect(animation.animate).toHaveBeenCalledTimes(1));
  view.rerender(<AiCourseMotionProvider><Example inView={false} /></AiCourseMotionProvider>);
  expect(stops[0]).toHaveBeenCalled();
  view.rerender(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  fireEvent.click(screen.getByRole("button", { name: "다시 보기" }));
  expect(animation.animate).toHaveBeenCalledTimes(2); view.unmount(); expect(stops[1]).toHaveBeenCalled();
});
it("replay stays single and ignores cancelled completion callbacks", async () => {
  render(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  await waitFor(() => expect(animation.animate).toHaveBeenCalledTimes(1));
  const old = options; act(() => options.onComplete());
  const button = screen.getByRole("button", { name: "다시 보기" }); button.focus(); fireEvent.click(button); fireEvent.click(button);
  expect(animation.animate).toHaveBeenCalledTimes(2); expect(button).toBeDisabled();
  act(() => old.onComplete()); expect(button).toBeDisabled();
  act(() => options.onComplete()); expect(button).toBeEnabled(); expect(button).toHaveFocus();
});
it("autoplays once in StrictMode", async () => {
  render(<StrictMode><AiCourseMotionProvider><Example /></AiCourseMotionProvider></StrictMode>);
  await waitFor(() => expect(animation.animate).toHaveBeenCalledTimes(1));
});
it("initial reduced motion waits for explicit replay after being re-enabled", async () => {
  reduced = true;
  render(<AiCourseMotionProvider><Example /></AiCourseMotionProvider>);
  act(() => { reduced = false; mediaListeners.forEach((listener) => listener()); });
  await act(async () => {}); expect(animation.animate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "다시 보기" }));
  expect(animation.animate).toHaveBeenCalledTimes(1);
});
it("turning motion off before entering the viewport consumes automatic playback", async () => {
  const view = render(<AiCourseMotionProvider><AiCourseMotionControls /><Example inView={false} /></AiCourseMotionProvider>);
  fireEvent.click(screen.getByRole("button", { name: "모션 끄기" }));
  fireEvent.click(screen.getByRole("button", { name: "모션 켜기" }));
  view.rerender(<AiCourseMotionProvider><AiCourseMotionControls /><Example /></AiCourseMotionProvider>);
  await act(async () => {}); expect(animation.animate).not.toHaveBeenCalled();
});
it("the real replay button remains focusable while playback is guarded", async () => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
  render(<AiCourseMotionProvider><AiCourseWorkbench /></AiCourseMotionProvider>);
  await waitFor(() => expect(animation.animate).toHaveBeenCalledTimes(1));
  act(() => options.onComplete());
  const button = screen.getByRole("button", { name: "작업실 모션 다시 보기" });
  button.focus(); fireEvent.click(button); fireEvent.click(button);
  expect(animation.animate).toHaveBeenCalledTimes(2);
  expect(button).not.toBeDisabled(); expect(button).toHaveAttribute("aria-disabled", "true"); expect(button).toHaveFocus();
});
