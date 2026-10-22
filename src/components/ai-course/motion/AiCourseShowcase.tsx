"use client";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";
import styles from "./ai-course-motion.module.css";

function ShowcaseCard({ children, index, progress, sticky }: { children: ReactNode; index: number; progress: MotionValue<number>; sticky: boolean }) {
  const scale = useTransform(progress, [index / 3, (index + 1) / 3], [1, 0.95]);
  return <motion.div className={styles.showcaseCard} data-sticky={sticky ? "true" : "false"} style={{ scale: sticky ? scale : 1, zIndex: index + 1 }}>{children}</motion.div>;
}
export default function AiCourseShowcase({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { mode, documentVisible } = useAiCourseMotion();
  const [fits, setFits] = useState(false);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start 96px", "end 96px"] });
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const height = Math.max(0, ...Array.from(node.children).map((child) => (child as HTMLElement).offsetHeight));
      setFits(window.innerWidth >= 1024 && window.innerHeight >= 760 && height + 128 <= window.innerHeight);
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    observer?.observe(node); Array.from(node.children).forEach((child) => observer?.observe(child));
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={root} className={styles.showcase}>{Children.toArray(children).map((child, index) => <ShowcaseCard key={index} index={index} progress={scrollYProgress} sticky={fits && mode === "animated" && documentVisible}>{child}</ShowcaseCard>)}</div>;
}
