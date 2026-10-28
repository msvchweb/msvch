import { BookOpen, Check, Download, FileText } from "lucide-react";
import LessonDeck from "./LessonDeck";
import LessonMotion from "./LessonMotion";
import CopyLessonPrompt from "./CopyLessonPrompt";
import type { CourseLesson as CourseLessonData, LessonBlock } from "./course-types";
import styles from "./lesson.module.css";
import courseStyles from "./course.module.css";

function Block({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case "cards": return <div className={block.items.length <= 2 ? styles.twoColumns : block.items.length === 3 ? styles.threeColumns : styles.fourGrid}>
      {block.items.map(item => <section key={item.title} className={`${styles.outcome} ${courseStyles.conceptCard}`}><h2>{item.title}</h2><p>{item.body}</p></section>)}
    </div>;
    case "steps": return <ol className={styles.steps}>{block.items.map(item => <li key={item}>{item}</li>)}</ol>;
    case "checklist": return <ul className={styles.checkList}>{block.items.map(item => <li key={item}><Check size={26} aria-hidden />{item}</li>)}</ul>;
    case "prompt": return <><blockquote className={styles.promptExcerpt}>{block.excerpt}</blockquote><CopyLessonPrompt text={block.text} /><p className={styles.caption}>{block.hint ?? "화면은 요약입니다. 실습에는 전체 요청문을 복사해 사용하세요."}</p></>;
    case "compare": return <div className={styles.twoColumns}>{[block.left, block.right].map(side => <section className={`${styles.outcome} ${courseStyles.comparisonCard}`} key={side.title}><h2>{side.title}</h2><ul>{side.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</div>;
    case "resources": return <div className={`${block.items.length <= 2 ? styles.twoColumns : block.items.length === 3 ? styles.threeColumns : styles.fourGrid} ${courseStyles.resourceGrid}`}>{block.items.map(item => {
      const external = item.href.startsWith("https://");
      return <section className={`${styles.file} ${courseStyles.resourceCard}`} key={item.href}><FileText size={30} aria-hidden /><h2>{item.title}</h2><p>{item.description}</p><a href={item.href} download={external ? undefined : item.filename ?? true} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={styles.action}>{external ? <BookOpen size={17} aria-hidden /> : <Download size={17} aria-hidden />}{external ? "안내 보기" : "자료 받기"}</a></section>;
    })}</div>;
  }
}

export default function CourseLesson({ lesson }: { lesson: CourseLessonData }) {
  return <LessonDeck key={lesson.week} week={lesson.week} slides={lesson.slides}>
    {lesson.slides.map((slide, index) => <div key={slide.title} className={`${styles.canvas} ${courseStyles.lessonCanvas} ${index === 0 ? styles.hero : ""}`}>
      <LessonMotion index={slide.scene} />
      <p className={styles.eyebrow}>{index === 0 ? `AI 활용 ${lesson.week}강` : slide.phase}</p>
      <h1 className={styles.title} id={`lesson-title-${index}`} style={lesson.week === 8 && index === 0 ? { color: "#f97316" } : undefined}>{slide.title}</h1>
      {slide.lead && <p className={styles.lead}>{slide.lead}</p>}
      <div className={`${styles.content} ${courseStyles.blocks}`}>{slide.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
        {index === lesson.slides.length - 1 && <div className={courseStyles.sources}><span>기능 안내</span>{lesson.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</div>}
      </div>
    </div>)}
  </LessonDeck>;
}
