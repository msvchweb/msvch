import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WorshipResource } from "@/types/mobile-bulletin";
import { WorshipResourceSheet } from "./WorshipResourceSheet";

const creed: WorshipResource = {
  id: "creed",
  kind: "creed",
  title: "사도신경",
  reference: "신앙고백",
  content: "전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며",
  external_url: null,
  source_label: "대한예수교장로회",
  rights_note: null,
  is_active: true,
  created_at: "",
  updated_at: "",
};

afterEach(cleanup);

describe("WorshipResourceSheet", () => {
  it("names the trigger after the resource and its badge word", () => {
    render(<WorshipResourceSheet resource={creed} />);
    expect(screen.getByRole("button", { name: "사도신경 전문 보기" })).toHaveTextContent(
      "전문",
    );
  });

  it("returns focus to the sheet trigger after Escape", () => {
    render(<WorshipResourceSheet resource={creed} />);
    const trigger = screen.getByRole("button", { name: "사도신경 전문 보기" });

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "사도신경" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toHaveFocus();

    // jsdom 은 Escape 키를 취소 요청으로 번역하지 않는다. 브라우저가 dialog 에
    // 보내는 cancel 이벤트를 직접 쏴서 같은 경로를 태운다.
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    expect(screen.queryByRole("dialog", { name: "사도신경" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows the source line and keeps the content readable", () => {
    render(<WorshipResourceSheet resource={creed} />);
    fireEvent.click(screen.getByRole("button", { name: "사도신경 전문 보기" }));

    expect(screen.getByText(/전능하사 천지를 만드신/)).toBeVisible();
    expect(screen.getByText("출처: 대한예수교장로회")).toBeVisible();
  });
});
