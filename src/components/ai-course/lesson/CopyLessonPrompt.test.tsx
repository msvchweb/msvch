import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CopyLessonPrompt from "./CopyLessonPrompt";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  cleanup();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});
describe("CopyLessonPrompt", () => {
  it("acknowledges a successful copy", async () => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
    render(<CopyLessonPrompt text="담당자를 추측하지 마." />);
    fireEvent.click(screen.getByRole("button", { name: "요청문 전체 복사" }));
    expect(await screen.findByText("복사했어요. AI 대화에 붙여넣으세요.")).toBeVisible();
    expect(copied).toBe("담당자를 추측하지 마.");
  });
  it.each(["missing", "rejected"])("provides selectable text when clipboard is %s", async (mode) => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "missing" ? undefined : { writeText: async () => { throw new Error("denied"); } } });
    render(<CopyLessonPrompt text="이 자료만 사용해줘." />);
    fireEvent.click(screen.getByRole("button", { name: "요청문 전체 복사" }));
    expect(await screen.findByRole("textbox", { name: "복사할 요청문" })).toHaveValue("이 자료만 사용해줘.");
    expect(screen.queryByText("복사했어요. AI 대화에 붙여넣으세요.")).not.toBeInTheDocument();
  });
});
