import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/admin-auth";
import { GET } from "./route";
import { GET as detailGET } from "./[id]/route";
const { auth, list, detail } = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/ai-course-server", () => ({ requireAiCourseAdmin: auth, listAiCourseApplications: list, getAiCourseApplication: detail }));
const request = (query = "") => new NextRequest(`https://example.test/api/admin/ai-course-applications${query}`);
const context = (id = "b35b1bde-d5c3-44d6-9dda-ec2a7c013327") => ({ params: Promise.resolve({ id }) });
describe("AI course admin routes", () => {
  beforeEach(() => { vi.resetAllMocks(); auth.mockResolvedValue({ supabase: {}, userId: "admin" }); list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }); detail.mockResolvedValue({ id: "id" }); });
  it.each([401, 403])("blocks list and detail with %s before any query", async (status) => {
    auth.mockRejectedValue(new AuthError("denied", status));
    expect((await GET(request())).status).toBe(status);
    expect((await detailGET(request(), context())).status).toBe(status);
    expect(list).not.toHaveBeenCalled(); expect(detail).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "1.5", "abc", "", "1e2", "9999999999999999999"])("rejects page=%s", async (page) => { expect((await GET(request(`?page=${page}`))).status).toBe(400); });
  it("defaults to page one, does not cache and preserves empty out-of-range pages", async () => {
    const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(list).toHaveBeenCalledWith({}, 1);
    list.mockResolvedValue({ items: [], total: 3, page: 100, pageSize: 25 });
    expect(await (await GET(request("?page=100"))).json()).toEqual({ items: [], total: 3, page: 100, pageSize: 25 });
  });
  it("validates UUIDs and distinguishes missing records from query failure", async () => {
    expect((await detailGET(request(), context("bad"))).status).toBe(400); expect(detail).not.toHaveBeenCalled();
    detail.mockResolvedValue(null); expect((await detailGET(request(), context())).status).toBe(404);
    detail.mockRejectedValue(new Error("private data"));
    const response = await detailGET(request(), context()); expect(response.status).toBe(500); expect(await response.text()).not.toContain("private");
    list.mockRejectedValue(new Error("query")); expect((await GET(request())).status).toBe(500);
  });
});
