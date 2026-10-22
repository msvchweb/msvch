import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AiCourseApplicationsPage from "./page";
import { aiCourseFixture } from "@/test/ai-course-fixture";
const fetchMock = vi.fn();
const summary = (id: string, name: string) => ({ id, name, phone: "010-1234-5678", createdAt: "2026-10-22T01:00:00Z", learningGoals: ["documents"] });
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
describe("AI course admin screen", () => {
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("shows errors separately from an empty list and retries", async () => {
    fetchMock.mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response({ items: [], total: 0, page: 1, pageSize: 25 }));
    render(<AiCourseApplicationsPage />);
    await screen.findByText("조회에 실패했습니다."); expect(screen.queryByText("접수된 신청이 없습니다.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 조회" })); await screen.findByText("접수된 신청이 없습니다.");
  });
  it("discards a stale detail response when selection changes", async () => {
    let oldResolve!: (value: unknown) => void;
    const fixture = aiCourseFixture();
    fetchMock.mockResolvedValueOnce(response({ items: [summary("one", "첫 신청자"), summary("two", "두 번째 신청자")], total: 2, page: 1, pageSize: 25 }))
      .mockImplementationOnce(() => new Promise((resolve) => { oldResolve = resolve; }))
      .mockResolvedValueOnce(response({ ...summary("two", "두 번째 상세"), ...fixture, name: "두 번째 상세", privacyConsentedAt: "2026-10-22T01:00:00Z" }));
    render(<AiCourseApplicationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "신청 보기: 첫 신청자" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "신청 보기: 두 번째 신청자" })); await screen.findByText("두 번째 상세");
    oldResolve(response({ ...summary("one", "오래된 상세"), ...fixture, name: "오래된 상세", privacyConsentedAt: "2026-10-22T01:00:00Z" }));
    await waitFor(() => expect(screen.queryByText("오래된 상세")).not.toBeInTheDocument());
    expect(screen.getByText("두 번째 상세")).toBeInTheDocument();
  });
});
