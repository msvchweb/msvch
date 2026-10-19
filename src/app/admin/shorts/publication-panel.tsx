"use client";
import { useState } from "react";
import type {
  ShortsClip,
  ShortsPublication,
  ShortsPlatform,
} from "@/types/shorts";
import type { ShortsAction } from "./clip-card";
const labels: Record<ShortsPublication["status"], string> = {
  queued: "예약 대기",
  processing: "처리 중",
  retry_wait: "재시도 대기",
  needs_attention: "확인 필요",
  test_uploaded: "비공개 시험 완료",
  published: "게시 완료",
  canceled: "취소됨",
};
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "—";
export function PublicationPanel({
  clip,
  publications,
  onAction,
  checkedAt,
  disabled = false,
}: {
  clip: ShortsClip;
  publications: ShortsPublication[];
  onAction: ShortsAction;
  checkedAt?: string;
  disabled?: boolean;
}) {
  const [when, setWhen] = useState(""),
    [platforms, setPlatforms] = useState<ShortsPlatform[]>(["youtube"]),
    [testOnly, setTestOnly] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const blocked =
    disabled ||
    publications.some(
      (p) =>
        ["processing", "needs_attention"].includes(p.status) ||
        (p.public_request_started && p.status !== "published"),
    );
  const available = (platform: ShortsPlatform) =>
    !publications.some(
      (p) =>
        p.platform === platform &&
        p.content_version === clip.content_version &&
        p.test_only === testOnly &&
        p.status !== "canceled",
    );
  const selected = platforms.filter(available);
  async function act(path: string, body?: unknown, method?: string) {
    setBusy(true);
    setError("");
    try {
      await onAction(path, body, method);
    } catch (e) {
      setError(e instanceof Error ? e.message : "예약 처리 실패");
    } finally {
      setBusy(false);
    }
  }
  function schedule() {
    if (!when || !selected.length) {
      setError("게시 대상과 한국 시간 기준 예약 시각을 입력하세요.");
      return;
    }
    const scheduledAt = new Date(when + ":00+09:00").toISOString();
    void act("/api/shorts/" + clip.id + "/approve", {
      expectedVersion: clip.content_version,
      platforms: selected,
      scheduledAt,
      testOnly,
    });
  }
  return (
    <div className="mt-4 border-t border-gray-100 pt-3 text-xs">
      <p className="font-medium text-gray-700">게시 예약 · 한국 시간(KST)</p>
      <p className="mt-1 text-gray-500">
        15분 간격으로 확인하므로 실제 게시가 늦어질 수 있습니다.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {(["youtube", "instagram"] as const).map((platform) => (
          <label key={platform}>
            <input
              type="checkbox"
              checked={selected.includes(platform)}
              disabled={
                busy ||
                blocked ||
                !available(platform) ||
                (testOnly && platform === "instagram")
              }
              onChange={(e) =>
                setPlatforms((current) =>
                  e.target.checked
                    ? [...current, platform]
                    : current.filter((p) => p !== platform),
                )
              }
            />{" "}
            {platform === "youtube" ? "YouTube" : "Instagram"}
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={testOnly}
            disabled={busy || blocked}
            onChange={(e) => {
              setTestOnly(e.target.checked);
              if (e.target.checked) setPlatforms(["youtube"]);
            }}
          />{" "}
          YouTube 비공개 시험
        </label>
        <label>
          예약 시각{" "}
          <input
            aria-label="예약 시각 KST"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            disabled={busy || blocked}
            className="rounded border p-1"
          />
        </label>
        <button
          disabled={
            busy ||
            blocked ||
            !selected.length ||
            clip.transcript_status !== "verified" ||
            !clip.media_check?.valid
          }
          onClick={schedule}
          className="rounded bg-primary-50 px-3 py-2 text-primary-700 disabled:opacity-50"
        >
          승인·게시 예약
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {publications.map((p) => (
          <div key={p.id} className="rounded bg-gray-50 p-2">
            <span>
              {p.platform === "youtube" ? "YouTube" : "Instagram"}
              {p.test_only ? " · 비공개 시험" : ""} · {labels[p.status]} · 예약{" "}
              {time(p.scheduled_at)}
            </span>
            {p.status === "queued" &&
              checkedAt &&
              Date.parse(checkedAt) > Date.parse(p.scheduled_at) && (
                <span> · 예약 시각 경과, 다음 점검 대기</span>
              )}
            {p.published_at && <span> · 실제 게시 {time(p.published_at)}</span>}
            {p.next_attempt_at && (
              <span> · 다음 점검 {time(p.next_attempt_at)}</span>
            )}
            {p.error_code && (
              <p className="text-amber-700">
                {["credentials_expired", "credentials_missing"].includes(
                  p.error_code,
                )
                  ? "계정 재연결 필요"
                  : p.error_code}
              </p>
            )}
            {p.provider_url?.startsWith("https://") && (
              <a
                href={p.provider_url}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-primary-600"
              >
                영상 보기
              </a>
            )}
            {p.public_request_started && p.status === "retry_wait" && (
              <p className="text-amber-700">
                게시 결과 확인 중 · 확인 전 수정·취소 불가
              </p>
            )}
            {["queued", "retry_wait"].includes(p.status) &&
              !p.public_request_started && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "/api/shorts/publications/" + p.id,
                      undefined,
                      "DELETE",
                    )
                  }
                  className="ml-2 text-red-600"
                >
                  예약 취소
                </button>
              )}
            {["retry_wait", "needs_attention"].includes(p.status) && (
              <button
                disabled={busy}
                onClick={() =>
                  void act("/api/shorts/publications/" + p.id + "/retry")
                }
                className="ml-2 text-primary-600"
              >
                다시 확인·재시도
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
