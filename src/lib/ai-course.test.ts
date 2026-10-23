import { describe, expect, it } from "vitest";
import { AiCourseSubmissionSchema, parseAiCourseSubmission } from "./ai-course";
import { aiCourseFixture } from "@/test/ai-course-fixture";

describe("AI course submission contract", () => {
  it("accepts study alongside existing use cases without changing stored keys", () => {
    const input = aiCourseFixture();
    const parsed = parseAiCourseSubmission({ ...input, applicationContext: { ...input.applicationContext, useCases: ["work", "study"] } });
    expect(parsed.applicationContext.useCases).toEqual(["study", "work"]);
    expect(parsed.surveyVersion).toBe(input.surveyVersion);
  });
  it.each(["01012345678", "+82 10 1234 5678", "010-1234-5678"])("normalizes %s and accepts all-new experience", (phone) => {
    expect(parseAiCourseSubmission({ ...aiCourseFixture(), phone }).phone).toBe("010-1234-5678");
  });
  it("canonicalizes choices, whitespace and unused other descriptions", () => {
    const input = aiCourseFixture();
    input.applicationContext.useCases = ["daily_life", "work"];
    input.surveyAnswers.learningGoals = ["website", "documents"];
    const parsed = parseAiCourseSubmission({ ...input, name: " 이름 ", applicationContext: { ...input.applicationContext, useCasesOther: "stale" } });
    expect(parsed.name).toBe("이름");
    expect(parsed.applicationContext.useCases).toEqual(["work", "daily_life"]);
    expect(parsed.applicationContext).not.toHaveProperty("useCasesOther");
    expect(parsed.surveyAnswers.learningGoals).toEqual(["documents", "website"]);
  });
  it.each([
    { privacyConsent: false }, { privacyPolicyVersion: "old" }, { surveyVersion: "old" },
    { name: "  " }, { name: "가".repeat(51) }, { requestId: "invalid" }, { phone: "0212345678" },
    { unexpected: "ignored?" },
  ])("rejects invalid top-level values %j", (change) => {
    expect(AiCourseSubmissionSchema.safeParse({ ...aiCourseFixture(), ...change }).success).toBe(false);
  });
  it("requires all nine capabilities and rejects unknown nested keys", () => {
    const input = aiCourseFixture();
    const { remote: _remote, ...rest } = input.surveyAnswers.capabilities;
    expect(AiCourseSubmissionSchema.safeParse({ ...input, surveyAnswers: { ...input.surveyAnswers, capabilities: rest } }).success).toBe(false);
    expect(AiCourseSubmissionSchema.safeParse({ ...input, applicationContext: { ...input.applicationContext, extra: true } }).success).toBe(false);
  });
  it.each([
    { tools: ["none", "chatgpt"] }, { tools: ["chatgpt", "chatgpt"] }, { tools: [] },
    { tools: ["other"], toolsOther: " " }, { learningGoals: ["website", "remote", "documents"] },
    { repetitiveTask: " " }, { repetitiveTask: "가".repeat(501) },
  ])("rejects inconsistent or incomplete answers %j", (change) => {
    const input = aiCourseFixture();
    expect(AiCourseSubmissionSchema.safeParse({ ...input, surveyAnswers: { ...input.surveyAnswers, ...change } }).success).toBe(false);
  });
  it("requires other use-case text but permits an undescribed other website experience", () => {
    const input = aiCourseFixture();
    expect(AiCourseSubmissionSchema.safeParse({ ...input, applicationContext: { ...input.applicationContext, useCases: ["other"] } }).success).toBe(false);
    expect(AiCourseSubmissionSchema.safeParse({ ...input, surveyAnswers: { ...input.surveyAnswers, websiteExperience: "other" } }).success).toBe(true);
  });
});
