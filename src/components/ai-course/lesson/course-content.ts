import type { CourseLesson } from "./course-types";
import { lessonOne } from "./week-one";
import { weeksTwoToFour } from "./weeks-two-to-four";
import { weeksFiveToEight } from "./weeks-five-to-eight";

export const courseLessons: readonly CourseLesson[] = [...weeksTwoToFour, ...weeksFiveToEight];

export const courseChapters = [
  { week: 1, title: lessonOne.title, description: lessonOne.description, outcome: lessonOne.outcome, slideCount: lessonOne.slides.length },
  ...courseLessons.map(lesson => ({ week: lesson.week, title: lesson.title, description: lesson.description, outcome: lesson.outcome, slideCount: lesson.slides.length })),
];

export function getCourseLesson(slug: string): CourseLesson | undefined {
  return courseLessons.find(lesson => slug === `week-${lesson.week}`);
}
