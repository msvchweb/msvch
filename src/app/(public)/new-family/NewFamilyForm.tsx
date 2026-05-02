"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  type NewFamilyVisitPath,
  type NewFamilyFaithStatus,
  type NewFamilyGender,
  type NewFamilyChurchHistory,
  VISIT_PATH_LABELS,
  FAITH_STATUS_LABELS,
  CHURCH_HISTORY_LABELS,
} from "@/types/new-family";
import { PRIVACY_POLICY_TEXT } from "./privacy-policy";

const VISIT_PATH_KEYS: NewFamilyVisitPath[] = [
  "website",
  "youtube",
  "recommendation",
  "visited_first",
  "etc",
];

const FAITH_STATUS_KEYS: NewFamilyFaithStatus[] = [
  "accepted",
  "not_yet",
  "unsure",
];

const CHURCH_HISTORY_KEYS: NewFamilyChurchHistory[] = [
  "never",
  "attended_no_baptism",
  "baptized_inactive",
  "baptized_active",
  "etc",
];

type SubmitState = "idle" | "submitting" | "done";

export function NewFamilyForm() {
  const [consent, setConsent] = useState(false);
  const [visitPaths, setVisitPaths] = useState<NewFamilyVisitPath[]>([]);
  const [visitPathsEtc, setVisitPathsEtc] = useState("");
  const [faithStatus, setFaithStatus] = useState<NewFamilyFaithStatus | "">("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<NewFamilyGender | "">("");
  const [birth, setBirth] = useState("");
  const [phone1, setPhone1] = useState("010");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");
  const [region, setRegion] = useState("");
  const [churchHistory, setChurchHistory] = useState<NewFamilyChurchHistory | "">("");
  const [churchHistoryEtc, setChurchHistoryEtc] = useState("");
  const [message, setMessage] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");

  function toggleVisitPath(key: NewFamilyVisitPath) {
    setVisitPaths((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setError("개인정보 수집 및 이용에 동의해 주세요.");
      return;
    }
    if (visitPaths.length === 0) {
      setError("방문 경로를 한 가지 이상 선택해 주세요.");
      return;
    }
    if (visitPaths.includes("etc") && !visitPathsEtc.trim()) {
      setError("방문 경로 '기타'에 직접 입력해 주세요.");
      return;
    }
    if (!faithStatus) {
      setError("예수님 영접 여부를 선택해 주세요.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!gender) {
      setError("성별을 선택해 주세요.");
      return;
    }
    if (!birth.trim()) {
      setError("생년월일을 입력해 주세요.");
      return;
    }
    const phone = `${phone1}-${phone2}-${phone3}`;
    if (!/^010-\d{3,4}-\d{4}$/.test(phone)) {
      setError("연락처를 010-XXXX-XXXX 형식으로 입력해 주세요.");
      return;
    }
    if (!churchHistory) {
      setError("신앙생활 여부를 선택해 주세요.");
      return;
    }
    if (churchHistory === "etc" && !churchHistoryEtc.trim()) {
      setError("신앙생활 '기타'에 직접 입력해 주세요.");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch("/api/new-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitPaths,
          visitPathsEtc: visitPaths.includes("etc") ? visitPathsEtc.trim() : undefined,
          faithStatus,
          name: name.trim(),
          gender,
          birth: birth.trim(),
          phone,
          region: region.trim() || undefined,
          churchHistory,
          churchHistoryEtc:
            churchHistory === "etc" ? churchHistoryEtc.trim() : undefined,
          message: message.trim() || undefined,
          privacyConsent: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "등록에 실패했습니다.");
        setState("idle");
        return;
      }
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-green-100 bg-white p-10 text-center shadow-sm">
        <CheckCircle2
          size={56}
          className="mx-auto mb-4 text-green-500"
          aria-hidden
        />
        <h2 className="text-xl font-semibold text-gray-900">
          등록이 완료되었습니다.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          새가족부에서 곧 입력하신 연락처로 안내드리겠습니다.
          <br />
          명성비전교회를 찾아주셔서 감사합니다.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-8"
    >
      <Section title="개인정보 수집 및 이용 동의" required>
        <div className="h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
          {PRIVACY_POLICY_TEXT}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            <strong className="font-semibold">[필수]</strong> 개인정보 수집 및
            이용에 동의합니다.
          </span>
        </label>
      </Section>

      <Section title="1. 본 페이지 방문 경로 (복수선택)" required>
        <p className="mb-3 text-sm text-gray-500">
          본 페이지에 방문하기까지 어떤 경로로 오셨는지를 체크해 주시기 바랍니다.
        </p>
        <div className="space-y-2">
          {VISIT_PATH_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={visitPaths.includes(key)}
                onChange={() => toggleVisitPath(key)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {VISIT_PATH_LABELS[key]}
            </label>
          ))}
        </div>
        {visitPaths.includes("etc") && (
          <input
            type="text"
            value={visitPathsEtc}
            onChange={(e) => setVisitPathsEtc(e.target.value)}
            maxLength={200}
            placeholder="직접 입력"
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        )}
      </Section>

      <Section title="2. 예수님을 주님으로 영접하셨나요?" required>
        <div className="space-y-2">
          {FAITH_STATUS_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
            >
              <input
                type="radio"
                name="faithStatus"
                checked={faithStatus === key}
                onChange={() => setFaithStatus(key)}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {FAITH_STATUS_LABELS[key]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="3. 이름" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </Section>

      <Section title="4. 성별" required>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="gender"
              checked={gender === "male"}
              onChange={() => setGender("male")}
              className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            남성
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="gender"
              checked={gender === "female"}
              onChange={() => setGender("female")}
              className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            여성
          </label>
        </div>
      </Section>

      <Section title="5. 생년월일" required>
        <p className="mb-3 text-sm text-gray-500">
          예: 2001년 1월 1일생일 경우 &quot;010101&quot; 이라고 작성해 주세요.
          (혹시 음력 생일일 경우 &quot;음력 010101&quot;이라고 작성해 주세요.)
        </p>
        <input
          type="text"
          value={birth}
          onChange={(e) => setBirth(e.target.value)}
          maxLength={40}
          required
          placeholder="예: 010101 또는 음력 010101"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </Section>

      <Section title="6. 연락처" required>
        <p className="mb-3 text-sm text-gray-500">
          새가족 등록 안내를 받으실 연락처를 입력해주세요.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            value={phone1}
            onChange={(e) => setPhone1(e.target.value.replace(/\D/g, "").slice(0, 3))}
            maxLength={3}
            inputMode="numeric"
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm tabular-nums focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="tel"
            value={phone2}
            onChange={(e) => setPhone2(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            inputMode="numeric"
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm tabular-nums focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="tel"
            value={phone3}
            onChange={(e) => setPhone3(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            inputMode="numeric"
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm tabular-nums focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </Section>

      <Section title="7. 현재 살고있는 지역">
        <input
          type="text"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          maxLength={100}
          placeholder="예: 서울 동작구 사당동"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </Section>

      <Section title="8. 신앙생활 여부" required>
        <div className="space-y-2">
          {CHURCH_HISTORY_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2 text-sm text-gray-700"
            >
              <input
                type="radio"
                name="churchHistory"
                checked={churchHistory === key}
                onChange={() => setChurchHistory(key)}
                className="mt-0.5 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {CHURCH_HISTORY_LABELS[key]}
            </label>
          ))}
        </div>
        {churchHistory === "etc" && (
          <input
            type="text"
            value={churchHistoryEtc}
            onChange={(e) => setChurchHistoryEtc(e.target.value)}
            maxLength={200}
            placeholder="직접 입력"
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        )}
      </Section>

      <Section title="9. 질문이나 하고싶은 말씀이 있으면 편하게 말씀해 주세요.">
        <p className="mb-3 text-sm text-gray-500">
          이 문항은 답변을 하지 않으셔도 됩니다.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {message.length} / 2000
        </p>
      </Section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "submitting" && <Loader2 size={18} className="animate-spin" />}
        등록 신청
      </button>
    </form>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-1 text-base font-semibold text-gray-900">
        {title}
        {required && <span className="text-red-500">*</span>}
      </h3>
      {children}
    </section>
  );
}
