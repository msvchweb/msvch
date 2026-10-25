"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { z } from "zod";
import { AiCourseSubmissionSchema, aiCourseFieldErrors } from "@/lib/ai-course";

const InquirySchema = AiCourseSubmissionSchema.pick({ name: true, phone: true }).extend({
  message: z.string().trim().min(1, "궁금한 내용을 적어 주세요.").max(450, "문의 내용은 450자 이내로 적어 주세요."),
  privacyConsent: z.literal(true, { error: "문의 답변을 위한 개인정보 수집·이용에 동의해 주세요." }),
});
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-church-dark outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-100 aria-invalid:border-red-500";

export default function AiCourseInquiryForm({ preview = false }: { preview?: boolean }) {
  const [draft, setDraft] = useState({ name: "", phone: "", message: "", privacyConsent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (first) (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
  }, [errors]);
  useEffect(() => { if (status === "done") completionRef.current?.focus(); }, [status]);

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setServerError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || busy.current) return;
    setServerError("");
    const parsed = InquirySchema.safeParse(draft);
    if (!parsed.success) { setErrors(aiCourseFieldErrors(parsed.error)); return; }
    busy.current = true;
    setStatus("submitting");
    setErrors({});
    try {
      const response = await fetch("/api/chat/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          phone: parsed.data.phone,
          // Keep the course source visible in the existing admin inquiry inbox.
          message: `[AI 강의 사전 문의]\n${parsed.data.message}`,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true) { setStatus("done"); return; }
      setServerError(typeof data?.error === "string" ? data.error : "문의를 저장하지 못했습니다. 잠시 후 다시 보내 주세요.");
    } catch {
      setServerError("전송하지 못했습니다. 연결을 확인하고 다시 보내 주세요.");
    } finally {
      busy.current = false;
    }
    setStatus("idle");
  }

  function fieldProps(name: "name" | "phone" | "message") {
    return {
      id: `ai-course-inquiry-${name}`, name, value: draft[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(name, event.target.value),
      "aria-invalid": !!errors[name],
      "aria-describedby": [name === "message" && "ai-course-inquiry-message-hint", errors[name] && `ai-course-inquiry-${name}-error`].filter(Boolean).join(" ") || undefined,
      className: inputClass,
    };
  }
  function fieldError(name: string) {
    return errors[name] && <p id={`ai-course-inquiry-${name}-error`} className="mt-2 text-sm text-red-700">{errors[name]}</p>;
  }

  if (status === "done") return <div ref={completionRef} tabIndex={-1} role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 outline-none sm:p-8">
    <CheckCircle2 size={28} aria-hidden className="mb-4 text-emerald-700" />
    <h3 className="text-xl font-bold">문의가 접수되었습니다.</h3>
    <p className="mt-3 text-sm leading-7 text-gray-700">남겨주신 휴대전화 번호로 답변을 안내드릴게요.<br />강의 신청은 별도로 진행해 주세요.</p>
    <a href="#apply" className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary-900 underline underline-offset-4">강의 신청서로 이동</a>
  </div>;

  return <form ref={formRef} onSubmit={submit} noValidate aria-label="AI 강의 사전 문의" aria-busy={status === "submitting"} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
    {preview && <p role="note" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">미리보기에서는 문의가 전송되지 않아요.</p>}
    <fieldset disabled={status === "submitting"} className="min-w-0 space-y-5">
      <legend className="sr-only">문의 정보</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ai-course-inquiry-name" className="mb-2 block text-sm font-semibold">이름</label>
          <input {...fieldProps("name")} autoComplete="name" maxLength={50} required />
          {fieldError("name")}
        </div>
        <div>
          <label htmlFor="ai-course-inquiry-phone" className="mb-2 block text-sm font-semibold">휴대전화 번호</label>
          <input {...fieldProps("phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="010-0000-0000" required />
          {fieldError("phone")}
        </div>
      </div>
      <div>
        <label htmlFor="ai-course-inquiry-message" className="mb-2 block text-sm font-semibold">문의 내용</label>
        <textarea {...fieldProps("message")} rows={4} maxLength={450} placeholder="수업 내용, 일정, 준비물 등 궁금한 점을 편하게 적어 주세요." required />
        <p id="ai-course-inquiry-message-hint" className="mt-2 text-right text-xs text-gray-500">{draft.message.length} / 450자</p>
        {fieldError("message")}
      </div>
      <div className="rounded-xl bg-church-cream p-4">
        <p className="mb-3 text-xs leading-6 text-gray-600">명성비전교회는 문의 답변과 연락을 위해 이름, 휴대전화 번호, 문의 내용을 수집·이용합니다. <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">개인정보처리방침 보기</a></p>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
          <input name="privacyConsent" type="checkbox" checked={draft.privacyConsent} onChange={(event) => update("privacyConsent", event.target.checked)} required aria-invalid={!!errors.privacyConsent} aria-describedby={errors.privacyConsent ? "ai-course-inquiry-privacyConsent-error" : undefined} className="mt-1 h-4 w-4 shrink-0 accent-primary-900" />
          문의 답변을 위한 개인정보 수집·이용에 동의합니다.
        </label>
        {fieldError("privacyConsent")}
      </div>
      {serverError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{serverError}</p>}
      <button type="submit" disabled={preview || status === "submitting"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700 disabled:opacity-60 sm:w-auto">
        <Send size={16} aria-hidden />
        {preview ? "미리보기 · 전송하지 않아요" : status === "submitting" ? "보내는 중…" : "문의 보내기"}
      </button>
    </fieldset>
  </form>;
}
