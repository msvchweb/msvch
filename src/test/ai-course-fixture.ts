export function aiCourseFixture() {
  return {
    requestId: "b35b1bde-d5c3-44d6-9dda-ec2a7c013327",
    name: "테스트 신청자",
    phone: "01012345678",
    applicationContext: {
      useCases: ["work"], laptopReadiness: "ready", os: "windows", mobileOs: "android",
    },
    surveyVersion: "ai-course-v1",
    surveyAnswers: {
      usageFrequency: "none", tools: ["none"],
      capabilities: {
        prompting: "new", files: "new", verification: "new", instructions: "new",
        integrations: "new", skills: "new", scheduling: "new", execution_location: "new", remote: "new",
      },
      websiteExperience: "none", learningGoals: ["documents"], repetitiveTask: "수업에서 찾아보고 싶어요",
    },
    privacyConsent: true,
    privacyPolicyVersion: "ai-course-privacy-v1",
  };
}
