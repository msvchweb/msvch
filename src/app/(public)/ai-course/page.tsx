import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight, Check, FileText, FolderCheck, Globe2, Repeat2, Smartphone, Timer } from "lucide-react";
import { AI_COURSE_URL } from "@/lib/ai-course";
import { createAiCourseQrDataUrl } from "@/lib/ai-course-qr";
import AiCourseForm from "./AiCourseForm";
import { getAiCoursePrivacyPolicy } from "./privacy-policy";
import { AiCourseMotionProvider, AiCourseMotionControls } from "@/components/ai-course/motion/AiCourseMotionProvider";
import AiCourseWorkbench from "@/components/ai-course/motion/AiCourseWorkbench";
import motionStyles from "@/components/ai-course/motion/ai-course-motion.module.css";

const title = "AI로 내 일을 끝내는 12주";
const description = "ChatGPT·Codex로 문서 작업, 반복 업무, 모바일 원격 활용부터 개인 앱 제작까지. 주 1회 60분, 12주 동안 내 일에 쓰는 AI를 배웁니다.";
export const metadata: Metadata = {
  title, description, alternates: { canonical: AI_COURSE_URL },
  openGraph: { title: `${title} | 명성비전교회`, description, url: AI_COURSE_URL, type: "website" },
};
const outcomes = [
  { icon: FileText, title: "내 메모가 업무 문서로", text: "메모와 자료에서 할 일을 정리하고 안내문을 만듭니다. 원자료와 비교해 빠진 내용까지 확인합니다.", result: "업무 정리 문서와 안내문 초안" },
  { icon: FolderCheck, title: "내 기준을 기억하는 작업 공간", text: "업무 배경과 원하는 형식을 프로젝트·지침에 담습니다. 플러그인과 외부 앱의 자료도 연결해 활용합니다.", result: "내 업무 프로젝트와 지침" },
  { icon: Repeat2, title: "반복 업무를 나만의 스킬로", text: "매번 비슷하게 요청하던 일을 재사용할 수 있는 절차로 만듭니다. 새 자료로 다시 실행해 봅니다.", result: "자료를 바꿔 실행해 본 업무 스킬" },
  { icon: Timer, title: "정해진 시간에 일을 시작하도록", text: "작업을 예약하고 실행 기록과 결과물을 확인합니다. 일정을 바꾸거나 중지하는 방법까지 익힙니다.", result: "실행을 확인한 예약 작업" },
  { icon: Smartphone, title: "휴대폰에서 이어가는 내 작업", text: "휴대폰을 내 컴퓨터에 연결해 진행 중인 작업에 요청을 추가하고, 만들어진 결과를 확인합니다.", result: "내 기기에 맞는 모바일 원격 활용" },
  { icon: Globe2, title: "내 앱을 만들고 직접 고치기", text: "소개와 활동을 담은 앱을 웹 주소로 공유합니다. 원하는 변경을 설명하고, 확인한 뒤 다시 배포합니다.", result: "직접 고쳐 쓰는 개인 앱" },
];
const curriculum = [
  ["01–02", "자료에서 결과물까지", "기본 요청과 결과 확인 · 프로젝트와 지침", "업무 문서 한 벌, 내 업무 프로젝트"],
  ["03–04", "내 파일과 외부 자료 연결", "클라우드·로컬 · 플러그인·외부 앱", "파일로 저장한 결과물, 연결 자료를 활용한 작업"],
  ["05–06", "다시 쓸 수 있는 업무 만들기", "스킬 · 예약 · 실행 결과 확인", "나만의 스킬과 예약 작업"],
  ["07–08", "내 일에 연결하기", "모바일 원격 활용 · 업무 종합 실습", "반복 업무 하나를 처리하는 절차와 결과물"],
  ["09–10", "나만의 앱 공개하기", "GitHub·Vercel 가입과 연동 · 제작·배포", "내 내용이 담긴 앱과 접속 주소"],
  ["11–12", "필요할 때 직접 고쳐 쓰기", "작은 기능 추가 · 수정·재배포 · 되돌리기", "직접 수정하며 운영하는 앱"],
];
const faq = [
  ["코딩을 몰라도 참여할 수 있나요?", "코딩 경험을 전제로 하지 않습니다. 원하는 작업을 설명하고 결과를 확인하는 방법부터 익힙니다. 앱은 공통 틀에서 시작해 내 내용으로 바꾸며, 수정 후 동작을 확인하는 과정까지 배웁니다."],
  ["ChatGPT를 어느 정도 사용해 봐야 하나요?", "질문하거나 글쓰기에 사용해 본 경험을 기준으로 구성합니다. 현재 할 수 있는 일을 신청 설문에 적어 주세요. 파일 저장과 폴더 찾기 등 노트북의 기본 조작은 필요합니다."],
  ["휴대폰만으로 수강할 수 있나요?", "수업에는 개인 노트북과 충전기가 필요합니다. 스마트폰은 모바일 원격 활용에서 함께 사용합니다. 기기 준비에 도움이 필요하면 신청서에 알려 주세요."],
  ["자동화해 놓으면 컴퓨터를 꺼도 되나요?", "작업이 실행되는 위치에 따라 다릅니다. 내 컴퓨터의 파일을 다루는 예약·원격 작업은 컴퓨터와 앱이 켜져 있고 인터넷에 연결되어 있어야 합니다. 계정·기기의 기능 지원과 클라우드·로컬의 실행 조건을 함께 확인합니다."],
  ["어떤 앱을 만드나요?", "자기소개, 활동 소개, 작업물 소개처럼 작게 시작할 수 있는 개인 앱을 만듭니다. GitHub에 작업을 저장하고 Vercel로 배포한 뒤, 내용을 바꾸고 작은 기능을 추가하는 흐름을 익힙니다."],
  ["회사 자료를 준비해야 하나요?", "공통 자료로 먼저 연습합니다. 실제 고객 정보나 비공개 업무 자료를 준비할 필요는 없습니다. 배운 절차를 자신의 일에 적용하는 방법을 함께 익힙니다."],
];
function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="mb-4 text-xs font-bold tracking-[0.18em] text-primary-800">{children}</p>; }
export default async function AiCoursePage() {
  const qr = await createAiCourseQrDataUrl();
  const privacyPolicy = getAiCoursePrivacyPolicy();
  return <AiCourseMotionProvider><div id="course" className="bg-church-cream text-church-dark">
    <section className={motionStyles.hero}>
      <div aria-hidden="true" className={motionStyles.heroGlow} />
      <div aria-hidden="true" className={motionStyles.heroRings} />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs tracking-wide text-church-gold-light"><span className="h-1.5 w-1.5 rounded-full bg-church-gold" />명성비전교회 · AI 활용 과정</p>
          <h1 className="break-keep text-4xl font-bold leading-[1.3] tracking-tight sm:text-5xl"><span className={motionStyles.headlineLine}>매번 하던 일은</span><span className={motionStyles.headlineLine}>더 간단하게.</span><span className={`${motionStyles.headlineLine} text-church-gold`}>만들고 싶던 앱은</span><span className={`${motionStyles.headlineLine} text-church-gold`}>내 손으로.</span></h1>
          <p className="mt-7 max-w-md text-base leading-8 text-slate-300">ChatGPT·Codex로 내 일을 끝내는 12주.<br />문서 작업부터 반복 업무, 모바일 원격 활용,<br className="hidden sm:block" /> 그리고 직접 고쳐 쓰는 나만의 앱까지.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-200"><span className="rounded-lg bg-white/10 px-3 py-2">주 1회 60분 × 12주</span><span className="rounded-lg bg-white/10 px-3 py-2">AI 활용 8주 + 앱 4주</span></div>
          <a href="#apply" className={`${motionStyles.cta} mt-9 inline-flex min-h-13 items-center justify-center gap-6 rounded-xl bg-church-gold px-7 py-4 font-bold text-[#151d35] transition-colors hover:bg-church-gold-light`}>강의 신청하기 <ArrowRight size={19} /></a>
          <a href="#outcomes" className="ml-0 mt-4 flex items-center gap-2 text-sm text-slate-300 sm:ml-6 sm:inline-flex">어떤 일을 할 수 있게 되나요? <ArrowDown size={15} /></a>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <AiCourseWorkbench />
          <p className="mt-4 text-center text-xs text-slate-400">질문에서 끝내지 않고, 결과물로 남기는 시간</p>
          <div className="mt-5 flex justify-center"><AiCourseMotionControls /></div>
        </div>
      </div>
    </section>

    <section id="outcomes" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24">
      <SectionLabel>BEFORE → AFTER</SectionLabel>
      <h2 className="text-3xl font-bold leading-snug tracking-tight sm:text-4xl">배운 기능이<br className="sm:hidden" /> 내 일의 변화를 만듭니다.</h2>
      <p className="mt-4 max-w-2xl leading-8 text-gray-600">반복하던 일 하나에서 시작해 보세요. 설명하고, 실행하고, 결과를 확인하는 과정을 함께 연습합니다.</p>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {[
          { number: "01", title: "흩어진 메모 → 실행 계획", before: "모임 준비 / 간식 확인 / 참석 인원? / 안내 보내기", after: ["할 일: 간식·준비물 정리", "확인할 것: 참석 인원과 담당자", "결과물: 할 일 목록 + 안내문 초안"], tag: "내 자료로 문서 만들기" },
          { number: "02", title: "같은 설명 → 다시 쓰는 절차", before: "매주 자료를 올리고, 형식을 설명하고, 빠진 항목을 다시 요청하고…", after: ["내가 정한 형식과 확인 기준 저장", "새 자료로 같은 절차 실행", "결과를 검토하고 필요한 부분 수정"], tag: "지침·스킬로 반복 줄이기" },
          { number: "03", title: "수정하고 싶은 앱 → 새 버전", before: "소개글만 있는 내 앱. 새 활동과 사진을 추가하고 싶어요.", after: ["“활동 소개와 사진 영역을 추가해줘”", "바뀐 앱을 확인하고 수정", "새 버전을 배포해 같은 주소로 공유"], tag: "만들고 고쳐 쓰는 앱" },
        ].map((example) => <article key={example.number} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-6"><span className="text-xs font-bold text-primary-700">{example.number} / 실습 예시</span><h3 className="mt-3 text-lg font-bold">{example.title}</h3></div>
          <div className="p-6"><p className="text-[10px] font-bold tracking-widest text-gray-400">BEFORE</p><p className="mt-2 min-h-20 text-sm leading-7 text-gray-500">{example.before}</p><div className="my-4 h-px bg-gray-100" /><p className="text-[10px] font-bold tracking-widest text-primary-700">AFTER</p><ul className="mt-3 space-y-3">{example.after.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-gray-700"><Check size={15} className="mt-1 shrink-0 text-primary-700" />{item}</li>)}</ul><p className="mt-6 rounded-lg bg-church-gold-light px-3 py-2 text-center text-xs font-semibold text-primary-900">{example.tag}</p></div>
        </article>)}
      </div>
    </section>

    <section className="border-y border-gray-200/70 bg-white px-5 py-16 sm:px-8 sm:py-24"><div className="mx-auto max-w-6xl">
      <SectionLabel>WHAT YOU CAN DO</SectionLabel><h2 className="text-3xl font-bold leading-snug sm:text-4xl">12주 동안, 내게 남는 여섯 가지.</h2>
      <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">{outcomes.map(({ icon: Icon, title: outcomeTitle, text, result }) => <article key={outcomeTitle}>
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-900"><Icon size={22} /></div><h3 className="text-lg font-bold">{outcomeTitle}</h3><p className="mt-3 text-sm leading-7 text-gray-600">{text}</p><p className="mt-4 border-l-2 border-church-gold pl-3 text-xs font-semibold leading-6 text-primary-900">{result}</p>
      </article>)}</div>
      <p className="mt-10 text-xs leading-6 text-gray-500">예약과 원격 활용은 계정·기기의 기능 지원을 확인한 뒤 진행합니다. 내 컴퓨터에서 실행하는 작업에는 컴퓨터와 앱이 켜져 있고 인터넷에 연결된 환경이 필요합니다.</p>
    </div></section>

    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionLabel>8 WEEKS + 4 WEEKS</SectionLabel><h2 className="text-3xl font-bold leading-snug sm:text-4xl">먼저 AI를 내 일에.<br />그다음, 나만의 앱으로.</h2>
      <p className="mt-4 leading-8 text-gray-600">앞 8주는 AI 활용의 기본과 작업 방법을 익힙니다.<br />마지막 4주는 그 경험을 앱 제작과 운영으로 이어갑니다.</p>
      <div className="mt-10 space-y-3">{curriculum.map(([weeks, heading, topics, result], index) => <article key={weeks} className={`grid gap-4 rounded-2xl border p-5 sm:grid-cols-[90px_1fr_1fr] sm:items-center sm:p-6 ${index < 4 ? "border-gray-200 bg-white" : "border-primary-200 bg-primary-50"}`}><p className="text-xl font-bold tabular-nums text-primary-900">{weeks}<span className="ml-1 text-xs font-normal">주</span></p><div><h3 className="font-bold">{heading}</h3><p className="mt-1 text-xs leading-6 text-gray-500">{topics}</p></div><p className="text-sm leading-6 text-gray-700"><span className="mr-2 text-xs text-primary-700">남는 것</span>{result}</p></article>)}</div>
      <div className="mt-8 rounded-2xl bg-church-gold-light p-6"><h3 className="font-bold text-primary-900">설명을 듣고, 노트북에서 실행하고, 결과를 확인합니다.</h3><p className="mt-2 text-sm leading-7 text-gray-700">공통 자료로 같은 작업을 연습한 뒤 자신의 업무에 맞게 바꿔봅니다. 직장 업무, 사업·가게 운영, 개인 작업, 교회·모임 활동까지 각자의 일터와 일상에 연결합니다.</p></div>
    </section>

    <section className="bg-white px-5 py-16 sm:px-8"><div className="mx-auto max-w-3xl"><SectionLabel>QUESTIONS</SectionLabel><h2 className="mb-8 text-3xl font-bold">궁금한 점을 먼저 확인하세요.</h2><div className="divide-y divide-gray-200">{faq.map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer pr-5 text-base font-semibold leading-7 marker:text-church-gold">{question}</summary><p className="mt-4 text-sm leading-8 text-gray-600">{answer}</p></details>)}</div></div></section>

    <section id="apply" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24">
      <SectionLabel>LET’S START</SectionLabel><h2 className="text-3xl font-bold leading-snug">AI로 내 일을 끝내는 12주,<br />함께 시작해요.</h2><p className="mb-8 mt-4 text-sm leading-8 text-gray-600">신청 정보와 현재 AI 활용 경험을 작성해 주세요.<br />설문은 실습 준비와 난이도 조정을 위한 것입니다.</p>
      <AiCourseForm privacyPolicy={privacyPolicy} />
    </section>
    <section className="border-t border-gray-200 bg-white px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left"><Image src={qr} alt="AI 강의 소개와 신청 페이지 QR코드" width={148} height={148} unoptimized className="shrink-0 rounded-xl border border-gray-100" /><div><h2 className="text-lg font-bold">스캔하고, 할 수 있게 될 일을 확인하세요.</h2><p className="mt-2 text-sm leading-7 text-gray-600">강의 소개부터 신청·AI 활용 수준 설문까지 한곳에서.</p><a href={AI_COURSE_URL} className="mt-2 block break-all text-xs text-gray-500">www.msvch.org/ai-course</a><a href={qr} download="ai-course-qr.png" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-primary-900">QR 이미지 내려받기 <ArrowDown size={14} /></a></div></div></section>
  </div></AiCourseMotionProvider>;
}
