import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseLesson from "@/components/ai-course/lesson/CourseLesson";
import { courseLessons, getCourseLesson } from "@/components/ai-course/lesson/course-content";

type Props = { params: Promise<{ week: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return courseLessons.map(lesson => ({ week: `week-${lesson.week}` }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { week } = await params;
  const lesson = getCourseLesson(week);
  if (!lesson) notFound();
  return {
    title: `AI 활용 ${lesson.week}강 · ${lesson.title}`,
    description: lesson.description,
    alternates: { canonical: `https://www.msvch.org/ai-course/week-${lesson.week}` },
    robots: { index: false, follow: false },
  };
}

export default async function WeekPage({ params }: Props) {
  const { week } = await params;
  const lesson = getCourseLesson(week);
  if (!lesson) notFound();
  return <CourseLesson lesson={lesson} />;
}
