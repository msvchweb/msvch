"use client";
import { Children, useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";
import { motion, useScroll } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";
import styles from "./ai-course-motion.module.css";

export default function AiCourseRoadmap({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { mode, documentVisible } = useAiCourseMotion();
  const { scrollYProgress } = useScroll({ target: root, offset: ["start center", "end center"] });
  const subscribe = useCallback((notify: () => void) => scrollYProgress.on("change", notify), [scrollYProgress]);
  const active = useSyncExternalStore(subscribe, () => Math.min(5, Math.floor(scrollYProgress.get() * 6)), () => -1);
  return <div ref={root} className={styles.roadmap}>
    <div aria-hidden="true" className={styles.roadTrack}><motion.div className={styles.roadFill} style={{ scaleY: mode === "animated" ? scrollYProgress : 1 }} /></div>
    {Children.toArray(children).map((child, index) => <div key={index} className={styles.roadStep} data-active={mode === "animated" && documentVisible && active === index ? "true" : "false"}><span className={styles.roadDot} aria-hidden="true" />{child}</div>)}
  </div>;
}
