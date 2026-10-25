import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AiCoursePage from "./page";

const fetchMock = vi.fn();
const consentLabel = "문의 답변을 위한 개인정보 수집·이용에 동의합니다.";

async function showPage() {
  render(await AiCoursePage());
  return screen.getByRole("form", { name: "AI 강의 사전 문의" });
}

function fillInquiry(form: HTMLElement, message = "노트북 준비가 어려운데 참여할 수 있나요?") {
  const fields = within(form);
  fireEvent.change(fields.getByLabelText("이름"), { target: { value: "  문의자  " } });
  fireEvent.change(fields.getByLabelText("휴대전화 번호"), { target: { value: "01012345678" } });
  fireEvent.change(fields.getByLabelText("문의 내용"), { target: { value: message } });
  fireEvent.click(fields.getByLabelText(consentLabel));
}

describe("AI course pre-application inquiry", () => {
  beforeEach(() => {
    vi.stubEnv("AI_COURSE_PREVIEW", "0");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("submits a tagged inquiry independently while preserving the application draft", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    const form = await showPage();
    const application = within(document.querySelector("#apply") as HTMLElement);
    fireEvent.change(application.getByLabelText("이름"), { target: { value: "작성 중인 신청자" } });
    const link = screen.getByRole("link", { name: "신청 전 문의하기" });
    expect(document.querySelector(link.getAttribute("href")!)).toContainElement(form);
    fillInquiry(form, "  노트북 없이도 참여할 수 있나요?  ");
    fireEvent.submit(form);
    await screen.findByText("문의가 접수되었습니다.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(application.getByLabelText("이름")).toHaveValue("작성 중인 신청자");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat/inquiry");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      name: "문의자", phone: "010-1234-5678",
      message: "[AI 강의 사전 문의]\n노트북 없이도 참여할 수 있나요?",
    });
  });

  it.each([
    ["이름", "   "],
    ["휴대전화 번호", "1234"],
    ["문의 내용", "   "],
    ["문의 내용", "가".repeat(451)],
  ])("rejects invalid %s and focuses the field without sending", async (label, value) => {
    const form = await showPage();
    fillInquiry(form);
    const field = within(form).getByLabelText(label);
    fireEvent.change(field, { target: { value } });
    fireEvent.submit(form);
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires consent independently from the registration consent", async () => {
    const form = await showPage();
    fillInquiry(form);
    const consent = within(form).getByLabelText(consentLabel);
    fireEvent.click(consent);
    fireEvent.submit(form);
    await waitFor(() => expect(consent).toHaveFocus());
    expect(consent).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the longest allowed question within the existing API message limit", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    const form = await showPage();
    fillInquiry(form, "가".repeat(450));
    fireEvent.submit(form);
    await screen.findByText("문의가 접수되었습니다.");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message.length).toBeLessThanOrEqual(500);
    expect(body.message.split("\n")[1]).toHaveLength(450);
  });

  it.each(["server", "unconfirmed", "network", "invalid-json"])("preserves input after %s failure and allows retry", async (failure) => {
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else if (failure === "invalid-json") fetchMock.mockResolvedValueOnce(new Response("not JSON"));
    else fetchMock.mockResolvedValueOnce(Response.json(failure === "server" ? { error: "잠시 후 다시 시도해 주세요." } : { ok: false }, { status: failure === "server" ? 429 : 200 }));
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }));
    const form = await showPage();
    fillInquiry(form);
    fireEvent.submit(form);
    await screen.findByRole("alert");
    expect(screen.queryByText("문의가 접수되었습니다.")).not.toBeInTheDocument();
    expect(within(form).getByLabelText("문의 내용")).toHaveValue("노트북 준비가 어려운데 참여할 수 있나요?");
    expect(within(form).getByRole("button", { name: "문의 보내기" })).toBeEnabled();
    fireEvent.submit(form);
    await screen.findByText("문의가 접수되었습니다.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("prevents duplicate submit events while the request is pending", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const form = await showPage();
    fillInquiry(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(within(form).getByRole("button", { name: "보내는 중…" })).toBeDisabled();
    expect(within(form).getByLabelText("문의 내용")).toBeDisabled();
    await act(async () => finish(Response.json({ ok: true })));
    expect(screen.getByText("문의가 접수되었습니다.")).toBeInTheDocument();
  });

  it("blocks direct form submission in preview mode", async () => {
    vi.stubEnv("AI_COURSE_PREVIEW", "1");
    const form = await showPage();
    fillInquiry(form);
    expect(within(form).getByRole("button", { name: "미리보기 · 전송하지 않아요" })).toBeDisabled();
    fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(form).getByLabelText("문의 내용")).toHaveValue("노트북 준비가 어려운데 참여할 수 있나요?");
  });
});
