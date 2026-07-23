import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorshipResourceForm } from "./WorshipResourceForm";
import type { WorshipResourceInput } from "@/lib/validation";

const emptyHymn: WorshipResourceInput = {
  kind: "hymn",
  title: "테스트 찬송",
  reference: "",
  content: "",
  external_url: null,
  source_label: null,
  rights_note: null,
  is_active: true,
};

describe("WorshipResourceForm", () => {
  it("requires source and rights notes for hymn full text", () => {
    const onSave = vi.fn();
    render(<WorshipResourceForm initial={emptyHymn} onSave={onSave} saving={false} />);

    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "찬송가 가사" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("출처 표기를 입력하세요")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
