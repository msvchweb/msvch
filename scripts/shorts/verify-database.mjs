import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const originalSpawn = childProcess.spawn;
childProcess.spawn = (command, args, options) =>
  originalSpawn(command, args, { ...options, windowsHide: true });
syncBuiltinESMExports();
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(
    process.env.SHORTS_NATIVE_POSTGRES_MODULE ??
      (() => {
        throw new Error(
          "Set SHORTS_NATIVE_POSTGRES_MODULE to the installed embedded-postgres dist/index.js path.",
        );
      })(),
  ).href
);
const { installShortsTestSchema } = await import(
  new URL("./lib/test-db.ts", import.meta.url).href
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const clusterDir = await mkdtemp(path.join(os.tmpdir(), "msvch-shorts-db-"));
const pg = new EmbeddedPostgres({
  databaseDir: clusterDir,
  user: "postgres",
  password: randomBytes(24).toString("hex"),
  port,
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1", "-c", "max_connections=20"],
  onLog: () => {},
  onError: () => {},
});
const clients = [];
let started = false;
async function connect(database = "shorts_test") {
  const c = pg.getPgClient(database, "127.0.0.1");
  await c.connect();
  clients.push(c);
  return c;
}
try {
  await pg.initialise();
  await pg.start();
  started = true;
  const root = await connect("postgres");
  console.log(
    "Native PostgreSQL version: " +
      (await root.query("show server_version")).rows[0].server_version,
  );
  await root.query("create database shorts_test");
  const admin = await connect();
  await installShortsTestSchema({ exec: (sql) => admin.query(sql) }, true);
  console.log("Native PostgreSQL migrations: PASS");
  const a = await connect(),
    b = await connect();
  assert.notEqual(
    (await a.query("select pg_backend_pid() as id")).rows[0].id,
    (await b.query("select pg_backend_pid() as id")).rows[0].id,
  );
  await a.query("set role service_role");
  await b.query("set role service_role");
  const job = "10000000-0000-4000-8000-000000000001",
    clip = "20000000-0000-4000-8000-000000000001";
  const attempts = await Promise.allSettled([
    a.query("select id from shorts_create_attempt($1)", [job]),
    b.query("select id from shorts_create_attempt($1)", [job]),
  ]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    attempts.filter(
      (r) =>
        r.status === "rejected" &&
        r.reason.message.includes("active_attempt_exists"),
    ).length,
    1,
  );
  const attempt = attempts.find((r) => r.status === "fulfilled").value.rows[0]
    .id;
  const claims = await Promise.all([
    a.query("select shorts_claim_attempt($1,'runA',1) as ok", [attempt]),
    b.query("select shorts_claim_attempt($1,'runB',1) as ok", [attempt]),
  ]);
  assert.equal(claims.filter((r) => r.rows[0].ok).length, 1);
  const owner = claims[0].rows[0].ok ? "runA" : "runB";
  assert.equal(
    (
      await a.query(
        "select shorts_finish_attempt($1,$2,2,false,'stale','stale') as ok",
        [attempt, owner],
      )
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await a.query(
        "select shorts_finish_attempt($1,$2,1,false,'test','test') as ok",
        [attempt, owner],
      )
    ).rows[0].ok,
    true,
  );
  console.log(
    "Native separate-connection generation race + stale ownership: PASS",
  );
  await admin.query(
    "update shorts_clips set transcript_status='verified',media_check='{\"valid\":true}'; update shorts_settings set publishing_enabled=true,daily_publish_limit=1; insert into shorts_connections(platform,account_id,credentials_encrypted,status) values('youtube','channel','cipher','connected'),('instagram','account','cipher','connected')",
  );
  await a.query(
    "select shorts_approve_schedule($1,1,array['youtube'],'2030-01-01T00:00:00Z',false)",
    [clip],
  );
  const leases = await Promise.all([
    a.query(
      "select shorts_claim_publication('2030-01-02T00:00:00Z','workerA','live') as lease",
    ),
    b.query(
      "select shorts_claim_publication('2030-01-02T00:00:00Z','workerB','live') as lease",
    ),
  ]);
  assert.equal(leases.filter((r) => r.rows[0].lease !== null).length, 1);
  const lease = leases.find((r) => r.rows[0].lease !== null).rows[0].lease;
  await admin.query(
    "insert into shorts_clips(id,job_id,clip_index,start_sec,end_sec,transcript_status,media_check,video_url) values('20000000-0000-4000-8000-000000000002',$1,1,180,210,'verified','{\"valid\":true}','https://example.com/b.mp4')",
    [job],
  );
  await a.query(
    "select shorts_approve_schedule('20000000-0000-4000-8000-000000000002',1,array['youtube','instagram'],'2030-01-01T00:00:00Z',false)",
  );
  const quotaClaims = await Promise.all([
    a.query(
      "select shorts_claim_publication('2030-01-02T00:00:00Z','quotaA','live') as lease",
    ),
    b.query(
      "select shorts_claim_publication('2030-01-02T00:00:00Z','quotaB','live') as lease",
    ),
  ]);
  const nonnull = quotaClaims.map((r) => r.rows[0].lease).filter(Boolean);
  assert.equal(nonnull.length, 1);
  assert.equal(nonnull[0].platform, "instagram");
  console.log("Native concurrent publication claim + platform quota: PASS");
  const reviewRace = await Promise.allSettled([
    a.query("select shorts_review_clip($1,'edit',1,$2)", [
      clip,
      JSON.stringify({
        title: "blocked",
        titleYt: "blocked",
        captionYt: "x",
        captionIg: "x",
      }),
    ]),
    b.query(
      "select shorts_guard_publication($1,$2,'2030-01-02T00:01:00Z') as ok",
      [lease.id, lease.lease_token],
    ),
  ]);
  assert.equal(reviewRace[0].status, "rejected");
  assert.equal(reviewRace[1].status, "fulfilled");
  assert.equal(reviewRace[1].value.rows[0].ok, true);
  console.log("Native review/publication race: PASS");
  await admin.query(
    "update shorts_publications set lease_expires_at=now()-interval '1 minute' where id=$1",
    [lease.id],
  );
  assert.equal(
    (
      await a.query(
        "select shorts_recover_publication($1,'wrong-worker','recovery') as lease",
        [lease.id],
      )
    ).rows[0].lease,
    null,
  );
  const recovered = (
    await a.query(
      "select shorts_recover_publication($1,$2,'recovery') as lease",
      [lease.id, lease.worker_run_id],
    )
  ).rows[0].lease;
  assert.notEqual(recovered.lease_token, lease.lease_token);
  assert.equal(
    (
      await b.query("select shorts_publication_checkpoint($1,$2,'old') as ok", [
        lease.id,
        lease.lease_token,
      ])
    ).rows[0].ok,
    false,
  );
  assert.equal(
    (
      await a.query(
        "select shorts_publication_checkpoint($1,$2,'encrypted-test-checkpoint') as ok",
        [lease.id, recovered.lease_token],
      )
    ).rows[0].ok,
    true,
  );
  assert.equal(
    (
      await b.query(
        'select shorts_finish_publication($1,$2,\'{"status":"needs_attention","code":"unknown"}\') as ok',
        [lease.id, lease.lease_token],
      )
    ).rows[0].ok,
    false,
  );
  await assert.rejects(
    a.query(
      'select shorts_finish_publication($1,$2,\'{"status":"test_uploaded","providerId":"test"}\')',
      [lease.id, recovered.lease_token],
    ),
    /test_mode_mismatch/,
  );
  assert.equal(
    (
      await a.query(
        'select shorts_finish_publication($1,$2,\'{"status":"needs_attention","code":"upload_result_unknown"}\') as ok',
        [lease.id, recovered.lease_token],
      )
    ).rows[0].ok,
    true,
  );
  await assert.rejects(
    a.query("select shorts_change_publication($1,'retry')", [lease.id]),
    /publication_requires_reconciliation/,
  );
  console.log(
    "Native lease recovery/checkpoint fencing + ambiguous result protection: PASS",
  );
  for (const [i, role] of ["member", "staff", "admin", "master"].entries()) {
    const uid = "30000000-0000-4000-8000-00000000000" + i;
    await admin.query("insert into profiles values($1,$2)", [uid, role]);
    await admin.query("set role authenticated");
    await admin.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid,
    ]);
    assert.equal(
      (await admin.query("select count(*)::int as n from shorts_clips")).rows[0]
        .n,
      i < 2 ? 0 : 2,
    );
    await assert.rejects(
      admin.query("select * from shorts_connections"),
      /permission denied/,
    );
    await assert.rejects(
      admin.query("select shorts_claim_attempt($1,'bad',1)", [attempt]),
      /permission denied/,
    );
    await admin.query("reset role");
  }
  await admin.query("set request.jwt.claim.sub=''; set role anon");
  assert.equal(
    (await admin.query("select count(*)::int as n from shorts_clips")).rows[0]
      .n,
    0,
  );
  await admin.query("reset role");
  console.log(
    "Native anon/member/staff/admin/master/service permissions: PASS",
  );
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  if (started) await pg.stop();
  if (
    path.dirname(clusterDir) === path.resolve(os.tmpdir()) &&
    path.basename(clusterDir).startsWith("msvch-shorts-db-")
  )
    await rm(clusterDir, { recursive: true, force: true });
}
