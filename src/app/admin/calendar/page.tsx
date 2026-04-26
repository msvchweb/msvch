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
  Edit3,
  Bell,
  BellOff,
} from "lucide-react";
import type { CalendarEvent } from "@/types/calendar";
import { createClient } from "@/lib/supabase/client";
import { fetchAuthorRecordMap, type ContentAuthor } from "@/lib/content-authors";
import { useMe, canDelete } from "@/lib/use-me";

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
  if (!event.end) return `${date} ${startTime}~`;
  const e = new Date(event.end);
  const endTime = e.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  return `${date} ${startTime} ~ ${endTime}`;
}

function eventDateKey(event: CalendarEvent): string {
  return event.isAllDay ? event.start : event.start.split("T")[0];
}

function eventStartTime(event: CalendarEvent): string {
  if (event.isAllDay) return "";
  const d = new Date(event.start);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function eventEndTime(event: CalendarEvent): string {
  if (event.isAllDay || !event.end) return "";
  const d = new Date(event.end);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

export default function AdminCalendarPage() {
  const me = useMe();
  const supabase = createClient();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [authorMap, setAuthorMap] = useState<Record<string, ContentAuthor>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState<boolean>(false);
  const [notify, setNotify] = useState<boolean>(false);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEvents() {
    const res = await fetch("/api/calendar?limit=100&days=120");
    const data = (await res.json()) as CalendarEvent[];
    setEvents(data);
    const map = await fetchAuthorRecordMap(
      supabase,
      "event",
      data.map((e) => e.id),
    );
    setAuthorMap(map);
    setLoading(false);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocation("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setIsAllDay(false);
    setNotify(false);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(event: CalendarEvent) {
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description ?? "");
    setLocation(event.location ?? "");
    setDate(eventDateKey(event));
    setIsAllDay(event.isAllDay);
    setStartTime(eventStartTime(event));
    setEndTime(eventEndTime(event));
    setNotify(event.notify);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert("제목과 날짜는 필수입니다.");
      return;
    }
    if (!isAllDay && !startTime) {
      alert("시작 시간을 입력하거나 '종일'을 체크하세요.");
      return;
    }
    setSubmitting(true);
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      date,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay || !endTime ? undefined : endTime,
      notify,
    };

    const res = editingId
      ? await fetch(`/api/calendar/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "일정 저장에 실패했습니다.");
    } else {
      resetForm();
      await loadEvents();
    }
    setSubmitting(false);
  }

  async function handleDelete(eventId: string, eventTitle: string) {
    if (!confirm(`"${eventTitle}" 일정을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/calendar/${eventId}`, { method: "DELETE" });
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
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            교회 일정 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            자체 캘린더 (알림톡 발송 대상은 별도 체크)
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "취소" : "일정 추가"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
        >
          <p className="mb-3 text-sm font-medium text-gray-700">
            {editingId ? "일정 수정" : "새 일정"}
          </p>
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
                날짜 *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => {
                    setIsAllDay(e.target.checked);
                    if (e.target.checked) {
                      setStartTime("");
                      setEndTime("");
                    }
                  }}
                  className="rounded border-gray-300"
                />
                종일 일정
              </label>
            </div>

            {!isAllDay && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    시작 시간 *
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
                    종료 시간 (선택)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="비워두면 미정"
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

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="flex items-center gap-1">
                  {notify ? <Bell size={14} className="text-primary-600" /> : <BellOff size={14} className="text-gray-400" />}
                  알림톡 발송 대상
                </span>
              </label>
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
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {editingId ? "수정 저장" : "일정 추가"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{event.title}</p>
                {event.notify && (
                  <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                    <Bell size={10} />
                    알림톡
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  {event.isAllDay ? <Calendar size={13} /> : <Clock size={13} />}
                  {formatEventDate(event)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {event.location}
                  </span>
                )}
                {authorMap[event.id]?.name && (
                  <span className="text-xs text-gray-300">
                    · 작성: {authorMap[event.id]?.name}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                  {event.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => startEdit(event)}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                <Edit3 size={13} />
                수정
              </button>
              {canDelete(me, authorMap[event.id]?.id) && (
                <button
                  onClick={() => handleDelete(event.id, event.title)}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
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
