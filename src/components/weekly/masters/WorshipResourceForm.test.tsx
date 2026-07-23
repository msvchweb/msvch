import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorshipResourceForm } from "./WorshipResourceForm";
import { WorshipResourcesEditor } from "./WorshipResourcesEditor";
import type { WorshipResourceInput } from "@/lib/validation";
import type { WorshipResource } from "@/types/mobile-bulletin";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));

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
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    createClientMock.mockReset();
  });

  it("requires source and rights notes for hymn full text", () => {
    const onSave = vi.fn();
    render(<WorshipResourceForm initial={emptyHymn} onSave={onSave} saving={false} />);

    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "찬송가 가사" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("출처 표기를 입력하세요")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requires rights notes for hymn full text after a source is supplied", () => {
    const onSave = vi.fn();
    render(<WorshipResourceForm initial={emptyHymn} onSave={onSave} saving={false} />);

    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "찬송가 가사" } });
    fireEvent.change(screen.getByLabelText("출처"), { target: { value: "찬송가 출처" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.queryByText("출처 표기를 입력하세요")).not.toBeInTheDocument();
    expect(screen.getByText("권리 고지를 입력하세요")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requires source and rights notes for scripture full text", () => {
    const onSave = vi.fn();
    render(
      <WorshipResourceForm
        initial={{ ...emptyHymn, kind: "scripture", title: "테스트 성경" }}
        onSave={onSave}
        saving={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "성경 본문" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("출처 표기를 입력하세요")).toBeInTheDocument();
    expect(screen.getByText("권리 고지를 입력하세요")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("resets labeled controls when authoritative initial values change", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <WorshipResourceForm initial={emptyHymn} onSave={onSave} saving={false} />,
    );
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "저장 전 제목" } });
    fireEvent.change(screen.getByLabelText("본문"), { target: { value: "저장 전 본문" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("출처 표기를 입력하세요")).toBeInTheDocument();

    rerender(
      <WorshipResourceForm
        initial={{
          ...emptyHymn,
          title: "서버 제목",
          content: "서버 본문",
          source_label: "서버 출처",
          rights_note: "서버 권리 고지",
        }}
        onSave={onSave}
        saving={false}
      />,
    );

    expect(screen.getByLabelText("제목")).toHaveValue("서버 제목");
    expect(screen.getByLabelText("본문")).toHaveValue("서버 본문");
    expect(screen.queryByText("출처 표기를 입력하세요")).not.toBeInTheDocument();
  });

  it("does not deactivate a resource that fails full input validation", async () => {
    const resource: WorshipResource = {
      id: "00000000-0000-4000-8000-000000000002",
      kind: "hymn",
      title: "검증할 찬송",
      reference: "",
      content: "찬송가 가사",
      external_url: null,
      source_label: "찬송가 출처",
      rights_note: null,
      is_active: true,
      created_at: "2026-07-23T00:00:00Z",
      updated_at: "2026-07-23T00:00:00Z",
    };
    const listQuery = {
      select: vi.fn(),
      order: vi.fn(),
    };
    listQuery.select.mockReturnValue(listQuery);
    let orderCall = 0;
    listQuery.order.mockImplementation(() => {
      orderCall += 1;
      return orderCall % 2 === 1
        ? listQuery
        : Promise.resolve({ data: [resource], error: null });
    });
    const writeQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: { id: resource.id }, error: null }),
    };
    writeQuery.update.mockReturnValue(writeQuery);
    writeQuery.eq.mockReturnValue(writeQuery);
    writeQuery.select.mockReturnValue(writeQuery);
    const from = vi.fn()
      .mockReturnValueOnce(listQuery)
      .mockReturnValueOnce(writeQuery)
      .mockReturnValue(listQuery);
    createClientMock.mockReturnValue({ from });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<WorshipResourcesEditor />);
    fireEvent.click(await screen.findByRole("button", { name: "비활성화" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("권리 고지를 입력하세요"));
    expect(writeQuery.update).not.toHaveBeenCalled();
  });
});
