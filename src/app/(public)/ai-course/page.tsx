import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight, Check, ChevronDown } from "lucide-react";
import { AI_COURSE_URL } from "@/lib/ai-course";
import { createAiCourseQrDataUrl } from "@/lib/ai-course-qr";
import AiCourseForm from "./AiCourseForm";
import { getAiCoursePrivacyPolicy } from "./privacy-policy";
import { AiCourseMotionProvider, AiCourseMotionControls } from "@/components/ai-course/motion/AiCourseMotionProvider";
import AiCourseWorkbench from "@/components/ai-course/motion/AiCourseWorkbench";
import AiCourseExamples from "@/components/ai-course/AiCourseExamples";
import AiCourseRoadmap from "@/components/ai-course/motion/AiCourseRoadmap";
import motionStyles from "@/components/ai-course/motion/ai-course-motion.module.css";

const title = "AI로 내 일을 끝내는 12주";
const description = "수업 자료 정리, 발표 준비, 나만의 앱까지. AI 활용을 주 1회 60분씩 12주 동안 함께 익힙니다.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: AI_COURSE_URL },
  openGraph: { title: title + " | 명성비전교회", description, url: AI_COURSE_URL, type: "website" },
};
const stages = [
  { weeks: "1–2주", title: "AI와 친해지기", text: "원하는 일을 설명하고, 답을 확인하는 방법부터." },
  { weeks: "3–8주", title: "공부와 생활에 활용하기", text: "자료 정리부터 자주 하는 일 줄이기까지." },
  { weeks: "9–12주", title: "나만의 앱 만들기", text: "내 내용으로 만들고, 공개하고, 직접 고쳐봐요." },
];
const curriculum = [
  ["01–02주", "자료에서 결과물까지", "기본 요청과 결과 확인 · 프로젝트와 지침"],
  ["03–04주", "내 자료와 다른 앱 연결하기", "파일 다루기 · 클라우드와 로컬 · 플러그인·외부 앱"],
  ["05–06주", "자주 하는 일을 더 간단하게", "반복 작업을 스킬로 만들기 · 예약과 실행 결과 확인"],
  ["07–08주", "내 공부와 생활에 연결하기", "휴대폰에서 작업 이어가기 · 나에게 필요한 작업 실습"],
  ["09–10주", "나만의 앱 공개하기", "GitHub·Vercel 가입과 연동 · 앱 제작과 공개"],
  ["11–12주", "필요할 때 직접 고쳐 쓰기", "작은 기능 추가 · 수정과 다시 공개하기 · 되돌리기"],
];
const faq = [
  ["코딩을 몰라도 괜찮나요?", "코딩 경험을 전제로 하지 않아요. 원하는 것을 설명하고 결과를 확인하는 방법부터 함께 익혀요."],
  ["AI를 많이 써봤어야 하나요?", "AI에게 질문해 본 정도부터 시작해요. 파일 저장과 폴더 찾기 같은 노트북의 기본 조작은 필요해요."],
  ["무엇을 준비하면 되나요?", "개인 노트북과 충전기가 필요해요. 스마트폰도 일부 실습에서 함께 써요. 연습 자료는 수업에서 제공하니 개인정보나 비공개 자료를 준비할 필요는 없어요."],
  ["어떤 앱을 만드나요?", "자기소개, 동아리·모임 활동, 작업물 소개처럼 작은 앱으로 시작해요. 공통 틀을 내 내용으로 바꾸고 직접 고쳐봐요."],
];
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm font-semibold text-primary-700">{children}</p>;
}
export default async function AiCoursePage() {
  const qr = await createAiCourseQrDataUrl();
  const privacyPolicy = getAiCoursePrivacyPolicy();
  const preview = process.env.AI_COURSE_PREVIEW === "1";
  return <AiCourseMotionProvider><div id="course" className="bg-church-cream text-church-dark">
    {preview && <p className="bg-amber-50 px-5 py-3 text-center text-sm font-medium text-amber-900">미리보기 · 아직 운영에는 반영되지 않았어요.</p>}
    <section className={motionStyles.hero}>
      <div aria-hidden="true" className={motionStyles.heroGlow} /><div aria-hidden="true" className={motionStyles.heroRings} />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs tracking-wide text-church-gold-light"><span className="h-1.5 w-1.5 rounded-full bg-church-gold" />명성비전교회 · AI 활용 과정</p>
          <h1 className="break-keep text-4xl font-bold leading-[1.3] tracking-tight sm:text-5xl"><span className={motionStyles.headlineLine}>아직도 AI에게</span><span className={motionStyles.headlineLine}>질문만 하세요?</span><span className={motionStyles.headlineLine + " text-church-gold"}>이제, 내 일을</span><span className={motionStyles.headlineLine + " text-church-gold"}>시키세요.</span></h1>
          <p className="mt-7 max-w-md break-keep text-base leading-8 text-slate-200">수업 자료 정리, 발표 준비, 나만의 앱까지.<br />AI 활용을 12주 동안 함께 익혀요.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-slate-200"><span className="rounded-lg bg-white/10 px-3 py-2">주 1회 60분 × 12주</span><span className="inline-flex items-center gap-1.5"><Check size={15} className="text-church-gold" />코딩 경험 없이 시작</span></div>
          <a href="#apply" className={motionStyles.cta + " mt-8 inline-flex min-h-13 items-center justify-center gap-6 rounded-xl bg-church-gold px-7 py-4 font-bold text-[#151d35] transition-colors hover:bg-church-gold-light"}>강의 신청하기 <ArrowRight size={19} /></a>
          <a href="#outcomes" className="ml-0 mt-4 flex items-center gap-2 text-sm text-slate-300 sm:ml-6 sm:inline-flex">어디에 쓸 수 있나요? <ArrowDown size={15} /></a>
        </div>
        <div className="relative mx-auto w-full max-w-md"><AiCourseWorkbench /><div className="mt-5 flex justify-center"><AiCourseMotionControls /></div></div>
      </div>
    </section>
    <section id="outcomes" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
      <SectionLabel>학교에서, 일터에서, 일상에서</SectionLabel><h2 className="text-3xl font-bold leading-snug sm:text-4xl">이럴 때, AI를 써보세요.</h2>
      <p className="mt-4 text-base leading-8 text-gray-600">내게 필요한 일부터 시작합니다.</p>
      <AiCourseExamples />
      <p className="mt-4 text-right text-xs text-gray-500">이해를 돕기 위한 실습 예시입니다.</p>
    </section>
    <section className="border-y border-gray-200/70 bg-white px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-3xl">
      <SectionLabel>AI 활용 8주 + 앱 만들기 4주</SectionLabel><h2 className="text-3xl font-bold leading-snug sm:text-4xl">처음부터, 한 걸음씩.</h2>
      <AiCourseRoadmap>{stages.map((stage, index) => <article key={stage.weeks} data-ai-course-stage={index} className="grid gap-3 rounded-2xl border border-gray-200 bg-church-cream p-6 sm:grid-cols-[95px_1fr] sm:gap-6 sm:p-7"><p className="text-lg font-bold text-primary-700">{stage.weeks}</p><div><h3 className="text-xl font-bold">{stage.title}</h3><p className="mt-2 text-base leading-7 text-gray-600">{stage.text}</p></div></article>)}</AiCourseRoadmap>
      <details className="group mt-7 rounded-2xl border border-gray-200">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700">자세한 수업 내용 보기<ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden /></summary>
        <div className="border-t border-gray-100 px-6 pb-6">{curriculum.map(([weeks, heading, topics]) => <div key={weeks} className="border-b border-gray-100 py-5 last:border-b-0"><p className="text-sm font-semibold text-primary-700">{weeks}</p><h3 className="mt-2 font-bold">{heading}</h3><p className="mt-2 text-sm leading-7 text-gray-600">{topics}</p></div>)}<p className="mt-5 text-sm leading-7 text-gray-500">예약과 휴대폰 연결은 계정·기기의 지원 여부를 확인한 뒤 진행해요. 내 컴퓨터에서 하는 작업은 컴퓨터와 앱이 켜져 있고 인터넷에 연결되어 있어야 해요.</p></div>
      </details>
    </div></section>
    <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20"><SectionLabel>시작하기 전에</SectionLabel><h2 className="text-3xl font-bold leading-snug">궁금한 점을 확인하세요.</h2><div className="mt-8 divide-y divide-gray-200">{faq.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-semibold leading-7 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700">{question}<ChevronDown size={18} className="shrink-0 text-primary-700 transition-transform group-open:rotate-180" aria-hidden /></summary><p className="mt-4 max-w-2xl text-base leading-8 text-gray-600">{answer}</p></details>)}</div></section>
    <section id="apply" className="border-t border-gray-200/70 bg-white px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-3xl">
      <SectionLabel>나에게 맞는 AI 활용, 지금부터</SectionLabel><h2 className="text-3xl font-bold leading-snug">함께 시작해요.</h2><p className="mb-8 mt-4 text-base leading-8 text-gray-600">현재 경험을 알려주시면 수업 준비에 도움이 됩니다.</p>
      <AiCourseForm privacyPolicy={privacyPolicy} preview={preview} />
    </div></section>
    <section className="border-t border-gray-200 bg-church-cream px-5 py-10 sm:px-8"><div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center sm:flex-row sm:text-left"><Image src={qr} alt="AI 강의 소개와 신청 페이지 QR코드" width={120} height={120} unoptimized className="shrink-0 rounded-xl border border-gray-100" /><div><h2 className="text-lg font-bold">함께 배울 분에게 소개해 주세요.</h2><a href={AI_COURSE_URL} className="mt-2 block break-all text-sm text-gray-500">www.msvch.org/ai-course</a><a href={qr} download="ai-course-qr.png" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-900">QR 이미지 내려받기 <ArrowDown size={14} /></a>{preview && <p className="mt-2 text-xs text-gray-500">QR은 현재 운영 중인 페이지로 연결됩니다.</p>}</div></div></section>
  </div></AiCourseMotionProvider>;
}
