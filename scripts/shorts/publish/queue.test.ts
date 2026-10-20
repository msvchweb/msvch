// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "../lib/test-db";
let db: Awaited<ReturnType<typeof createTestDb>>;
const clip = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = await createTestDb(true);
  await db.exec(
    "update shorts_clips set transcript_status='verified',media_check='{\"valid\":true}'; insert into shorts_connections(platform,account_id,credentials_encrypted,status) values ('youtube','channel','cipher','connected'),('instagram','account','cipher','connected')",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("does not claim while disabled, before due, or with a stale approval", async () => {
  await db.query(
    "select shorts_approve_schedule($1,1,array['youtube'],'2026-10-19T00:00:00Z',false)",
    [clip],
  );
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-19T00:00:00Z','worker','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  await db.exec("update shorts_settings set publishing_enabled=true");
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-18T00:00:00Z','worker','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  await db.exec("update shorts_clips set approved_version=0");
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-19T00:00:00Z','worker','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  await db.exec("update shorts_clips set approved_version=1");
});
it("leases once, fences old workers, and prevents editing an in-flight clip", async () => {
  const lease = (
    await db.query<{ lease: { id: string; lease_token: string } }>(
      "select shorts_claim_publication('2026-10-19T14:59:00Z','worker','live') as lease",
    )
  ).rows[0].lease;
  expect(lease.id).toBeTruthy();
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-19T14:59:00Z','other','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  await expect(
    db.query(
      "select shorts_review_clip($1,'reject',1,'{\"category\":\"other\"}')",
      [clip],
    ),
  ).rejects.toThrow("publication_in_flight");
  expect(
    (
      await db.query(
        "select shorts_guard_publication($1,gen_random_uuid(),'2026-10-19T15:01:00Z') as ok",
        [lease.id],
      )
    ).rows,
  ).toEqual([{ ok: false }]);
  expect(
    (
      await db.query(
        "select shorts_guard_publication($1,$2,'2026-10-19T15:01:00Z') as ok",
        [lease.id, lease.lease_token],
      )
    ).rows,
  ).toEqual([{ ok: true }]);
  expect(
    (
      await db.query(
        "select quota_date::text as day from shorts_publications where id=$1",
        [lease.id],
      )
    ).rows,
  ).toEqual([{ day: "2026-10-20" }]);
});
it("keeps private test publications out of live mode and real publication counts", async () => {
  // Separate clip avoids sharing approval with an in-flight publication.
  const id = "20000000-0000-4000-8000-000000000002";
  await db.query(
    "insert into shorts_clips(id,job_id,clip_index,start_sec,end_sec,transcript_status,media_check,video_url) values ($1,'10000000-0000-4000-8000-000000000001',1,180,210,'verified','{\"valid\":true}','https://example.com/t.mp4')",
    [id],
  );
  await db.query(
    "select shorts_approve_schedule($1,1,array['youtube'],'2026-10-19T00:00:00Z',true)",
    [id],
  );
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-19T01:00:00Z','live','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  const result = await db.query<{
    lease: { test_only: boolean; quota_date: null };
  }>(
    "select shorts_claim_publication('2026-10-19T01:00:00Z','test','private-test') as lease",
  );
  expect(result.rows[0].lease).toMatchObject({
    test_only: true,
    quota_date: null,
  });
});
it("enforces daily platform quotas independently and permits a new KST day's reservation", async () => {
  await db.exec("update shorts_settings set daily_publish_limit=1");
  const id = "20000000-0000-4000-8000-000000000003";
  await db.query(
    "insert into shorts_clips(id,job_id,clip_index,start_sec,end_sec,transcript_status,media_check,video_url) values ($1,'10000000-0000-4000-8000-000000000001',2,240,270,'verified','{\"valid\":true}','https://example.com/t2.mp4')",
    [id],
  );
  await db.query(
    "select shorts_approve_schedule($1,1,array['youtube','instagram'],'2026-10-19T00:00:00Z',false)",
    [id],
  );
  const claim = (
    await db.query<{ lease: { platform: string } }>(
      "select shorts_claim_publication('2026-10-20T00:00:00Z','quota','live') as lease",
    )
  ).rows[0].lease;
  expect(claim.platform).toBe("instagram");
  expect(
    (
      await db.query(
        "select shorts_claim_publication('2026-10-20T00:00:00Z','quota2','live') as lease",
      )
    ).rows,
  ).toEqual([{ lease: null }]);
  const next = (
    await db.query<{ lease: { platform: string; quota_date: string } }>(
      "select shorts_claim_publication('2026-10-21T00:00:00Z','quota3','live') as lease",
    )
  ).rows[0].lease;
  expect(next).toMatchObject({ platform: "youtube", quota_date: "2026-10-21" });
});
it("never exposes private tokens/checkpoints through authenticated or anonymous table access", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await expect(db.query("select * from shorts_connections")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("select * from shorts_publish_private"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  }
});
