"use client";
import { Children, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";
import styles from "./ai-course-motion.module.css";

export default function AiCourseRoadmap({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { mode, documentVisible } = useAiCourseMotion();
  const [active, setActive] = useState(-1);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start center", "end center"] });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (mode === "animated" && documentVisible) setActive(Math.min(5, Math.floor(progress * 6)));
  });
  return <div ref={root} className={styles.roadmap}>
    <div aria-hidden="true" className={styles.roadTrack}><motion.div className={styles.roadFill} style={{ scaleY: mode === "animated" ? scrollYProgress : 1 }} /></div>
    {Children.toArray(children).map((child, index) => <div key={index} className={styles.roadStep} data-active={mode === "animated" && active === index ? "true" : "false"}><span className={styles.roadDot} aria-hidden="true" />{child}</div>)}
  </div>;
}
