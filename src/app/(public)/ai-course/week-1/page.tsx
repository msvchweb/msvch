import type { Metadata } from "next";
import CourseLesson from "@/components/ai-course/lesson/CourseLesson";
import { lessonOne } from "@/components/ai-course/lesson/week-one";

export const metadata: Metadata = {
  title: `AI 활용 1강 · ${lessonOne.title}`,
  description: lessonOne.description,
  alternates: { canonical: "https://www.msvch.org/ai-course/week-1" },
  robots: { index: false, follow: false },
};

export default function FirstLessonPage() {
  return <CourseLesson lesson={lessonOne} />;
}
