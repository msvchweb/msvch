import { z } from "zod";
import { normalizeKoreanPhone } from "@/lib/validation";

export const AI_COURSE_PATH = "/ai-course";
export const AI_COURSE_URL = `https://www.msvch.org${AI_COURSE_PATH}`;
export const AI_COURSE_ADMIN_PATH = "/admin/ai-course-applications";
export const AI_COURSE_SURVEY_VERSION = "ai-course-v1";
export const AI_COURSE_PRIVACY_POLICY_VERSION = "ai-course-privacy-v1";

export const USE_CASES = [
  { value: "work", label: "직장 업무" }, { value: "business", label: "사업·가게 운영" },
  { value: "freelance", label: "프리랜서·개인 작업" }, { value: "daily_life", label: "가정·일상" },
  { value: "church_group", label: "교회·모임 활동" }, { value: "other", label: "기타" },
] as const;
export const LAPTOP_OPTIONS = [
  { value: "ready", label: "개인 노트북을 가져올 수 있어요" },
  { value: "needs_help", label: "기기 준비에 대한 안내가 필요해요" },
] as const;
export const OS_OPTIONS = [
  { value: "windows", label: "Windows" }, { value: "mac", label: "Mac" },
  { value: "other", label: "기타" }, { value: "unknown", label: "잘 모르겠어요" },
] as const;
export const MOBILE_OPTIONS = [
  { value: "ios", label: "iPhone" }, { value: "android", label: "Android" },
  { value: "none", label: "사용할 스마트폰이 없어요" },
] as const;
export const FREQUENCY_OPTIONS = [
  { value: "none", label: "사용하지 않았어요" }, { value: "once_or_twice", label: "한두 번 사용했어요" },
  { value: "weekly_1_2", label: "일주일에 1~2일 정도 사용했어요" },
  { value: "weekly_3_plus", label: "일주일에 3일 이상 사용했어요" },
] as const;
export const TOOL_OPTIONS = [
  { value: "chatgpt", label: "ChatGPT" }, { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude" }, { value: "gemini", label: "Gemini" },
  { value: "other", label: "기타" }, { value: "none", label: "아직 직접 사용한 도구가 없어요" },
] as const;
export const CAPABILITIES = [
  { value: "prompting", label: "AI에게 목적, 참고 자료, 원하는 결과 형식을 함께 설명할 수 있어요." },
  { value: "files", label: "문서나 표 파일을 주고 필요한 결과물을 만들어 본 적이 있어요." },
  { value: "verification", label: "AI 결과를 원자료와 비교하고, 잘못된 부분을 구체적으로 수정 요청할 수 있어요." },
  { value: "instructions", label: "프로젝트나 지침을 설정해 다음 작업에도 같은 기준을 사용할 수 있어요." },
  { value: "integrations", label: "플러그인이나 외부 앱을 연결해 그곳의 자료를 작업에 활용해 봤어요." },
  { value: "skills", label: "반복할 작업을 스킬로 저장하거나, 준비된 스킬을 실행해 봤어요." },
  { value: "scheduling", label: "AI 작업을 예약하고 실제 실행 결과를 확인해 봤어요." },
  { value: "execution_location", label: "작업이 내 컴퓨터에서 실행되는지 클라우드에서 실행되는지, 결과 파일이 어디 있는지 확인할 수 있어요." },
  { value: "remote", label: "휴대폰을 내 컴퓨터에 원격 연결해 AI 작업을 이어가 봤어요." },
] as const;
export const EXPERIENCE_OPTIONS = [
  { value: "new", label: "처음 접해요" }, { value: "aware", label: "무엇인지는 알지만 해본 적은 없어요" },
  { value: "guided", label: "안내를 보며 해본 적이 있어요" }, { value: "independent", label: "혼자서 해본 적이 있어요" },
] as const;
export const WEBSITE_OPTIONS = [
  { value: "none", label: "만들어 본 적이 없어요" },
  { value: "builder", label: "홈페이지 제작 도구로 내용을 입력하거나 수정해 봤어요" },
  { value: "ai_local", label: "AI로 페이지를 만들어 봤지만 인터넷에 배포하지는 못했어요" },
  { value: "deployed", label: "GitHub·Vercel 등을 이용해 배포하고 수정해 본 적이 있어요" },
  { value: "other", label: "위 선택지로 설명하기 어려워요" },
] as const;
export const LEARNING_GOALS = [
  { value: "documents", label: "내 자료로 문서와 업무 정리하기" },
  { value: "instructions", label: "내 기준에 맞는 프로젝트와 지침 만들기" },
  { value: "integrations", label: "플러그인·외부 앱 연결해서 쓰기" },
  { value: "automation", label: "반복 업무를 스킬과 예약으로 처리하기" },
  { value: "remote", label: "휴대폰에서 내 컴퓨터의 작업 이어가기" },
  { value: "website", label: "내 홈페이지 만들고 직접 고치기" },
  { value: "explore", label: "어떤 활용이 나에게 맞는지 찾아보기" },
] as const;
export type Choice = { readonly value: string; readonly label: string };
export function choiceLabel(options: readonly Choice[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}
function choice<const T extends readonly Choice[]>(options: T) {
  return z.enum(options.map((option) => option.value) as T[number]["value"][], { error: "답변을 선택해 주세요." });
}
function multiple<const T extends readonly Choice[]>(options: T, max = options.length) {
  return z.array(choice(options)).min(1, "하나 이상 선택해 주세요.").max(max, `최대 ${max}개까지 선택해 주세요.`)
    .refine((items) => new Set(items).size === items.length, "같은 항목을 중복 선택할 수 없습니다.")
    .transform((items) => options.map((o) => o.value as T[number]["value"]).filter((v) => items.includes(v)));
}
const optionalText = (max: number) => z.string().trim().max(max, `${max}자 이내로 작성해 주세요.`).optional();
const level = choice(EXPERIENCE_OPTIONS);
export const ApplicationContextSchema = z.strictObject({
  useCases: multiple(USE_CASES), useCasesOther: optionalText(200),
  laptopReadiness: choice(LAPTOP_OPTIONS), os: choice(OS_OPTIONS), mobileOs: choice(MOBILE_OPTIONS),
  supportRequest: optionalText(1000),
}).superRefine((data, ctx) => {
  if (data.useCases.includes("other") && !data.useCasesOther) ctx.addIssue({ code: "custom", path: ["useCasesOther"], message: "기타 활용 분야를 적어 주세요." });
}).transform(({ useCasesOther, ...data }) => ({ ...data, ...(data.useCases.includes("other") ? { useCasesOther } : {}) }));
const experienceFields = {
  usageFrequency: choice(FREQUENCY_OPTIONS), tools: multiple(TOOL_OPTIONS), toolsOther: optionalText(200),
  capabilities: z.strictObject({
    prompting: level, files: level, verification: level, instructions: level, integrations: level,
    skills: level, scheduling: level, execution_location: level, remote: level,
  }),
};
function refineExperience(data: { tools: string[]; toolsOther?: string }, ctx: z.RefinementCtx) {
  if (data.tools.includes("none") && data.tools.length > 1) ctx.addIssue({ code: "custom", path: ["tools"], message: "사용한 도구가 없다는 답변은 단독으로 선택해 주세요." });
  if (data.tools.includes("other") && !data.toolsOther) ctx.addIssue({ code: "custom", path: ["toolsOther"], message: "사용한 도구 이름을 적어 주세요." });
}
export const AiCourseExperienceSchema = z.strictObject(experienceFields).superRefine(refineExperience);
export const SurveyAnswersSchema = z.strictObject({
  ...experienceFields,
  websiteExperience: choice(WEBSITE_OPTIONS), websiteExperienceOther: optionalText(200),
  learningGoals: multiple(LEARNING_GOALS, 2),
  repetitiveTask: z.string().trim().min(1, "줄이고 싶은 반복 업무를 적어 주세요.").max(500, "500자 이내로 작성해 주세요."),
}).superRefine(refineExperience).transform(({ toolsOther, websiteExperienceOther, ...data }) => ({
  ...data, ...(data.tools.includes("other") ? { toolsOther } : {}),
  ...(data.websiteExperience === "other" && websiteExperienceOther ? { websiteExperienceOther } : {}),
}));
export const AiCourseSubmissionSchema = z.strictObject({
  requestId: z.uuid(), name: z.string().trim().min(1, "이름을 적어 주세요.").max(50, "이름은 50자 이내로 적어 주세요."),
  phone: z.string().min(1, "휴대전화 번호를 적어 주세요.").max(30, "휴대전화 번호를 확인해 주세요.").transform((value, ctx) => {
    const normalized = normalizeKoreanPhone(value);
    if (!normalized) { ctx.addIssue({ code: "custom", message: "010으로 시작하는 휴대전화 번호를 확인해 주세요." }); return z.NEVER; }
    return normalized;
  }),
  applicationContext: ApplicationContextSchema,
  surveyVersion: z.literal(AI_COURSE_SURVEY_VERSION), surveyAnswers: SurveyAnswersSchema,
  privacyConsent: z.literal(true, { error: "개인정보 수집·이용에 동의해 주세요." }),
  privacyPolicyVersion: z.literal(AI_COURSE_PRIVACY_POLICY_VERSION),
});
export function parseAiCourseSubmission(input: unknown) { return AiCourseSubmissionSchema.parse(input); }
export function aiCourseFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
  return fields;
}
