import type { z } from "zod";
import type { AiCourseSubmissionSchema } from "@/lib/ai-course";

export type AiCourseSubmissionInput = z.input<typeof AiCourseSubmissionSchema>;
export type AiCourseSubmission = z.output<typeof AiCourseSubmissionSchema>;
export type CapabilityKey = keyof AiCourseSubmission["surveyAnswers"]["capabilities"];
export type ExperienceLevel = AiCourseSubmission["surveyAnswers"]["capabilities"][CapabilityKey];
export type AiCourseApplicationSummary = {
  id: string; name: string; phone: string; createdAt: string;
  learningGoals: AiCourseSubmission["surveyAnswers"]["learningGoals"];
};
export type AiCourseApplicationList = {
  items: AiCourseApplicationSummary[]; total: number; page: number; pageSize: 25;
};
export type AiCourseApplicationDetail = AiCourseApplicationSummary & {
  applicationContext: AiCourseSubmission["applicationContext"];
  surveyAnswers: AiCourseSubmission["surveyAnswers"];
  surveyVersion: string; privacyConsentedAt: string; privacyPolicyVersion: string;
};
