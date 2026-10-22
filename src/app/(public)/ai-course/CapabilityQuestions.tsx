"use client";
import React from "react";
import { CAPABILITIES, EXPERIENCE_OPTIONS, type Choice } from "@/lib/ai-course";
import type { CapabilityKey, ExperienceLevel } from "@/types/ai-course";

export function ChoiceQuestion({ name, title, options, value, onChange, error, multiple = false, max }: {
  name: string; title: string; options: readonly Choice[]; value: string | string[];
  onChange: (value: string) => void; error?: string; multiple?: boolean; max?: number;
}) {
  return <fieldset data-field={name} aria-describedby={error ? `${name}-error` : undefined} className="min-w-0 space-y-3">
    <legend className="mb-3 text-base font-semibold leading-relaxed text-church-dark">{title}</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const checked = Array.isArray(value) ? value.includes(option.value) : value === option.value;
        const disabled = multiple && !!max && Array.isArray(value) && value.length >= max && !checked;
        return <label key={option.value} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-relaxed transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary-500 ${checked ? "border-primary-800 bg-primary-50 text-primary-900" : "border-gray-200 bg-white text-gray-700"} ${disabled ? "opacity-50" : "hover:border-primary-300"}`}>
          <input type={multiple ? "checkbox" : "radio"} name={name} value={option.value} checked={checked} disabled={disabled} onChange={() => onChange(option.value)} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} className="mt-1 h-4 w-4 shrink-0 accent-primary-900" />
          <span>{option.label}</span>
        </label>;
      })}
    </div>
    {error && <p id={`${name}-error`} className="text-sm text-red-700">{error}</p>}
  </fieldset>;
}
export default function CapabilityQuestions({ value, onChange, errors }: {
  value: Partial<Record<CapabilityKey, ExperienceLevel>>;
  onChange: (value: Partial<Record<CapabilityKey, ExperienceLevel>>) => void;
  errors: Partial<Record<CapabilityKey, string>>;
}) {
  return <div className="space-y-5">
    <p className="text-sm leading-relaxed text-gray-600">각 항목에서 직접 해본 경험에 가장 가까운 답을 골라 주세요. 처음 접하는 기능이 있어도 괜찮습니다.</p>
    {CAPABILITIES.map((question, index) => <div key={question.value} className="rounded-2xl bg-church-cream p-4 sm:p-5">
      <span aria-hidden="true" className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-church-gold-light text-xs font-bold text-primary-900">{String.fromCharCode(65 + index)}</span>
      <ChoiceQuestion name={`surveyAnswers.capabilities.${question.value}`} title={question.label} options={EXPERIENCE_OPTIONS} value={value[question.value] ?? ""} onChange={(answer) => onChange({ ...value, [question.value]: answer as ExperienceLevel })} error={errors[question.value]} />
    </div>)}
  </div>;
}
