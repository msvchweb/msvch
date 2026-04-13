"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  X,
  Loader2,
} from "lucide-react";
import type { CalendarEvent } from "@/types/calendar";

function formatEventDate(event: CalendarEvent): string {
  if (event.isAllDay) {
    const [, m, d] = event.start.split("-").map(Number);
    return `${m}월 ${d}일 (종일)`;
  }
  const s = new Date(event.start);
  const date = s.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const startTime = s.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  const e = new Date(event.end);
  const endTime = e.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  return `${date} ${startTime} ~ ${endTime}`;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const res = await fetch("/api/calendar?limit=50&days=120");
    const data = (await res.json()) as CalendarEvent[];
    setEvents(data);
    setLoading(false);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setIsAllDay(true);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate) {
      alert("제목과 시작일은 필수입니다.");
      return;
    }

    const finalEndDate = endDate || startDate;

    if (!isAllDay && (!startTime || !endTime)) {
      alert("시간 지정 이벤트는 시작/종료 시간이 필요합니다.");
      return;
    }

    setSubmitting(true);

    const body: Record<string, string | undefined> = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startDate,
      endDate: isAllDay ? addOneDay(finalEndDate) : finalEndDate,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
    };

    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "일정 생성에 실패했습니다.");
    } else {
      resetForm();
      await loadEvents();
    }
    setSubmitting(false);
  }

  async function handleDelete(eventId: string, eventTitle: string) {
    if (!confirm(`"${eventTitle}" 일정을 삭제하시겠습니까?`)) return;

    const res = await fetch(`/api/calendar/${eventId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("일정 삭제에 실패했습니다.");
    } else {
      await loadEvents();
    }
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            교회 일정 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Google Calendar에 일정을 추가하거나 삭제합니다
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "일정 추가"}
        </button>
      </div>

      {/* 생성 폼 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                제목 *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder="예: 부활절 특별예배"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                시작일 *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate) setEndDate(e.target.value);
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-gray-300"
                />
                종일 이벤트
              </label>
            </div>

            {!isAllDay && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required={!isAllDay}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required={!isAllDay}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                장소
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="예: 본당"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="일정에 대한 설명을 입력하세요"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting && (
              <Loader2 size={14} className="animate-spin" />
            )}
            일정 추가
          </button>
        </form>
      )}

      {/* 이벤트 목록 */}
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4"
          >
            <div>
              <p className="font-medium text-gray-900">{event.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  {event.isAllDay ? (
                    <Calendar size={13} />
                  ) : (
                    <Clock size={13} />
                  )}
                  {formatEventDate(event)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {event.location}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="mt-1 line-clamp-1 text-sm text-gray-400">
                  {event.description}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDelete(event.id, event.title)}
              className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {events.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <Calendar size={40} className="mx-auto text-gray-300" />
            <p className="mt-3">등록된 일정이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 종일 이벤트의 endDate는 Google Calendar에서 exclusive이므로 +1일 */
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
