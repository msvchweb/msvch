import type { LessonSlide } from "./LessonDeck";

export type LessonBlock =
  | { kind: "cards"; items: readonly { title: string; body: string }[] }
  | { kind: "steps"; items: readonly string[] }
  | { kind: "prompt"; text: string; excerpt: string; hint?: string }
  | { kind: "compare"; left: { title: string; items: readonly string[] }; right: { title: string; items: readonly string[] } }
  | { kind: "checklist"; items: readonly string[] }
  | { kind: "resources"; items: readonly { title: string; description: string; href: string; filename?: string }[] };

export type TeachingSlide = LessonSlide & {
  lead?: string;
  scene: number;
  blocks: readonly LessonBlock[];
};

export type CourseLesson = {
  week: number;
  title: string;
  description: string;
  outcome: string;
  slides: readonly TeachingSlide[];
  sources: readonly { label: string; url: string }[];
};
