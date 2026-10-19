// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "./test-db";
let db: Awaited<ReturnType<typeof createTestDb>>;
const job = "10000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = await createTestDb();
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("preserves legacy media and marks its reason as unverified speech", async () => {
  const { rows } = await db.query(
    "select video_url, selection_reason, transcript_status from shorts_clips",
  );
  expect(rows).toEqual([
    {
      video_url: "https://example.com/old.mp4",
      selection_reason: "기존 선정 이유",
      transcript_status: "unverified",
    },
  ]);
});
it("allows only one active attempt and refuses stale completion", async () => {
  const { rows } = await db.query<{ id: string }>(
    "select id from shorts_create_attempt($1)",
    [job],
  );
  const id = rows[0].id;
  await expect(
    db.query("select * from shorts_create_attempt($1)", [job]),
  ).rejects.toThrow("active_attempt_exists");
  expect(
    (await db.query("select shorts_claim_attempt($1,'run1',1) as ok", [id]))
      .rows,
  ).toEqual([{ ok: true }]);
  expect(
    (
      await db.query(
        "select shorts_finish_attempt($1,'run1',2,false,'x','x') as ok",
        [id],
      )
    ).rows,
  ).toEqual([{ ok: false }]);
  await db.query(
    "select shorts_finish_attempt($1,'run1',1,false,'render_failed','render failed')",
    [id],
  );
  expect(
    (await db.query("select count(*)::int as n from shorts_clips")).rows,
  ).toEqual([{ n: 1 }]);
  const next = await db.query<{ id: string }>(
    "select id from shorts_create_attempt($1)",
    [job],
  );
  expect(next.rows[0].id).not.toBe(id);
  expect(
    (
      await db.query(
        "select shorts_finish_attempt($1,'run1',1,false,'late','late') as ok",
        [id],
      )
    ).rows,
  ).toEqual([{ ok: false }]);
});
it("restricts unpublished rows and transition RPCs to their intended roles", async () => {
  for (const [i, role] of ["member", "staff", "admin", "master"].entries()) {
    const uid = `30000000-0000-4000-8000-00000000000${i}`;
    await db.query("insert into profiles values ($1,$2)", [uid, role]);
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${uid}';`,
    );
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int as n from shorts_clips",
        )
      ).rows[0].n,
    ).toBe(i < 2 ? 0 : 1);
    await expect(
      db.query("select * from shorts_create_attempt($1)", [job]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  }
  await db.exec("set request.jwt.claim.sub=''; set role anon");
  expect(
    (await db.query("select count(*)::int as n from shorts_clips")).rows,
  ).toEqual([{ n: 0 }]);
  await db.exec("reset role; set role service_role");
  expect(
    (await db.query("select count(*)::int as n from shorts_clips")).rows,
  ).toEqual([{ n: 1 }]);
  await db.exec("reset role");
});
it("saves a clip only for its owner and never duplicates it on replay", async () => {
  const { rows } = await db.query<{ id: string }>(
    "select id from shorts_job_attempts where status='queued'",
  );
  const id = rows[0].id;
  await db.query("select shorts_claim_attempt($1,'run2',1)", [id]);
  const clip = {
    clip_index: 0,
    start_sec: 180,
    end_sec: 210,
    title: "제목",
    transcript: "실제 발언",
    selection_reason: "선정 이유",
    media_check: { valid: true },
    video_url: "https://example.com/new.mp4",
  };
  await expect(
    db.query("select shorts_save_clip($1,'stale',1,$2)", [
      id,
      JSON.stringify(clip),
    ]),
  ).rejects.toThrow("attempt_ownership_lost");
  const saved = await db.query(
    "select shorts_save_clip($1,'run2',1,$2) as id",
    [id, JSON.stringify(clip)],
  );
  expect(
    (
      await db.query("select shorts_save_clip($1,'run2',1,$2) as id", [
        id,
        JSON.stringify(clip),
      ])
    ).rows,
  ).toEqual(saved.rows);
  await db.query("select shorts_finish_attempt($1,'run2',1,true)", [id]);
  const retry = await db.query<{ id: string }>(
    "select id from shorts_create_attempt($1)",
    [job],
  );
  await db.query("select shorts_claim_attempt($1,'run3',1)", [
    retry.rows[0].id,
  ]);
  await db.query(
    "select shorts_finish_attempt($1,'run3',1,false,'failed','failed')",
    [retry.rows[0].id],
  );
  expect(
    (
      await db.query("select review_attempt_id from shorts_jobs where id=$1", [
        job,
      ])
    ).rows,
  ).toEqual([{ review_attempt_id: id }]);
});
it("permits operator cancellation only before a runner claims the queued attempt", async () => {
  const first = (
    await db.query<{ id: string }>("select id from shorts_create_attempt($1)", [
      job,
    ])
  ).rows[0].id;
  expect(
    (
      await db.query(
        "select shorts_fail_attempt($1,'canceled','canceled') as ok",
        [first],
      )
    ).rows,
  ).toEqual([{ ok: true }]);
  expect(
    (await db.query("select shorts_claim_attempt($1,'late',1) as ok", [first]))
      .rows,
  ).toEqual([{ ok: false }]);
  const second = (
    await db.query<{ id: string }>("select id from shorts_create_attempt($1)", [
      job,
    ])
  ).rows[0].id;
  await db.query("select shorts_claim_attempt($1,'running',1)", [second]);
  expect(
    (
      await db.query(
        "select shorts_fail_attempt($1,'canceled','canceled') as ok",
        [second],
      )
    ).rows,
  ).toEqual([{ ok: false }]);
});
