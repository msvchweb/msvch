// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editClips } from "./edit";
import type { HighlightSegment } from "./highlight";

let workDir: string;
// ASS 생성과 파일 입출력은 실제로 실행하고, 외부 인코더만 생략한다.
vi.mock("./lib/process", () => ({ runTool: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }) }));
vi.mock("./verify-clip", () => ({
  verifyClip: vi.fn().mockResolvedValue({ valid: true, duration: 10, warnings: [], errors: [] }),
}));

interface SubtitleEvent {
  tStartMs: number;
  dDurationMs: number;
  segs: { utf8: string }[];
}

function seconds(time: string): number {
  const [h, m, s] = time.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

async function renderCaptions(
  events: SubtitleEvent[],
  overrides: Partial<HighlightSegment> = {},
) {
  const subtitlePath = path.join(workDir, "input.json3");
  writeFileSync(subtitlePath, JSON.stringify({ events }), "utf-8");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  await editClips("input.mp4", subtitlePath, [{
    id: "caption-test",
    start_sec: 0,
    end_sec: 10,
    title: "하나님의 갑옷",
    hook: "",
    reason: "",
    keywords: [],
    card_text: "하나님의 갑옷",
    mood: "peaceful",
    voiced: [{ start: 0, end: 10 }],
    transcript: events.flatMap((event) => event.segs.map((seg) => seg.utf8)).join(" "),
    selection_data: {
      start_id: "s0",
      end_id: "s1",
      quote_start: "하나님은",
      quote_end: "함께하십니다",
      title: "하나님의 갑옷",
      hook: "믿음으로 살아가기",
      reason: "믿음에 대한 말씀",
      topic: "믿음",
      keywords: [],
      card_text: "하나님의 갑옷",
      mood: "peaceful",
      scores: { hook: 3, standalone: 3, empathy: 3, completeness: 3, context: 3 },
      total_score: 15,
    },
    ...overrides,
  }], { workDir, bgmEnabled: false });
  return readFileSync(path.join(workDir, "clip_0.ass"), "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line) => {
      const fields = line.split(",");
      return {
        start: seconds(fields[1]),
        end: seconds(fields[2]),
        style: fields[3],
        text: fields.slice(9).join(","),
      };
    })
    .filter((caption) => caption.style === "Default");
}

function event(text: string, startMs = 0, durationMs = 10_000): SubtitleEvent {
  return { tStartMs: startMs, dDurationMs: durationMs, segs: [{ utf8: text }] };
}

const hangulLine = "가나다라마바사아자차카타파하";

beforeEach(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), "shorts-captions-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(workDir, { recursive: true, force: true });
});

describe("쇼츠 자막 분할", () => {
  it("5줄 분량의 전사를 최대 2줄씩 순서대로 표시하고 원문을 보존한다", async () => {
    const text = hangulLine.repeat(5);
    const captions = await renderCaptions([event(text)]);

    expect(captions).toHaveLength(3);
    expect(captions.map(({ start, end }) => [start, end])).toEqual([
      [0, 4], [4, 8], [8, 10],
    ]);
    for (const caption of captions) {
      const lines = caption.text.split("\\N");
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.every((line) => [...line].length <= 14)).toBe(true);
    }
    expect(captions.map(({ text }) => text.replace(/\\N/g, "")).join("")).toBe(text);
  });

  it("전사에 포함된 여러 개의 줄바꿈을 정리하고 모든 단어를 보존한다", async () => {
    const text = "하나님은\n우리와\r\n함께\n계십니다\n언제나\n우리를\n사랑하십니다.";
    const captions = await renderCaptions([event(text)]);
    const restored = captions.map(({ text }) => text.replace(/\\N/g, " ")).join(" ");

    expect(restored.replace(/\s+/g, " ").trim()).toBe(text.replace(/\s+/g, " "));
    expect(captions.every(({ text }) => text.split("\\N").length <= 2)).toBe(true);
  });

  it("다음 자막과 겹치는 구간에서도 분할 자막이 중첩되지 않는다", async () => {
    const captions = await renderCaptions([
      event(hangulLine.repeat(5)),
      event("다음 말씀입니다", 2_000, 2_000),
    ]);

    expect(captions.length).toBeGreaterThan(2);
    for (let i = 0; i < captions.length - 1; i++) {
      expect(captions[i].end).toBeLessThanOrEqual(captions[i + 1].start);
      expect(captions[i].end).toBeGreaterThan(captions[i].start);
    }
    expect(captions.at(-1)?.text).toBe("다음 말씀입니다");
  });

  it("침묵 컷 이전의 발화 시각을 기준으로 나누어 삭제된 구간의 자막을 제외한다", async () => {
    const captions = await renderCaptions([event(hangulLine.repeat(5))], {
      voiced: [{ start: 0, end: 4 }, { start: 8, end: 10 }],
    });

    expect(captions.map(({ start, end }) => [start, end])).toEqual([[0, 4], [4, 6]]);
    expect(captions.map(({ text }) => text.replace(/\\N/g, "")).join(""))
      .toBe(hangulLine.repeat(3));
  });

  it("클립 경계 밖의 분할 자막은 표시하지 않는다", async () => {
    const captions = await renderCaptions([event(hangulLine.repeat(5))], {
      start_sec: 4,
      end_sec: 8,
      voiced: [{ start: 4, end: 8 }],
    });

    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({ start: 0, end: 4 });
    expect(captions[0].text.replace(/\\N/g, "")).toBe(hangulLine.repeat(2));
  });

  it("한글과 영문이 섞인 긴 단어도 잘라서 누락 없이 표시한다", async () => {
    const text = "믿음Faith".repeat(12);
    const captions = await renderCaptions([event(text)]);

    expect(captions.length).toBeGreaterThan(1);
    for (const { text } of captions) {
      const lines = text.split("\\N");
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines.every((line) => [...line].length <= 23)).toBe(true);
    }
    expect(captions.map(({ text }) => text.replace(/\\N/g, "")).join("")).toBe(text);
  });

  it("분할 후에도 핵심 단어 강조를 유지한다", async () => {
    const captions = await renderCaptions([
      event("하나님은 언제나 우리와 함께하시고 믿음으로 살아가도록 인도하십니다."),
    ], { keywords: ["하나님", "믿음"] });

    expect(captions.length).toBeGreaterThan(1);
    const text = captions.map(({ text }) => text).join("");
    expect(text).toContain("{\\c&H00FFFF&\\b1}하나님");
    expect(text).toContain("{\\c&H00FFFF&\\b1}믿음");
  });

  it("짧은 자막의 문구와 표시 시각을 유지한다", async () => {
    expect(await renderCaptions([event("열정이 있는 분이 있어요", 1_000, 3_000)]))
      .toEqual([{ start: 1, end: 4, style: "Default", text: "열정이 있는 분이 있어요" }]);
  });
});
