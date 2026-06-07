"use client";

import { useEffect, useState } from "react";
import { Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  type NewFamilyRegistration,
  type NewFamilyStatus,
  VISIT_PATH_LABELS,
  FAITH_STATUS_LABELS,
  GENDER_LABELS,
  CHURCH_HISTORY_LABELS,
  STATUS_LABELS,
} from "@/types/new-family";

const STATUS_KEYS: NewFamilyStatus[] = ["new", "contacted", "assigned", "done"];

const STATUS_BADGE: Record<NewFamilyStatus, string> = {
  new: "bg-rose-50 text-rose-700",
  contacted: "bg-amber-50 text-amber-700",
  assigned: "bg-blue-50 text-blue-700",
  done: "bg-gray-100 text-gray-600",
};

export default function AdminNewFamiliesPage() {
  const [items, setItems] = useState<NewFamilyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NewFamilyStatus | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/new-families", { credentials: "same-origin" })
      .then((r) =>
        r.ok ? (r.json() as Promise<NewFamilyRegistration[]>) : null,
      )
      .then((data) => {
        if (!cancelled && data) setItems(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function changeStatus(id: string, status: NewFamilyStatus) {
    const res = await fetch(`/api/admin/new-families/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      alert("상태 변경 실패");
      return;
    }
    const updated = (await res.json()) as NewFamilyRegistration;
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  async function saveNote(id: string, note: string) {
    const res = await fetch(`/api/admin/new-families/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: note }),
    });
    if (!res.ok) {
      alert("메모 저장 실패");
      return;
    }
    const updated = (await res.json()) as NewFamilyRegistration;
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  async function remove(id: string) {
    if (!confirm("이 등록 정보를 삭제하시겠습니까? 복구할 수 없습니다.")) return;
    const res = await fetch(`/api/admin/new-families/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const filtered = items.filter((i) => filter === "all" || i.status === filter);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  const counts: Record<NewFamilyStatus | "all", number> = {
    all: items.length,
    new: items.filter((i) => i.status === "new").length,
    contacted: items.filter((i) => i.status === "contacted").length,
    assigned: items.filter((i) => i.status === "assigned").length,
    done: items.filter((i) => i.status === "done").length,
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            새가족 등록
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            공개 새가족 등록 폼으로 접수된 신청 내역을 관리합니다.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterPill
          label={`전체 ${counts.all}`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {STATUS_KEYS.map((s) => (
          <FilterPill
            key={s}
            label={`${STATUS_LABELS[s]} ${counts[s]}`}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-20 text-center text-gray-400">
          {filter === "all"
            ? "접수된 새가족 등록이 없습니다."
            : "해당 상태의 등록이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Row
              key={item.id}
              item={item}
              expanded={expanded.has(item.id)}
              onToggle={() => toggle(item.id)}
              onStatusChange={(s) => changeStatus(item.id, s)}
              onSaveNote={(n) => saveNote(item.id, n)}
              onDelete={() => remove(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-primary-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function Row({
  item,
  expanded,
  onToggle,
  onStatusChange,
  onSaveNote,
  onDelete,
}: {
  item: NewFamilyRegistration;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: NewFamilyStatus) => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = note !== (item.adminNote ?? "");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_BADGE[item.status]
            }`}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <span className="font-medium text-gray-900">{item.name}</span>
          <span className="text-sm text-gray-500">
            {GENDER_LABELS[item.gender]} · {item.ageGroup ?? item.birth ?? "—"}
          </span>
          <span className="ml-auto hidden text-xs text-gray-400 sm:inline">
            {new Date(item.createdAt).toLocaleString("ko-KR")}
          </span>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-gray-100 bg-gray-50/50 px-4 py-4 sm:px-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="연락처">
              {item.phone ? (
                <a href={`tel:${item.phone}`} className="text-primary-600 hover:underline">
                  {item.phone}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field label="인스타그램">
              {item.instagramId ? (
                <span className="text-pink-600">{item.instagramId}</span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="연령대/생일">{item.ageGroup ?? item.birth ?? "—"}</Field>
            <Field label="거주 지역">{item.region ?? "—"}</Field>
            <Field label="예수님 영접 여부">
              {item.faithStatus ? FAITH_STATUS_LABELS[item.faithStatus] : "—"}
            </Field>
            <Field label="신앙생활 여부">
              {item.churchHistory === "etc"
                ? `기타 — ${item.churchHistoryEtc ?? ""}`
                : item.churchHistory
                ? CHURCH_HISTORY_LABELS[item.churchHistory]
                : "—"}
            </Field>
            <Field label="방문 경로" full>
              <div className="space-y-0.5">
                {item.visitPaths.length > 0 ? (
                  item.visitPaths.map((p) => (
                    <div key={p}>
                      {p === "etc"
                        ? `기타 — ${item.visitPathsEtc ?? ""}`
                        : VISIT_PATH_LABELS[p]}
                    </div>
                  ))
                ) : (
                  "—"
                )}
              </div>
            </Field>
            <Field label="동의 시각">
              {new Date(item.privacyConsentedAt).toLocaleString("ko-KR")}
            </Field>
          </div>

          {item.message && (
            <Field label="작성자 메시지" full>
              <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {item.message}
              </p>
            </Field>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              상태 변경
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_KEYS.map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    item.status === s
                      ? "bg-primary-600 text-white"
                      : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              관리자 메모
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="처리 내용, 배정 교구 등 메모"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                삭제
              </button>
              <button
                onClick={async () => {
                  setSaving(true);
                  await onSaveNote(note);
                  setSaving(false);
                }}
                disabled={!dirty || saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                메모 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
