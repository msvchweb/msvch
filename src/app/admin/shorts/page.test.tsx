import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClipCard } from "./clip-card";
import type { ShortsClip, ShortsPublication } from "@/types/shorts";
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
function publicationFixture(
  patch: Partial<ShortsPublication>,
): ShortsPublication {
  return {
    id: "p",
    clip_id: "clip",
    platform: "youtube",
    content_version: 1,
    test_only: false,
    status: "published",
    scheduled_at: "2026-10-19T00:00:00Z",
    next_attempt_at: null,
    attempt_count: 0,
    public_request_started: false,
    quota_date: "2026-10-19",
    lease_token: null,
    lease_expires_at: null,
    worker_run_id: null,
    provider_id: "video",
    provider_url: "https://www.youtube.com/watch?v=video",
    published_at: "2026-10-19T00:01:00Z",
    error_code: null,
    error_message: null,
    created_at: "2026-10-19T00:00:00Z",
    updated_at: "2026-10-19T00:01:00Z",
    ...patch,
  };
}
it("keeps published content locked while allowing the approved version's second platform", async () => {
  const clip = clipFixture({
    transcript_status: "verified",
    media_check: { valid: true, warnings: [] },
    review_status: "approved",
    approved_version: 1,
    published_at: "2026-10-19T00:01:00Z",
  });
  const action = vi.fn().mockResolvedValue(undefined);
  render(
    <ClipCard
      clip={clip}
      videoId="abcdefghijk"
      onAction={action}
      publications={[publicationFixture({})]}
    />,
  );
  expect(screen.getByRole("button", { name: "제목·캡션 수정" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "반려" })).toBeDisabled();
  expect(screen.getByLabelText("YouTube", { exact: true })).toBeDisabled();
  expect(screen.getByLabelText("Instagram")).not.toBeDisabled();
  fireEvent.click(screen.getByLabelText("Instagram"));
  fireEvent.change(screen.getByLabelText("예약 시각 KST"), {
    target: { value: "2026-10-20T09:30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "승인·게시 예약" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith(
      "/api/shorts/clip/approve",
      {
        expectedVersion: 1,
        platforms: ["instagram"],
        scheduledAt: "2026-10-20T00:30:00.000Z",
        testOnly: false,
      },
      undefined,
    ),
  );
});
it("locks editing and cancellation while a public request is awaiting confirmation", () => {
  const publication = {
    ...publicationFixture({ status: "retry_wait", published_at: null }),
    public_request_started: true,
  };
  render(
    <ClipCard
      clip={clipFixture({ review_status: "approved" })}
      videoId="abcdefghijk"
      onAction={vi.fn()}
      publications={[publication]}
    />,
  );
  expect(screen.getByRole("button", { name: "제목·캡션 수정" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "예약 취소" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "승인·게시 예약" })).toBeDisabled();
});
