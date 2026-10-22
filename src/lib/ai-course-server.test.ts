import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { aiCourseFixture } from "@/test/ai-course-fixture";
import { parseAiCourseSubmission } from "./ai-course";
import { submitAiCourseApplication, requireAiCourseAdmin, listAiCourseApplications } from "./ai-course-server";

const { apiClient } = vi.hoisted(() => ({ apiClient: vi.fn() }));
vi.mock("@/lib/supabase/api", () => ({ createApiClient: apiClient }));

function memoryDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const from = vi.fn(() => ({
    insert: vi.fn(async (row: Record<string, unknown>) => {
      if (rows.has(row.request_id as string)) return { error: { code: "23505" } };
      rows.set(row.request_id as string, row); return { error: null };
    }),
    select: vi.fn(() => ({ eq: vi.fn((_key: string, id: string) => ({ maybeSingle: async () => ({ data: rows.get(id), error: null }) })) })),
  }));
  return { client: { from } as unknown as SupabaseClient, rows };
}
describe("AI course storage", () => {
  it("stores the application and survey atomically and hides client-generated hashes", async () => {
    const { client, rows } = memoryDb();
    const input = parseAiCourseSubmission(aiCourseFixture());
    expect(await submitAiCourseApplication(client, input)).toBe("created");
    const row = rows.get(input.requestId)!;
    expect(row.phone).toBe("010-1234-5678");
    expect(row.survey_answers).toEqual(input.surveyAnswers);
    expect(row.payload_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("allows unchanged concurrent retries exactly once, but conflicts on changed content", async () => {
    const { client, rows } = memoryDb();
    const input = parseAiCourseSubmission(aiCourseFixture());
    expect(await Promise.all([submitAiCourseApplication(client, input), submitAiCourseApplication(client, input)])).toEqual(["created", "replayed"]);
    expect(rows.size).toBe(1);
    expect(await submitAiCourseApplication(client, { ...input, name: "다른 이름" })).toBe("conflict");
  });
  it("compares normalized answers regardless of property and choice order", async () => {
    const { client } = memoryDb();
    const input = aiCourseFixture();
    input.applicationContext.useCases = ["work", "daily_life"];
    await submitAiCourseApplication(client, parseAiCourseSubmission(input));
    input.applicationContext.useCases.reverse();
    expect(await submitAiCourseApplication(client, parseAiCourseSubmission({ ...input, phone: "+82 10 1234 5678" }))).toBe("replayed");
  });
  it("does not mask storage or duplicate-lookup failures", async () => {
    const client = { from: () => ({ insert: async () => ({ error: { code: "42501" } }) }) } as unknown as SupabaseClient;
    await expect(submitAiCourseApplication(client, parseAiCourseSubmission(aiCourseFixture()))).rejects.toThrow();
    const duplicate = { from: () => ({ insert: async () => ({ error: { code: "23505" } }), select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) } as unknown as SupabaseClient;
    await expect(submitAiCourseApplication(duplicate, parseAiCourseSubmission(aiCourseFixture()))).rejects.toThrow();
  });
});
describe("AI course administrator boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([[null, 401], ["member", 403], ["staff", 403], ["admin", 200], ["master", 200]])("checks %s independently of navigation", async (role, status) => {
    apiClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: role ? { id: "user" } : null }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role }, error: null }) }) }) }),
    });
    const operation = requireAiCourseAdmin(new NextRequest("https://example.test/api/admin/ai-course-applications"));
    if (status === 200) expect((await operation).userId).toBe("user");
    else await expect(operation).rejects.toMatchObject({ status });
  });
  it("uses fixed-size stable pagination and returns only summary columns", async () => {
    const chain = { select: vi.fn(), order: vi.fn(), range: vi.fn() };
    chain.select.mockReturnValue(chain); chain.order.mockReturnValue(chain);
    chain.range.mockResolvedValue({ data: [{ id: "id", name: "test", phone: "010-1234-5678", created_at: "now", learningGoals: ["website"] }], count: 30, error: null });
    const result = await listAiCourseApplications({ from: () => chain } as unknown as SupabaseClient, 2);
    expect(chain.range).toHaveBeenCalledWith(25, 49);
    expect(chain.order.mock.calls).toEqual([["created_at", { ascending: false }], ["id", { ascending: false }]]);
    expect(result).toMatchObject({ total: 30, page: 2, pageSize: 25 });
    expect(result.items[0]).not.toHaveProperty("survey_answers");
    expect(result.items[0].learningGoals).toEqual(["website"]);
  });
  it("returns the real total for PostgREST's out-of-range response instead of a server error", async () => {
    const chain = { select: vi.fn(), order: vi.fn(), range: vi.fn() };
    chain.select.mockImplementation((_columns, options) => options?.head ? Promise.resolve({ count: 3, error: null }) : chain);
    chain.order.mockReturnValue(chain);
    chain.range.mockResolvedValue({ data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } });
    await expect(listAiCourseApplications({ from: () => chain } as unknown as SupabaseClient, 100)).resolves.toEqual({ items: [], total: 3, page: 100, pageSize: 25 });
    chain.select.mockImplementation((_columns, options) => options?.head ? Promise.resolve({ count: null, error: { code: "42501" } }) : chain);
    await expect(listAiCourseApplications({ from: () => chain } as unknown as SupabaseClient, 100)).rejects.toThrow();
  });
});
