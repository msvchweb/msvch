"use client";
import { useEffect, useState } from "react";
import type { ShortsSettings } from "@/types/shorts";
type Connection = {
  platform: string;
  account_id: string;
  status: string;
  expires_at: string | null;
};
export function SettingsPanel() {
  const [settings, setSettings] = useState<ShortsSettings | null>(null),
    [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shorts/settings", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("운영 설정을 불러오지 못했습니다.");
        return r.json();
      })
      .then((data) => {
        setSettings(data.settings);
        setConnections(data.connections);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function save() {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/shorts/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishing_enabled: settings.publishing_enabled,
          auto_generate_enabled: settings.auto_generate_enabled,
          bgm_enabled: settings.bgm_enabled,
          source_playlist_id: settings.source_playlist_id || null,
          allowed_categories: settings.allowed_categories,
          daily_publish_limit: settings.daily_publish_limit,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "설정 저장 실패");
      setSettings(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-800">
        자동화 운영 설정·계정 연결
      </summary>
      {settings && (
        <div className="mt-3 space-y-3 text-sm">
          <label className="block">
            <input
              type="checkbox"
              checked={settings.publishing_enabled}
              disabled={busy}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  publishing_enabled: e.target.checked,
                })
              }
            />{" "}
            승인된 영상 자동 게시
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={settings.auto_generate_enabled}
              disabled={busy}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  auto_generate_enabled: e.target.checked,
                })
              }
            />{" "}
            새 설교 자동 제작
          </label>
          <label className="block">
            설교 전용 재생목록 ID{" "}
            <input
              disabled={busy}
              value={settings.source_playlist_id ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, source_playlist_id: e.target.value })
              }
              className="ml-2 rounded border p-1"
            />
          </label>
          <p className="text-xs text-gray-500">
            자동 제작은 활성화 이후에 공개된 설교 전용 재생목록 영상에
            적용됩니다. 예배 전체 영상이 없는 목록을 사용하세요.
          </p>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1">허용 설교 분류</legend>
            {Object.entries({
              sunday: "주일",
              wednesday: "수요",
              friday: "금요",
              dawn: "새벽",
            }).map(([v, l]) => (
              <label key={v}>
                <input
                  type="checkbox"
                  checked={settings.allowed_categories.includes(v)}
                  disabled={busy}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      allowed_categories: e.target.checked
                        ? [...settings.allowed_categories, v]
                        : settings.allowed_categories.filter((c) => c !== v),
                    })
                  }
                />{" "}
                {l}
              </label>
            ))}
          </fieldset>
          <label className="block">
            하루 게시 상한(플랫폼별){" "}
            <input
              type="number"
              min={1}
              max={20}
              value={settings.daily_publish_limit}
              disabled={busy}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  daily_publish_limit: Number(e.target.value),
                })
              }
              className="ml-2 w-20 rounded border p-1"
            />
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={settings.bgm_enabled}
              disabled={busy}
              onChange={(e) =>
                setSettings({ ...settings, bgm_enabled: e.target.checked })
              }
            />{" "}
            배경음 사용(이용 권한 확인 후)
          </label>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-primary-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {busy ? "저장 중…" : "운영 설정 저장"}
          </button>
          <div className="border-t pt-2">
            {connections.length ? (
              connections.map((c) => (
                <p key={c.platform}>
                  {c.platform}:{" "}
                  {c.status === "connected" ? "연결됨" : "재연결 필요"} ·{" "}
                  {c.account_id}
                  {c.expires_at
                    ? " · 만료 " +
                      new Date(c.expires_at).toLocaleDateString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })
                    : ""}
                </p>
              ))
            ) : (
              <p>
                연결된 게시 계정이 없습니다. 운영 담당자가 계정 연결을 진행해야
                합니다.
              </p>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </details>
  );
}
