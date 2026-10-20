// @vitest-environment node
import { expect, it } from "vitest";
import { parseMetadata } from "./metadata";
const a = {
  clip_id: "a",
  title_yt: "제목 A",
  caption_yt: "설명 A",
  caption_ig: "캡션 A",
};
const b = { ...a, clip_id: "b", title_yt: "제목 B" };
it("joins metadata by clip ID rather than response order, including fewer than five clips", () => {
  expect(parseMetadata([b, a], ["a", "b"]).map((m) => m.title_yt)).toEqual([
    "제목 A",
    "제목 B",
  ]);
  expect(parseMetadata([a], ["a"])).toHaveLength(1);
});
it("rejects duplicates, omissions and empty titles instead of silently assigning the wrong caption", () => {
  for (const items of [[a, a], [a], [a, { ...b, title_yt: "" }]])
    expect(() => parseMetadata(items, ["a", "b"])).toThrow();
});
