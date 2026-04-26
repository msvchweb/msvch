"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Loader2, Bell, BellOff } from "lucide-react";
import type { EventSubscriber } from "@/types/subscribers";

export default function AdminEventSubscribersPage() {
  const [subscribers, setSubscribers] = useState<EventSubscriber[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyD1, setNotifyD1] = useState<boolean>(true);
  const [notifyDDay, setNotifyDDay] = useState<boolean>(false);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/event-subscribers", {
      credentials: "same-origin",
    });
    if (res.ok) {
      const data = (await res.json()) as EventSubscriber[];
      setSubscribers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/event-subscribers", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<EventSubscriber[]>) : null))
      .then((data) => {
        if (!cancelled && data) setSubscribers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setName("");
    setPhone("");
    setNotifyD1(true);
    setNotifyDDay(false);
    setNote("");
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert("이름과 전화번호는 필수입니다.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/event-subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim(),
        notifyD1,
        notifyDDay,
        note: note.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "등록 실패");
    } else {
      resetForm();
      await load();
    }
    setSubmitting(false);
  }

  async function toggleField(
    sub: EventSubscriber,
    field: "isActive" | "notifyD1" | "notifyDDay",
    value: boolean,
  ) {
    const res = await fetch(`/api/admin/event-subscribers/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) await load();
    else alert("변경 실패");
  }

  async function handleDelete(sub: EventSubscriber) {
    if (!confirm(`"${sub.name}" 구독자를 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/event-subscribers/${sub.id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else alert("삭제 실패");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        로딩 중...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            일정 알림 구독자
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            일정 알림톡을 받을 수신자 명단을 관리합니다 (관리자 직접 입력).
          </p>
        </div>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "구독자 추가"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                이름 *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                전화번호 *
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="010-1234-5678"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                010-XXXX-XXXX 형식 (다양한 입력 자동 정규화)
              </p>
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notifyD1}
                  onChange={(e) => setNotifyD1(e.target.checked)}
                />
                하루 전 알림 (D-1)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notifyDDay}
                  onChange={(e) => setNotifyDDay(e.target.checked)}
                />
                당일 알림 (D-day)
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                메모
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="예: 임원, 청년부장 등"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            등록
          </button>
        </form>
      )}

      {subscribers.length === 0 ? (
        <p className="py-12 text-center text-gray-400">
          아직 등록된 구독자가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">전화번호</th>
                <th className="px-4 py-3">활성</th>
                <th className="px-4 py-3">D-1</th>
                <th className="px-4 py-3">D-day</th>
                <th className="px-4 py-3">메모</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {sub.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    <a href={`tel:${sub.phone}`} className="hover:underline">
                      {sub.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleField(sub, "isActive", !sub.isActive)
                      }
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        sub.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {sub.isActive ? "활성" : "비활성"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleField(sub, "notifyD1", !sub.notifyD1)
                      }
                      title="하루 전 알림"
                      className="text-gray-500 hover:text-primary-600"
                    >
                      {sub.notifyD1 ? (
                        <Bell size={14} className="text-primary-600" />
                      ) : (
                        <BellOff size={14} className="text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleField(sub, "notifyDDay", !sub.notifyDDay)
                      }
                      title="당일 알림"
                      className="text-gray-500 hover:text-primary-600"
                    >
                      {sub.notifyDDay ? (
                        <Bell size={14} className="text-primary-600" />
                      ) : (
                        <BellOff size={14} className="text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {sub.note ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(sub)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
