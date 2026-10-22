"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { AI_COURSE_PATH, LEARNING_GOALS, choiceLabel } from "@/lib/ai-course";
import type { AiCourseApplicationDetail, AiCourseApplicationList } from "@/types/ai-course";
import ApplicationDetails from "@/components/ai-course/ApplicationDetails";

type LoadState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };
const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40";
function ApplicationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<LoadState<AiCourseApplicationDetail>>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/admin/ai-course-applications/${id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("detail failed");
        const data = await response.json();
        if (current) setState({ status: "ready", data });
      } catch { if (current) setState({ status: "error" }); }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [id, retry]);
  return <section aria-label="신청 상세" aria-busy={state.status === "loading"} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
    <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">신청 상세</h2><button type="button" aria-label="상세 닫기" onClick={onClose} className="rounded-lg p-3 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div>
    {state.status === "loading" && <p role="status" className="py-8 text-sm text-gray-500">신청 내용을 불러오는 중입니다.</p>}
    {state.status === "error" && <div role="alert"><p className="mb-3 text-sm text-red-700">상세 조회에 실패했습니다.</p><button className={buttonClass} onClick={() => setRetry((value) => value + 1)}>상세 다시 조회</button></div>}
    {state.status === "ready" && <><ApplicationDetails application={state.data} /><div className="mt-5 border-t border-gray-100 pt-5 text-xs leading-7 text-gray-500"><p>접수 시각: {dateTime(state.data.createdAt)} (한국 시각)</p><p>개인정보 동의 시각: {dateTime(state.data.privacyConsentedAt)}</p><p>설문 버전: {state.data.surveyVersion}</p><p>동의 문안 버전: {state.data.privacyPolicyVersion}</p></div></>}
  </section>;
}
export default function AiCourseApplicationsPage() {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<LoadState<AiCourseApplicationList>>({ status: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      setState({ status: "loading" });
      try {
        const response = await fetch(`/api/admin/ai-course-applications?page=${page}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("list failed");
        const data = await response.json();
        if (current) setState({ status: "ready", data });
      } catch { if (current) setState({ status: "error" }); }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, [page, retry]);
  function goToPage(next: number) { setSelected(null); setPage(next); }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-gray-900">AI 강의 신청</h1><p className="mt-2 text-sm text-gray-500">신청 정보와 현재 활용 경험, 수강 목표를 확인합니다.</p></div><a href={AI_COURSE_PATH} target="_blank" rel="noreferrer" className={buttonClass}>홍보페이지 <ExternalLink size={14} /></a></div>
    <div className={`grid items-start gap-6 ${selected ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}`}>
      <section aria-label="신청 목록" aria-busy={state.status === "loading"} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-5"><h2 className="font-semibold">{state.status === "ready" ? `접수 ${state.data.total}건` : "신청 목록"}</h2><button className="text-sm text-primary-700 disabled:opacity-40" disabled={state.status === "loading"} onClick={() => { setSelected(null); setRetry((value) => value + 1); }}>새로고침</button></div>
        {state.status === "loading" && <p role="status" className="p-8 text-center text-sm text-gray-500">신청 목록을 불러오는 중입니다.</p>}
        {state.status === "error" && <div role="alert" className="p-8 text-center"><p className="mb-4 text-sm text-red-700">조회에 실패했습니다.</p><button className={buttonClass} onClick={() => setRetry((value) => value + 1)}>다시 조회</button></div>}
        {state.status === "ready" && <>
          {!state.data.items.length ? <p className="p-10 text-center text-sm text-gray-500">{state.data.total === 0 ? "접수된 신청이 없습니다." : "이 페이지에 신청이 없습니다."}</p> : <ul className="divide-y divide-gray-100">{state.data.items.map((item) => <li key={item.id}><button type="button" aria-label={`신청 보기: ${item.name}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`w-full p-5 text-left transition-colors hover:bg-gray-50 ${selected === item.id ? "bg-primary-50" : ""}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-gray-900">{item.name}</span><span className="text-xs text-gray-500">{dateTime(item.createdAt)}</span></div><p className="mt-1 text-sm text-gray-600">{item.phone}</p><div className="mt-3 flex flex-wrap gap-2">{item.learningGoals.map((goal) => <span key={goal} className="rounded-md bg-gray-100 px-2 py-1 text-xs leading-5 text-gray-600">{choiceLabel(LEARNING_GOALS, goal)}</span>)}</div></button></li>)}</ul>}
          <nav aria-label="신청 목록 페이지" className="flex items-center justify-between gap-2 border-t border-gray-100 p-4"><button className={buttonClass} disabled={page === 1} onClick={() => goToPage(page - 1)}><ArrowLeft size={14} />이전</button><span className="text-sm text-gray-500">{page} / {Math.max(1, Math.ceil(state.data.total / 25))}</span><button className={buttonClass} disabled={page * 25 >= state.data.total} onClick={() => goToPage(page + 1)}>다음<ArrowRight size={14} /></button></nav>
        </>}
      </section>
      {selected && <ApplicationDetail key={selected} id={selected} onClose={() => setSelected(null)} />}
    </div>
  </div>;
}
