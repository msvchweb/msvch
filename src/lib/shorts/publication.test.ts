// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "../../../scripts/shorts/lib/test-db";
let db: Awaited<ReturnType<typeof createTestDb>>;
const clip = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = await createTestDb(true);
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("requires validated media and a connected account before scheduling", async () => {
  await expect(
    db.query(
      "select shorts_approve_schedule($1,1,array['youtube'],'2026-10-19T00:00:00Z',false)",
      [clip],
    ),
  ).rejects.toThrow("media_not_verified");
  await db.query(
    "update shorts_clips set transcript_status='verified',media_check='{\"valid\":true}' where id=$1",
    [clip],
  );
  await expect(
    db.query(
      "select shorts_approve_schedule($1,1,array['youtube'],'2026-10-19T00:00:00Z',false)",
      [clip],
    ),
  ).rejects.toThrow("account_not_connected");
});
it("schedules each platform once and cancels queued publications on content changes", async () => {
  await db.exec(
    "insert into shorts_connections(platform,account_id,credentials_encrypted,status) values ('youtube','channel','cipher','connected'),('instagram','account','cipher','connected')",
  );
  for (let i = 0; i < 2; i++)
    await db.query(
      "select shorts_approve_schedule($1,1,array['youtube','instagram'],'2026-10-19T00:00:00Z',false)",
      [clip],
    );
  expect(
    (await db.query("select count(*)::int as n from shorts_publications")).rows,
  ).toEqual([{ n: 2 }]);
  await db.query("select shorts_review_clip($1,'edit',1,$2)", [
    clip,
    JSON.stringify({
      title: "変更",
      titleYt: "title",
      captionYt: "yt",
      captionIg: "ig",
    }),
  ]);
  expect(
    (await db.query("select distinct status from shorts_publications")).rows,
  ).toEqual([{ status: "canceled" }]);
});
it("allows an explicitly canceled reservation to be scheduled again for the same approved version", async () => {
  await db.query(
    "select shorts_approve_schedule($1,2,array['youtube'],'2030-10-19T00:00:00Z',false)",
    [clip],
  );
  const publication = (
    await db.query<{ id: string }>(
      "select id from shorts_publications where content_version=2",
    )
  ).rows[0];
  await db.query("select shorts_change_publication($1,'cancel')", [
    publication.id,
  ]);
  await db.query(
    "select shorts_approve_schedule($1,2,array['youtube'],'2030-10-20T00:00:00Z',false)",
    [clip],
  );
  expect(
    (
      await db.query(
        "select status,scheduled_at::text as scheduled from shorts_publications where id=$1",
        [publication.id],
      )
    ).rows[0],
  ).toMatchObject({ status: "queued" });
});
it("still permits cancellation and editing when a retry has made no public request", async () => {
  const id = "20000000-0000-4000-8000-000000000002";
  await db.query(
    "insert into shorts_clips(id,job_id,clip_index,start_sec,end_sec,transcript_status,media_check,video_url) values($1,'10000000-0000-4000-8000-000000000001',1,180,210,'verified','{\"valid\":true}','https://example.com/clip.mp4')",
    [id],
  );
  await db.exec("update shorts_settings set publishing_enabled=true");
  await db.query(
    "select shorts_approve_schedule($1,1,array['youtube'],'2000-01-01T00:00:00Z',false)",
    [id],
  );
  const p = (
    await db.query<{ p: { id: string; lease_token: string } }>(
      "select shorts_claim_publication(now(),'worker','live') as p",
    )
  ).rows[0].p;
  await db.query(
    'select shorts_finish_publication($1,$2,\'{"status":"retry_wait","code":"provider_processing"}\')',
    [p.id, p.lease_token],
  );
  await db.query("select shorts_change_publication($1,'cancel')", [p.id]);
  await db.query(
    "select shorts_review_clip($1,'edit',1,'{\"title\":\"changed\"}')",
    [id],
  );
  expect(
    (
      await db.query(
        "select status,quota_date,public_request_started from shorts_publications where id=$1",
        [p.id],
      )
    ).rows,
  ).toEqual([
    { status: "canceled", quota_date: null, public_request_started: false },
  ]);
});
