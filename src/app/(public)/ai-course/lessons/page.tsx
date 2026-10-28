import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Download } from "lucide-react";
import { courseChapters } from "@/components/ai-course/lesson/course-content";
import styles from "@/components/ai-course/lesson/course.module.css";

export const metadata: Metadata = {
  title: "AI 활용 수업 · 챕터 선택",
  description: "1강부터 8강까지 AI 활용 수업 슬라이드와 실습 자료를 확인하세요.",
  alternates: { canonical: "https://www.msvch.org/ai-course/lessons" },
  robots: { index: false, follow: false },
};

export default function LessonsPage() {
  return <div className={styles.hub}>
    <header className={styles.hubHeader}><Link href="/ai-course"><ArrowLeft size={17} aria-hidden />강의 소개</Link><span>명성비전교회 · AI 활용 수업</span></header>
    <div className={styles.hubContent}>
      <div className={styles.hubIntro}><div><p className={styles.kicker}><BookOpen size={17} aria-hidden />1~8강 수업 자료</p><h1>챕터 선택</h1><p>강의를 선택해 진도에 맞춰 이어갑니다.</p></div><a className={styles.hubDownload} href="/ai-course/materials/student-materials.zip" download="AI활용-실습자료.zip"><Download size={17} aria-hidden />2~8강 실습 자료 받기</a></div>
      <nav aria-label="강의별 수업" className={styles.chapterGrid}>
        {courseChapters.map((chapter, index) => <Link key={chapter.week} href={`/ai-course/week-${chapter.week}`} prefetch={false} aria-label={`${chapter.week}강 ${chapter.title}`} className={styles.chapterCard} style={{ "--order": index } as CSSProperties}>
          <div className={styles.cardTop}><span className={styles.weekNumber}>{String(chapter.week).padStart(2, "0")}<small>강</small></span><span className={styles.cardMeta}>{chapter.slideCount}장</span></div>
          <h2>{chapter.title}</h2><p>{chapter.outcome}</p><div className={styles.cardAction}><span>수업 열기</span><ArrowUpRight size={20} aria-hidden /></div>
        </Link>)}
      </nav>
      <p className={styles.hubHint}>방향키로 이동할 수 있습니다. 강의가 한 번에 끝나지 않으면 현재 슬라이드 주소를 저장하고 다음 수업에서 이어갑니다.</p>
      <div className={styles.firstWeekMaterials}><span>1강 전용 자료</span><a href="/ai-course/lesson-1/materials/student-kit.zip" download="AI활용-1강-실습자료.zip">실습지와 원본 자료 받기</a></div>
    </div>
  </div>;
}
