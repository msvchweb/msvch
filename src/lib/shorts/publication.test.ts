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
