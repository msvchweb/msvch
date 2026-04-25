"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/supabase";

const ROLE_OPTIONS: Profile["role"][] = ["member", "staff", "admin", "master"];

export function MemberRoleEditor({
  id,
  currentRole,
  isSelf,
}: {
  id: string;
  currentRole: Profile["role"];
  isSelf: boolean;
}) {
  const [role, setRole] = useState<Profile["role"]>(currentRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  if (isSelf) {
    return <span className="text-xs text-gray-400">본인 (변경 불가)</span>;
  }

  async function save() {
    if (role === currentRole) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "변경 실패");
      setRole(currentRole);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
  }

  const dirty = role !== currentRole;

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Profile["role"])}
        disabled={saving}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
      >
        {saving ? "저장중" : "저장"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
