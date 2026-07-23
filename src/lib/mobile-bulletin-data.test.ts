import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMobileBulletinRelations } from "@/lib/mobile-bulletin-data";
import type { MobileService, WorshipResource } from "@/types/mobile-bulletin";

const RESOURCE_ID = "00000000-0000-4000-8000-000000000001";
const VIDEO_ID = "video123";
const RESOURCE_COLUMNS = "id,kind,title,reference,content,external_url,source_label,rights_note,is_active,created_at,updated_at";

afterEach(() => vi.restoreAllMocks());

interface QueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

function createSupabaseMock(results: Record<string, QueryResult>) {
  const queries: Record<string, { select: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> }> = {};
  const from = vi.fn((table: string) => {
    const inQuery = vi.fn().mockResolvedValue(results[table]);
    const select = vi.fn(() => ({ in: inQuery }));
    queries[table] = { select, in: inQuery };
    return { select };
  });
  return { supabase: { from } as unknown as SupabaseClient, from, queries };
}

function createServices(): MobileService[] {
  return [{
    id: "sun",
    type: "sunday",
    label: "주일예배",
    startsAt: "2026-07-26T08:00:00+09:00",
    endsAt: "2026-07-26T13:30:00+09:00",
    primary: true,
    visible: true,
    leader: "",
    liveUrl: null,
    videoId: VIDEO_ID,
    items: [{
      id: "creed",
      label: "사도신경",
      summary: "",
      assignees: [],
      emphasized: false,
      visible: true,
      resourceId: RESOURCE_ID,
      externalUrl: null,
    }],
  }];
}

describe("loadMobileBulletinRelations", () => {
  it("returns empty relations without issuing Supabase queries when no relation IDs exist", async () => {
    const { supabase, from } = createSupabaseMock({});

    await expect(loadMobileBulletinRelations(supabase, [])).resolves.toEqual({
      resourcesById: {},
      validVideoIds: [],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("queries referenced resources and videos and returns plain relation data", async () => {
    const resource: WorshipResource = {
      id: RESOURCE_ID,
      kind: "creed",
      title: "사도신경",
      reference: "",
      content: "내용",
      external_url: null,
      source_label: null,
      rights_note: null,
      is_active: true,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
    const { supabase, from, queries } = createSupabaseMock({
      worship_resources: { data: [resource], error: null },
      sermon_videos: { data: [{ video_id: VIDEO_ID }], error: null },
    });

    await expect(loadMobileBulletinRelations(supabase, createServices())).resolves.toEqual({
      resourcesById: { [RESOURCE_ID]: resource },
      validVideoIds: [VIDEO_ID],
    });
    expect(from).toHaveBeenNthCalledWith(1, "worship_resources");
    expect(queries.worship_resources.select).toHaveBeenCalledWith(RESOURCE_COLUMNS);
    expect(queries.worship_resources.in).toHaveBeenCalledWith("id", [RESOURCE_ID]);
    expect(from).toHaveBeenNthCalledWith(2, "sermon_videos");
    expect(queries.sermon_videos.select).toHaveBeenCalledWith("video_id");
    expect(queries.sermon_videos.in).toHaveBeenCalledWith("video_id", [VIDEO_ID]);
  });

  it("returns empty relations on query errors and logs only safe generic messages", async () => {
    const unsafeResourceError = "resource secret details";
    const unsafeVideoError = "video secret details";
    const { supabase } = createSupabaseMock({
      worship_resources: { data: [{ id: RESOURCE_ID }], error: { message: unsafeResourceError } },
      sermon_videos: { data: [{ video_id: VIDEO_ID }], error: { message: unsafeVideoError } },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(loadMobileBulletinRelations(supabase, createServices())).resolves.toEqual({
      resourcesById: {},
      validVideoIds: [],
    });
    expect(consoleError.mock.calls).toEqual([
      ["mobile bulletin resources query failed"],
      ["mobile bulletin videos query failed"],
    ]);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(unsafeResourceError);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(unsafeVideoError);
  });
});
