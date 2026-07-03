"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type SubmitState = "idle" | "submitting" | "done";

export function MyeongbiPrayerForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!phone.trim()) {
      setError("연락처를 입력해 주세요.");
      return;
    }
    if (!affiliation.trim()) {
      setError("소속을 입력해 주세요.");
      return;
    }
    if (!available) {
      setError("참여 가능 여부를 확인해 주세요.");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/myeongbi-prayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          affiliation: affiliation.trim(),
          available: true,
          message: message.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "신청에 실패했습니다.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2
          size={44}
          className="mx-auto mb-3 text-emerald-600"
          aria-hidden
        />
        <h3 className="text-lg font-bold text-slate-950">
          신청이 접수되었습니다.
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          담당자가 확인 후 안내드리겠습니다.
          <br />
          기도의 자리에 함께해 주셔서 감사합니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field label="이름" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          autoComplete="name"
        />
      </Field>

      <Field label="연락처" required>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
          placeholder="예: 010-1234-5678"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          autoComplete="tel"
        />
      </Field>

      <Field label="소속" required>
        <input
          type="text"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          maxLength={100}
          placeholder="예: 청년부, 1교구, 목장명"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          활동 기간 동안 기도와 정기 모임에 성실하게 참여하기 원합니다.
        </span>
      </label>

      <Field label="남기고 싶은 말">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={4}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {message.length} / 1000
        </p>
      </Field>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "submitting" && <Loader2 size={18} className="animate-spin" />}
        명비 기도인 신청하기
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
