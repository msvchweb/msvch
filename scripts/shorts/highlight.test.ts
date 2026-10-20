// @vitest-environment node
import { expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveHighlight,
  rankHighlights,
  selectHighlights,
} from "./highlight";
import { modelJson } from "./lib/model";
vi.mock("./lib/model", () => ({ modelJson: vi.fn() }));
const segments = [
  { id: "s0", startMs: 70000, endMs: 72000, text: "하나님은" },
  {
    id: "s1",
    startMs: 180000,
    endMs: 190000,
    text: "하나님은 여러분을 결코 포기하지 않으십니다",
  },
  {
    id: "s2",
    startMs: 190000,
    endMs: 210000,
    text: "그러니 오늘도 믿음으로 걸어가십시오",
  },
];
const selection = {
  start_id: "s1",
  end_id: "s2",
  quote_start: segments[1].text,
  quote_end: segments[2].text,
  title: "포기하지 않으시는 하나님",
  hook: "낙심한 당신에게",
  reason: "위로",
  keywords: ["하나님"],
  card_text: "포기하지 않으십니다",
  mood: "peaceful" as const,
  topic: "위로",
  scores: { hook: 3, standalone: 3, empathy: 3, completeness: 3, context: 3 },
};
it("selects the requested complete segment at 180s, never its earlier substring", () => {
  expect(resolveHighlight(selection, segments)).toMatchObject({
    start_sec: 180,
    end_sec: 210,
    transcript:
      "하나님은 여러분을 결코 포기하지 않으십니다 그러니 오늘도 믿음으로 걸어가십시오",
  });
});
it("rejects missing/reversed IDs, quote mismatch, and out-of-range duration", () => {
  for (const patch of [
    { start_id: "missing" },
    { start_id: "s2", end_id: "s1" },
    { quote_start: "하나님은" },
    { end_id: "s1", quote_end: segments[1].text },
    { start_id: "s0", quote_start: "하나님은" },
  ]) {
    expect(() =>
      resolveHighlight({ ...selection, ...patch }, segments),
    ).toThrow();
  }
});
it("drops overlapping and weak/context-dependent candidates without padding the count", () => {
  const result = rankHighlights(
    [
      selection,
      selection,
      { ...selection, scores: { ...selection.scores, context: 2 } },
    ],
    segments,
    5,
  );
  expect(result.accepted).toHaveLength(1);
  expect(result.rejected).toHaveLength(2);
});
it("does not silently remove a credit line from the selected source span", () => {
  const withCredit = [
    segments[1],
    { id: "credit", startMs: 190000, endMs: 191000, text: "자막 제작: 교회" },
    segments[2],
  ];
  expect(() => resolveHighlight(selection, withCredit)).toThrow(
    "invalid_clip_range",
  );
});
it("checks the complete source span even when credit lines were hidden from the model input", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "shorts-selection-test-"));
  try {
    const file = path.join(dir, "source.json3");
    await writeFile(
      file,
      JSON.stringify({
        events: [
          {
            tStartMs: 180000,
            dDurationMs: 10000,
            segs: [{ utf8: segments[1].text }],
          },
          {
            tStartMs: 190000,
            dDurationMs: 1000,
            segs: [{ utf8: "자막 제작: 교회" }],
          },
          {
            tStartMs: 191000,
            dDurationMs: 19000,
            segs: [{ utf8: segments[2].text }],
          },
        ],
      }),
    );
    vi.mocked(modelJson).mockResolvedValue({
      highlights: [{ ...selection, start_id: "s000000", end_id: "s000002" }],
    });
    await expect(selectHighlights(file, 5)).rejects.toThrow(
      "no_qualified_highlights",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
