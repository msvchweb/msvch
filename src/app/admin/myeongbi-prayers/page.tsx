"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Phone, Users } from "lucide-react";
import type { MyeongbiPrayerApplication } from "@/types/myeongbi-prayer";

export default function AdminMyeongbiPrayersPage() {
  const [items, setItems] = useState<MyeongbiPrayerApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/myeongbi-prayers", { credentials: "same-origin" })
      .then((r) =>
        r.ok ? (r.json() as Promise<MyeongbiPrayerApplication[]>) : null,
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 size={20} className="mr-2 animate-spin" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            명비 기도인 신청
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            공개 모집 페이지에서 접수된 명비 기도인 신청 내역입니다.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
          <span className="text-gray-500">전체 신청</span>
          <span className="ml-2 font-bold text-primary-700">{items.length}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white py-20 text-center text-gray-400">
          접수된 신청이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {item.name}
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Users size={13} aria-hidden />
                  참여 가능
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Info icon={Phone} label="연락처">
                  <a
                    href={`tel:${item.phone}`}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {item.phone}
                  </a>
                </Info>
                <Info icon={Users} label="소속">
                  {item.affiliation}
                </Info>
              </div>

              {item.message && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <MessageCircle size={14} aria-hidden />
                    남기고 싶은 말
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {item.message}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
        <Icon size={14} aria-hidden />
        {label}
      </div>
      <div className="text-gray-800">{children}</div>
    </div>
  );
}
