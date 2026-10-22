"use client";
import React, { useEffect, useRef, useState } from "react";
import { AI_COURSE_PRIVACY_POLICY_VERSION, AI_COURSE_SURVEY_VERSION, AiCourseSubmissionSchema, AiCourseExperienceSchema, CAPABILITIES, FREQUENCY_OPTIONS, LAPTOP_OPTIONS, LEARNING_GOALS, MOBILE_OPTIONS, OS_OPTIONS, TOOL_OPTIONS, USE_CASES, WEBSITE_OPTIONS, aiCourseFieldErrors, type Choice } from "@/lib/ai-course";
import type { AiCourseSubmission, CapabilityKey, ExperienceLevel } from "@/types/ai-course";
import type { AiCoursePrivacyPolicy } from "./privacy-policy";
import CapabilityQuestions, { ChoiceQuestion } from "./CapabilityQuestions";
import ApplicationDetails from "@/components/ai-course/ApplicationDetails";

const STEPS = ["신청 정보", "현재 활용 경험", "수강 목표", "확인·제출"];
const VALIDATION_ID = "00000000-0000-4000-8000-000000000000";
type Draft = {
  name: string; phone: string; useCases: string[]; useCasesOther: string; laptopReadiness: string; os: string; mobileOs: string; supportRequest: string;
  usageFrequency: string; tools: string[]; toolsOther: string; capabilities: Partial<Record<CapabilityKey, ExperienceLevel>>;
  websiteExperience: string; websiteExperienceOther: string; learningGoals: string[]; repetitiveTask: string; privacyConsent: boolean;
};
const INITIAL: Draft = { name: "", phone: "", useCases: [], useCasesOther: "", laptopReadiness: "", os: "", mobileOs: "", supportRequest: "", usageFrequency: "", tools: [], toolsOther: "", capabilities: {}, websiteExperience: "", websiteExperienceOther: "", learningGoals: [], repetitiveTask: "", privacyConsent: false };
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-church-dark outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-100 aria-invalid:border-red-500";
function stepForField(path: string) {
  if (path === "name" || path === "phone" || path.startsWith("applicationContext")) return 0;
  if (["surveyAnswers.usageFrequency", "surveyAnswers.tools", "surveyAnswers.capabilities"].some((prefix) => path.startsWith(prefix))) return 1;
  if (path.startsWith("surveyAnswers")) return 2;
  return 3;
}
function TextQuestion({ name, title, value, onChange, error, maxLength, multiline = false, hint, ...attributes }: {
  name: string; title: string; value: string; onChange: (value: string) => void; error?: string; maxLength: number; multiline?: boolean; hint?: string; type?: string; autoComplete?: string; inputMode?: "tel";
}) {
  const props = { id: name, name, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), maxLength, "aria-invalid": !!error, "aria-describedby": [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined, className: inputClass };
  return <div data-field={name} className="space-y-2">
    <label htmlFor={name} className="block text-base font-semibold text-church-dark">{title}</label>
    {hint && <p id={`${name}-hint`} className="text-sm leading-relaxed text-gray-500">{hint}</p>}
    {multiline ? <textarea {...props} rows={3} /> : <input {...props} {...attributes} />}
    {error && <p id={`${name}-error`} className="text-sm text-red-700">{error}</p>}
  </div>;
}
export default function AiCourseForm({ privacyPolicy }: { privacyPolicy: AiCoursePrivacyPolicy }) {
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const lastSubmission = useRef<{ serialized: string; payload: AiCourseSubmission } | null>(null);
  const firstRender = useRef(true);
  useEffect(() => { if (status === "done") completionRef.current?.focus(); }, [status]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    const first = Object.keys(errors).find((path) => stepForField(path) === step);
    if (!first) return;
    const field = Array.from(formRef.current?.querySelectorAll<HTMLElement>("[data-field]") ?? []).find((node) => node.dataset.field === first);
    field?.querySelector<HTMLElement>("input,textarea")?.focus();
  }, [errors, step]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((previous) => ({ ...previous, [key]: value })); setServerError(""); }
  function toggle(key: "useCases" | "tools" | "learningGoals", value: string) {
    let next = draft[key].includes(value) ? draft[key].filter((item) => item !== value) : [...draft[key], value];
    if (key === "tools") next = value === "none" ? (draft.tools.includes("none") ? [] : ["none"]) : next.filter((item) => item !== "none");
    if (key === "learningGoals" && next.length > 2) return;
    update(key, next);
  }
  function candidate(consent = draft.privacyConsent) {
    return {
      requestId: VALIDATION_ID, name: draft.name, phone: draft.phone,
      applicationContext: { useCases: draft.useCases, useCasesOther: draft.useCasesOther, laptopReadiness: draft.laptopReadiness, os: draft.os, mobileOs: draft.mobileOs, supportRequest: draft.supportRequest },
      surveyVersion: AI_COURSE_SURVEY_VERSION,
      surveyAnswers: { usageFrequency: draft.usageFrequency, tools: draft.tools, toolsOther: draft.toolsOther, capabilities: draft.capabilities, websiteExperience: draft.websiteExperience, websiteExperienceOther: draft.websiteExperienceOther, learningGoals: draft.learningGoals, repetitiveTask: draft.repetitiveTask },
      privacyConsent: consent, privacyPolicyVersion: privacyPolicy.version,
    };
  }
  function next() {
    const result = step === 1
      ? AiCourseExperienceSchema.safeParse({ usageFrequency: draft.usageFrequency, tools: draft.tools, toolsOther: draft.toolsOther, capabilities: draft.capabilities })
      : AiCourseSubmissionSchema.safeParse(candidate());
    const allErrors = result.success ? {} : aiCourseFieldErrors(result.error);
    const currentErrors = step === 1
      ? Object.fromEntries(Object.entries(allErrors).map(([path, message]) => [`surveyAnswers.${path}`, message]))
      : Object.fromEntries(Object.entries(allErrors).filter(([path]) => stepForField(path) <= step));
    setErrors(currentErrors);
    if (!Object.keys(currentErrors).length) setStep((previous) => previous + 1);
    else setStep(stepForField(Object.keys(currentErrors)[0]));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (step < 3) { next(); return; }
    const result = AiCourseSubmissionSchema.safeParse(candidate());
    if (!result.success) {
      const fields = aiCourseFieldErrors(result.error); setErrors(fields); setStep(stepForField(Object.keys(fields)[0])); return;
    }
    const serialized = JSON.stringify(result.data);
    if (lastSubmission.current?.serialized !== serialized) lastSubmission.current = { serialized, payload: { ...result.data, requestId: crypto.randomUUID() } };
    busy.current = true; setStatus("submitting"); setServerError(""); setErrors({});
    try {
      const response = await fetch("/api/ai-course", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lastSubmission.current.payload) });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true) { setStatus("done"); return; }
      setServerError(typeof data?.error === "string" ? data.error : "신청을 저장하지 못했습니다. 다시 제출해 주세요.");
      if (response.status === 400 && data?.fieldErrors) {
        const fields: Record<string, string> = Object.fromEntries(Object.entries(data.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
        setErrors(fields); if (Object.keys(fields).length) setStep(stepForField(Object.keys(fields)[0]));
      }
      setStatus("idle");
    } catch { setServerError("전송하지 못했습니다. 연결을 확인하고 다시 제출해 주세요."); setStatus("idle"); }
    finally { busy.current = false; }
  }
  function choices(key: keyof Draft, name: string, title: string, options: readonly Choice[], multiple = false, max?: number) {
    return <ChoiceQuestion name={name} title={title} options={options} value={draft[key] as string | string[]} onChange={(value) => multiple ? toggle(key as "useCases" | "tools" | "learningGoals", value) : update(key, value)} error={errors[name]} multiple={multiple} max={max} />;
  }
  function text(key: keyof Draft, name: string, title: string, maxLength: number, extra: { multiline?: boolean; hint?: string; type?: string; autoComplete?: string; inputMode?: "tel" } = {}) {
    return <TextQuestion name={name} title={title} value={draft[key] as string} onChange={(value) => update(key, value)} error={errors[name]} maxLength={maxLength} {...extra} />;
  }
  const review = step === 3 ? AiCourseSubmissionSchema.safeParse(candidate(true)) : null;
  if (status === "done") return <div ref={completionRef} tabIndex={-1} role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center outline-none sm:p-12">
    <div aria-hidden="true" className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</div>
    <h2 className="text-2xl font-bold text-church-dark">신청이 접수되었습니다.</h2>
    <p className="mt-3 leading-relaxed text-gray-700">신청 정보와 AI 활용 수준 설문을 잘 받았습니다.</p>
    <a href="#course" className="mt-6 inline-block font-semibold text-primary-900 underline underline-offset-4">강의 내용 다시 보기</a>
  </div>;
  return <form ref={formRef} onSubmit={submit} noValidate aria-busy={status === "submitting"} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
    <ol aria-label="신청 단계" className="mb-8 grid grid-cols-4 gap-2">
      {STEPS.map((title, index) => <li key={title} aria-current={index === step ? "step" : undefined} className={`border-t-4 pt-3 text-xs leading-relaxed sm:text-sm ${index <= step ? "border-primary-900 text-primary-900" : "border-gray-100 text-gray-400"}`}><span className="block font-bold">0{index + 1}</span>{title}</li>)}
    </ol>
    <h2 ref={headingRef} tabIndex={-1} className="mb-2 text-2xl font-bold text-church-dark outline-none">{STEPS[step]}</h2>
    <p className="mb-8 text-sm leading-relaxed text-gray-500">{step === 0 ? "신청 정보와 설문은 마지막 단계에서 함께 제출합니다." : step === 1 ? "지금 할 수 있는 만큼만 알려주세요. 실습 준비를 위한 설문입니다." : step === 2 ? "수업에서 바꾸고 싶은 일을 알려주세요." : "이름, 연락처와 설문 답변을 확인한 후 제출해 주세요."}</p>
    <fieldset disabled={status === "submitting"} className="min-w-0 space-y-7">
      <legend className="sr-only">{STEPS[step]} 입력</legend>
      {step === 0 && <>
        <div className="grid gap-6 sm:grid-cols-2">{text("name", "name", "이름", 50, { autoComplete: "name" })}{text("phone", "phone", "휴대전화 번호", 30, { type: "tel", inputMode: "tel", autoComplete: "tel" })}</div>
        {choices("useCases", "applicationContext.useCases", "주로 AI를 활용하고 싶은 분야", USE_CASES, true)}
        {draft.useCases.includes("other") && text("useCasesOther", "applicationContext.useCasesOther", "기타 활용 분야", 200)}
        {choices("laptopReadiness", "applicationContext.laptopReadiness", "노트북 준비 여부", LAPTOP_OPTIONS)}
        {choices("os", "applicationContext.os", "노트북 운영체제", OS_OPTIONS)}
        {choices("mobileOs", "applicationContext.mobileOs", "스마트폰 종류", MOBILE_OPTIONS)}
        {text("supportRequest", "applicationContext.supportRequest", "궁금한 점·도움이 필요한 부분 (선택)", 1000, { multiline: true, hint: "설치, 계정, 접근성 등 필요한 도움을 적어 주세요." })}
      </>}
      {step === 1 && <>
        {choices("usageFrequency", "surveyAnswers.usageFrequency", "최근 한 달 동안 AI를 얼마나 사용했나요?", FREQUENCY_OPTIONS)}
        {choices("tools", "surveyAnswers.tools", "직접 사용해 본 도구는 무엇인가요?", TOOL_OPTIONS, true)}
        {draft.tools.includes("other") && text("toolsOther", "surveyAnswers.toolsOther", "기타 도구 이름", 200)}
        <CapabilityQuestions value={draft.capabilities} onChange={(value) => update("capabilities", value)} errors={Object.fromEntries(CAPABILITIES.map((q) => [q.value, errors[`surveyAnswers.capabilities.${q.value}`]]))} />
      </>}
      {step === 2 && <>
        {choices("websiteExperience", "surveyAnswers.websiteExperience", "앱 제작 경험은 어느 정도인가요?", WEBSITE_OPTIONS)}
        {draft.websiteExperience === "other" && text("websiteExperienceOther", "surveyAnswers.websiteExperienceOther", "앱 경험 설명 (선택)", 200)}
        {choices("learningGoals", "surveyAnswers.learningGoals", "가장 먼저 배우고 싶은 것 (최대 2개)", LEARNING_GOALS, true, 2)}
        {text("repetitiveTask", "surveyAnswers.repetitiveTask", "AI로 줄이고 싶은 반복 업무 하나", 500, { multiline: true, hint: "예: 회의 후 할 일 정리, 고객 안내문 작성, 매주 모임 준비. 아직 떠오르지 않으면 ‘수업에서 찾아보고 싶어요’라고 적어 주세요. 실제 고객명이나 비공개 업무 내용은 적지 않아도 됩니다." })}
      </>}
      {step === 3 && <>
        {review?.success && <ApplicationDetails application={review.data} />}
        <div className="rounded-2xl bg-church-cream p-5"><h3 className="mb-3 font-bold">개인정보 수집·이용 안내</h3><p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">{privacyPolicy.text}</p></div>
        <div data-field="privacyConsent"><label className="flex cursor-pointer items-start gap-3 text-sm font-semibold leading-relaxed"><input type="checkbox" checked={draft.privacyConsent} onChange={(event) => update("privacyConsent", event.target.checked)} aria-invalid={!!errors.privacyConsent} aria-describedby={errors.privacyConsent ? "privacyConsent-error" : undefined} className="mt-1 h-4 w-4 accent-primary-900" />개인정보 수집·이용에 동의합니다.</label>{errors.privacyConsent && <p id="privacyConsent-error" className="mt-2 text-sm text-red-700">{errors.privacyConsent}</p>}</div>
        {privacyPolicy.version !== AI_COURSE_PRIVACY_POLICY_VERSION && <p role="alert">개인정보 안내가 변경되었습니다. 페이지를 새로 열어 주세요.</p>}
      </>}
    </fieldset>
    {serverError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{serverError}</p>}
    <div className="mt-8 flex gap-3 border-t border-gray-100 pt-6">
      {step > 0 && <button type="button" disabled={status === "submitting"} onClick={() => { setStep(step - 1); setErrors({}); setServerError(""); }} className="min-h-12 rounded-xl border border-gray-300 px-6 font-semibold text-gray-700 disabled:opacity-50">이전</button>}
      <button type="submit" disabled={status === "submitting"} className="min-h-12 flex-1 rounded-xl bg-primary-900 px-6 font-semibold text-white hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700 disabled:opacity-60">{step < 3 ? "다음" : status === "submitting" ? "제출 중…" : "신청서 제출하기"}</button>
    </div>
  </form>;
}
