import React from "react";
import { CAPABILITIES, EXPERIENCE_OPTIONS, FREQUENCY_OPTIONS, LAPTOP_OPTIONS, LEARNING_GOALS, MOBILE_OPTIONS, OS_OPTIONS, TOOL_OPTIONS, USE_CASES, WEBSITE_OPTIONS, choiceLabel } from "@/lib/ai-course";
import type { AiCourseSubmission } from "@/types/ai-course";

export default function ApplicationDetails({ application }: { application: Pick<AiCourseSubmission, "name" | "phone" | "applicationContext" | "surveyAnswers"> }) {
  const { name, phone, applicationContext: context, surveyAnswers: answers } = application;
  const rows = [
    ["이름", name], ["휴대전화 번호", phone],
    ["활용 분야", context.useCases.map((v) => choiceLabel(USE_CASES, v)).join(", ") + (context.useCasesOther ? ` · ${context.useCasesOther}` : "")],
    ["노트북 준비", choiceLabel(LAPTOP_OPTIONS, context.laptopReadiness)],
    ["운영체제", choiceLabel(OS_OPTIONS, context.os)], ["스마트폰", choiceLabel(MOBILE_OPTIONS, context.mobileOs)],
    ["도움이 필요한 부분", context.supportRequest || "없음"],
    ["최근 한 달 AI 사용", choiceLabel(FREQUENCY_OPTIONS, answers.usageFrequency)],
    ["사용해 본 도구", answers.tools.map((v) => choiceLabel(TOOL_OPTIONS, v)).join(", ") + (answers.toolsOther ? ` · ${answers.toolsOther}` : "")],
    ...CAPABILITIES.map((q) => [q.label, choiceLabel(EXPERIENCE_OPTIONS, answers.capabilities[q.value])]),
    ["앱 제작 경험", choiceLabel(WEBSITE_OPTIONS, answers.websiteExperience) + (answers.websiteExperienceOther ? ` · ${answers.websiteExperienceOther}` : "")],
    ["배우고 싶은 것", answers.learningGoals.map((v) => choiceLabel(LEARNING_GOALS, v)).join(" / ")],
    ["줄이고 싶은 반복 업무", answers.repetitiveTask],
  ];
  return <dl className="divide-y divide-gray-100">
    {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-5">
      <dt className="text-sm leading-relaxed text-gray-500">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-church-dark">{value}</dd>
    </div>)}
  </dl>;
}
