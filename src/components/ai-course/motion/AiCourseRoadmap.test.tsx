import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { motionValue } from "motion/react";
import { AiCourseMotionProvider } from "./AiCourseMotionProvider";
import AiCourseRoadmap from "./AiCourseRoadmap";

const progress = motionValue(0);
vi.mock("motion/react", async (original) => ({ ...await original<object>(), useScroll: () => ({ scrollYProgress: progress }) }));
let reduced = false;
const listeners = new Set<() => void>();
beforeEach(() => {
  reduced = false; listeners.clear(); progress.set(0);
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("highlights the current stage immediately after motion resumes", () => {
  render(<AiCourseMotionProvider><AiCourseRoadmap>{Array.from({ length: 6 }, (_, index) => <article key={index}>단계 {index + 1}</article>)}</AiCourseRoadmap></AiCourseMotionProvider>);
  act(() => progress.set(0.2));
  expect(screen.getByText("단계 2").parentElement).toHaveAttribute("data-active", "true");
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  act(() => progress.set(0.8));
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(screen.getByText("단계 5").parentElement).toHaveAttribute("data-active", "true");
});
