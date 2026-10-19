import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClipCard } from "./clip-card";
import type { ShortsClip } from "@/types/shorts";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function clipFixture(patch: Partial<ShortsClip>): ShortsClip {
  return {
    id: "clip",
    job_id: "job",
    clip_index: 0,
    start_sec: 70,
    end_sec: 100,
    duration_sec: 30,
    title: "제목",
    hook: null,
    transcript: null,
    caption_yt: null,
    caption_ig: null,
    video_url: null,
    review_status: "pending",
    reviewer_note: null,
    youtube_video_id: null,
    published_at: null,
    created_at: "2026-10-19T00:00:00Z",
    attempt_id: null,
    selection_reason: null,
    title_yt: null,
    transcript_status: "unverified",
    rendered_duration_sec: null,
    selection_data: null,
    media_check: null,
    content_version: 1,
    approved_version: null,
    reject_category: null,
    ...patch,
  };
}
it("labels legacy reasons separately from unverified speech and displays mutation failures", async () => {
  const clip = clipFixture({
    id: "clip",
    job_id: "job",
    clip_index: 0,
    start_sec: 70,
    end_sec: 100,
    duration_sec: 30,
    title: "제목",
    transcript: "선정 이유",
    selection_reason: "선정 이유",
    transcript_status: "unverified",
    review_status: "pending",
    content_version: 1,
    video_url: null,
  });
  const action = vi.fn().mockRejectedValue(new Error("권한이 없습니다"));
  render(<ClipCard clip={clip} videoId="abcdefghijk" onAction={action} />);
  expect(screen.getByText("자막 미확인")).toBeInTheDocument();
  expect(screen.getByText(/선정 이유: 선정 이유/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "승인" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("권한이 없습니다"),
  );
});
it("submits the current approval version with an explicit KST-to-UTC reservation", async () => {
  const clip = clipFixture({
    id: "c",
    job_id: "j",
    clip_index: 0,
    start_sec: 180,
    end_sec: 210,
    duration_sec: 30,
    title: "제목",
    transcript_status: "verified",
    media_check: { valid: true, warnings: [] },
    review_status: "pending",
    content_version: 3,
  });
  const action = vi.fn().mockResolvedValue(undefined);
  render(<ClipCard clip={clip} videoId="abcdefghijk" onAction={action} />);
  fireEvent.change(screen.getByLabelText("예약 시각 KST"), {
    target: { value: "2026-10-20T09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "승인·게시 예약" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith(
      "/api/shorts/c/approve",
      {
        expectedVersion: 3,
        platforms: ["youtube"],
        scheduledAt: "2026-10-20T00:30:00.000Z",
        testOnly: false,
      },
      undefined,
    ),
  );
});
