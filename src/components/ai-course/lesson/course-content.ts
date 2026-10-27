import type { CourseLesson } from "./course-types";
import { weekOneSlides } from "./week-one";
import { weeksTwoToFour } from "./weeks-two-to-four";
import { weeksFiveToEight } from "./weeks-five-to-eight";

export const courseLessons: readonly CourseLesson[] = [...weeksTwoToFour, ...weeksFiveToEight];

export const courseChapters = [
  { week: 1, title: "준비표와 안내문 만들기", description: "파일을 첨부하고 결과를 확인·수정해 저장합니다.", outcome: "원문과 비교하고 저장한 준비표와 안내문", slideCount: weekOneSlides.length },
  ...courseLessons.map(lesson => ({ week: lesson.week, title: lesson.title, description: lesson.description, outcome: lesson.outcome, slideCount: lesson.slides.length })),
];

export function getCourseLesson(slug: string): CourseLesson | undefined {
  return courseLessons.find(lesson => slug === `week-${lesson.week}`);
}
