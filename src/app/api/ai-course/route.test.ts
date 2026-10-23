import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { aiCourseFixture } from "@/test/ai-course-fixture";
import { POST } from "./route";
const { submit, createService } = vi.hoisted(() => ({ submit: vi.fn(), createService: vi.fn() }));
vi.mock("@/lib/ai-course-server", () => ({ submitAiCourseApplication: submit }));
vi.mock("@/lib/supabase/api", () => ({ createServiceClient: createService }));
function request(input: unknown) { return new NextRequest("https://example.test/api/ai-course", { method: "POST", body: JSON.stringify(input) }); }
describe("public AI course API", () => {
  beforeEach(() => { vi.stubEnv("AI_COURSE_PREVIEW", "0"); vi.resetAllMocks(); createService.mockReturnValue({}); submit.mockResolvedValue("created"); });
  afterEach(() => vi.unstubAllEnvs());
  it("blocks preview writes before opening a service client", async () => {
    vi.stubEnv("AI_COURSE_PREVIEW", "1");
    const response = await POST(request(aiCourseFixture()));
    expect(response.status).toBe(503);
    expect(createService).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
  });
  it.each(["created", "replayed"])("acknowledges %s without returning personal information", async (result) => {
    submit.mockResolvedValue(result);
    const res = await POST(request(aiCourseFixture()));
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ ok: true });
  });
  it("rejects malformed JSON and invalid fields before opening a service client", async () => {
    expect((await POST(new NextRequest("https://example.test", { method: "POST", body: "{" }))).status).toBe(400);
    const res = await POST(request({ ...aiCourseFixture(), privacyConsent: false }));
    expect(res.status).toBe(400); expect((await res.json()).fieldErrors.privacyConsent).toBeTruthy();
    expect(createService).not.toHaveBeenCalled();
  });
  it("returns conflict for changed replay and generic server errors", async () => {
    submit.mockResolvedValue("conflict"); expect((await POST(request(aiCourseFixture()))).status).toBe(409);
    submit.mockRejectedValue(new Error("secret applicant details"));
    const res = await POST(request(aiCourseFixture())); expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret");
    createService.mockImplementation(() => { throw new Error("secret config"); });
    expect((await POST(request(aiCourseFixture()))).status).toBe(500);
  });
});
