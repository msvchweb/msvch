import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AiCourseForm from "./AiCourseForm";
import { CAPABILITIES } from "@/lib/ai-course";
const fetchMock = vi.fn();
const policy = { version: "ai-course-privacy-v1", text: "테스트 전용 동의 문안" };
function next() { fireEvent.click(screen.getByRole("button", { name: "다음" })); }
function fillBasic() {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "테스트 신청자" } });
  fireEvent.change(screen.getByLabelText("휴대전화 번호"), { target: { value: "01012345678" } });
  for (const label of ["직장 업무", "개인 노트북을 가져올 수 있어요", "Windows", "Android"]) fireEvent.click(screen.getByLabelText(label));
}
function fillExperience() {
  fireEvent.click(screen.getByLabelText("사용하지 않았어요"));
  fireEvent.click(screen.getByLabelText("아직 직접 사용한 도구가 없어요"));
  for (const question of CAPABILITIES) fireEvent.click(within(screen.getByRole("group", { name: question.label })).getByLabelText("처음 접해요"));
}
function toReview() {
  fillBasic(); next(); fillExperience(); next();
  fireEvent.click(screen.getByLabelText("만들어 본 적이 없어요"));
  fireEvent.click(screen.getByLabelText("내 자료로 문서와 업무 정리하기"));
  fireEvent.change(screen.getByLabelText("AI로 줄이고 싶은 반복 업무 하나"), { target: { value: "수업에서 찾아보고 싶어요" } });
  next();
}
describe("AI course form", () => {
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("requires the other tool description before leaving experience even when later steps are unanswered", () => {
    render(<AiCourseForm privacyPolicy={policy} />); fillBasic(); next(); fillExperience();
    fireEvent.click(screen.getByLabelText("기타"));
    next();
    expect(screen.getByRole("heading", { name: "현재 활용 경험" })).toBeInTheDocument();
    expect(screen.getByText("사용한 도구 이름을 적어 주세요.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("기타 도구 이름"), { target: { value: "테스트 도구" } }); next();
    expect(screen.getByRole("heading", { name: "수강 목표" })).toBeInTheDocument();
  });
  it("starts unanswered, focuses invalid fields and preserves data going back", async () => {
    render(<AiCourseForm privacyPolicy={policy} />);
    expect(screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    next(); await waitFor(() => expect(screen.getByLabelText("이름")).toHaveFocus());
    fillBasic(); next();
    expect(screen.getByRole("heading", { name: "현재 활용 경험" })).toBeInTheDocument();
    next(); expect(screen.getAllByText("답변을 선택해 주세요.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(screen.getByLabelText("이름")).toHaveValue("테스트 신청자");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires consent, preserves the retry ID after failure and only completes after ok:true", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<AiCourseForm privacyPolicy={policy} />); toReview();
    const submit = () => fireEvent.click(screen.getByRole("button", { name: "신청서 제출하기" }));
    submit(); expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("개인정보 수집·이용에 동의합니다."));
    submit(); await screen.findByText("전송하지 못했습니다. 연결을 확인하고 다시 제출해 주세요.");
    submit(); await screen.findByText("신청을 저장하지 못했습니다. 다시 제출해 주세요.");
    expect(screen.queryByText("신청이 접수되었습니다.")).not.toBeInTheDocument();
    submit(); await screen.findByText("신청이 접수되었습니다.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(new Set(bodies.map((body) => body.requestId)).size).toBe(1);
    expect(bodies[0].surveyAnswers.capabilities.remote).toBe("new");
  });
  it("uses a new ID after changing the failed submission and prevents double clicks", async () => {
    let complete!: (response: unknown) => void;
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "저장 실패" }) }).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    render(<AiCourseForm privacyPolicy={policy} />); toReview();
    fireEvent.click(screen.getByLabelText("개인정보 수집·이용에 동의합니다."));
    fireEvent.click(screen.getByRole("button", { name: "신청서 제출하기" })); await screen.findByText("저장 실패");
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    fireEvent.change(screen.getByLabelText("AI로 줄이고 싶은 반복 업무 하나"), { target: { value: "회의 정리" } }); next();
    fireEvent.click(screen.getByRole("button", { name: "신청서 제출하기" }));
    expect(screen.getByRole("button", { name: "제출 중…" })).toBeDisabled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).requestId).not.toBe(JSON.parse(fetchMock.mock.calls[1][1].body).requestId);
    complete({ ok: true, json: async () => ({ ok: true }) }); await screen.findByText("신청이 접수되었습니다.");
  });
});
