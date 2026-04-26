"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Phone, User, MessageSquare } from "lucide-react";

type Inquiry = {
  id: string;
  name: string;
  phone: string;
  message?: string;
  created_at: string;
};

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadInquiries(); }, []);

  async function loadInquiries() {
    const { data } = await supabase
      .from("chat_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    setInquiries((data ?? []) as Inquiry[]);
    setLoading(false);
  }

  async function deleteInquiry(id: string) {
    if (!confirm("이 문의를 삭제하시겠습니까?")) return;
    await supabase.from("chat_inquiries").delete().eq("id", id);
    loadInquiries();
  }

  if (loading) return <div className="py-12 text-center text-gray-400">로딩 중...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">문의 내역</h1>
        <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
          총 {inquiries.length}건
        </span>
      </div>

      {inquiries.length === 0 ? (
        <div className="py-20 text-center text-gray-400">접수된 문의가 없습니다.</div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <User size={14} className="text-gray-400" />
                      {item.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Phone size={14} className="text-gray-400" />
                      <a href={`tel:${item.phone}`} className="hover:underline">{item.phone}</a>
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {item.message && (
                    <p className="flex items-start gap-1.5 text-sm text-gray-700">
                      <MessageSquare size={14} className="mt-0.5 shrink-0 text-gray-400" />
                      {item.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteInquiry(item.id)}
                  className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
