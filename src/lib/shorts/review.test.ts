// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDb } from "../../../scripts/shorts/lib/test-db";
let db: Awaited<ReturnType<typeof createTestDb>>;
const id = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = await createTestDb();
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("resets approval on edits and rejects stale editor versions", async () => {
  await db.query("select shorts_review_clip($1,'approve',1,'{}')", [id]);
  const patch = {
    title: "수정 제목",
    titleYt: "게시 제목",
    captionYt: "설명",
    captionIg: "캡션",
  };
  await db.query("select shorts_review_clip($1,'edit',1,$2)", [
    id,
    JSON.stringify(patch),
  ]);
  expect(
    (
      await db.query(
        "select title,content_version,approved_version,review_status from shorts_clips where id=$1",
        [id],
      )
    ).rows,
  ).toEqual([
    {
      title: "수정 제목",
      content_version: 2,
      approved_version: null,
      review_status: "pending",
    },
  ]);
  await expect(
    db.query("select shorts_review_clip($1,'approve',1,'{}')", [id]),
  ).rejects.toThrow("version_conflict");
});
it("does not approve old review artifacts while their replacement is being generated", async () => {
  await db.query(
    "select shorts_create_attempt('10000000-0000-4000-8000-000000000001')",
  );
  await expect(
    db.query("select shorts_review_clip($1,'approve',2,'{}')", [id]),
  ).rejects.toThrow("generation_in_progress");
});
