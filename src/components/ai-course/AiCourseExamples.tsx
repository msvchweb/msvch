import { ArrowRight, BookOpen, Check, FileText, Globe2, GraduationCap, Presentation, UserRound } from "lucide-react";
import AiCourseFeatureNetwork from "./motion/AiCourseFeatureNetwork";
import AiCourseReveal from "./motion/AiCourseReveal";
import styles from "./motion/ai-course-motion.module.css";

const examples = [
  { kind: "study", icon: GraduationCap, title: "공부할 때", text: "수업 자료를 정리하고, 복습 문제를 만들어요." },
  { kind: "prepare", icon: Presentation, title: "발표·모임을 준비할 때", text: "흩어진 메모를 발표 구성과 안내문 초안으로 바꿔요." },
  { kind: "app", icon: Globe2, title: "나를 소개하고 싶을 때", text: "내 소개와 활동을 담은 나만의 앱을 만들어요." },
] as const;
function Artwork({ kind }: { kind: typeof examples[number]["kind"] }) {
  if (kind === "app") return <div aria-hidden="true" className="flex h-48 items-center justify-center rounded-2xl bg-[#e9edf5] p-3 sm:p-5">
    <div className="w-full max-w-56 overflow-hidden rounded-xl border border-white bg-white shadow-lg shadow-slate-900/10">
      <div className="flex gap-1 border-b border-gray-100 px-3 py-2">{[0, 1, 2].map(i => <i key={i} className="h-1.5 w-1.5 rounded-full bg-gray-200" />)}</div>
      <div className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-900 text-church-gold"><UserRound size={22} /></span><strong className="text-lg">나의 공간</strong></div><div className="mt-4 grid grid-cols-2 gap-2"><span className="rounded-lg bg-church-cream p-3 text-center text-sm">소개</span><span className="rounded-lg bg-primary-50 p-3 text-center text-sm">활동</span></div></div>
    </div>
  </div>;
  if (kind === "prepare") return <div aria-hidden="true" className="flex h-48 items-center justify-center gap-2 rounded-2xl bg-[#19243e] px-3 sm:gap-4 sm:px-5">
    <div className="-rotate-6 rounded-xl bg-white/10 p-3 text-slate-200 sm:p-4"><FileText size={36} /><span className="mt-3 block text-sm">메모</span></div><ArrowRight size={16} className="shrink-0 text-church-gold sm:h-[22px] sm:w-[22px]" /><div className="rotate-3 rounded-xl bg-[#fff9e9] p-3 text-primary-900 shadow-lg sm:p-5"><Presentation size={40} /><strong className="mt-3 block whitespace-nowrap text-sm">발표 준비</strong></div>
  </div>;
  return <div aria-hidden="true" className="flex h-48 items-center justify-center gap-2 rounded-2xl bg-[#f3ecd9] px-3 sm:gap-4 sm:px-5">
    <div className="-rotate-6 rounded-xl bg-white/60 p-3 text-primary-800 sm:p-4"><BookOpen size={36} /><span className="mt-3 block whitespace-nowrap text-sm">수업 자료</span></div><ArrowRight size={16} className="shrink-0 text-[#9a7a26] sm:h-[22px] sm:w-[22px]" /><div className="w-22 shrink-0 rotate-3 rounded-xl bg-white p-3 shadow-lg shadow-amber-900/10 sm:w-28 sm:p-4"><strong className="whitespace-nowrap text-sm text-primary-900">핵심 정리</strong>{[1, 2, 3].map(i => <div key={i} className="mt-3 flex items-center gap-2"><Check size={12} className="shrink-0 text-emerald-600" /><span className="h-1.5 flex-1 rounded-full bg-gray-200" /></div>)}</div>
  </div>;
}
export default function AiCourseExamples() {
  return <AiCourseFeatureNetwork>{examples.map(({ kind, icon: Icon, title, text }, index) => <article key={kind} className={styles.featureCard} data-ai-feature={kind}>
    <div data-ai-icon className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary-900"><Icon size={24} /></div>
    <AiCourseReveal delay={index * 0.08}><h3 className="mb-5 text-xl font-bold leading-8">{title}</h3><Artwork kind={kind} /><p className="mt-5 break-keep text-base leading-7 text-gray-600">{text}</p></AiCourseReveal>
  </article>)}</AiCourseFeatureNetwork>;
}
