"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useAnimate } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";

export default function AiCourseReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const played = useRef(false);
  const { mode, documentVisible } = useAiCourseMotion();
  useEffect(() => {
    const node = scope.current;
    if (!node || mode !== "animated" || !documentVisible || played.current || typeof IntersectionObserver === "undefined") return;
    let playback: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || played.current) return;
      played.current = true;
      playback = animate(node, { opacity: [0.7, 1], y: [18, 0] }, { duration: 0.45, delay, ease: "easeOut" });
      observer.disconnect();
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => { observer.disconnect(); playback?.stop(); node.style.removeProperty("transform"); node.style.removeProperty("opacity"); };
  }, [mode, documentVisible, delay, scope, animate]);
  return <div ref={scope}>{children}</div>;
}
