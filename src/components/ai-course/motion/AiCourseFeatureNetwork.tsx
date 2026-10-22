"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAnimate } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";
import styles from "./ai-course-motion.module.css";

type Geometry = { width: number; height: number; paths: string[] };
export default function AiCourseFeatureNetwork({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate<SVGSVGElement>();
  const [geometry, setGeometry] = useState<Geometry>({ width: 1, height: 1, paths: [] });
  const [inView, setInView] = useState(false);
  const played = useRef(false);
  const { mode, documentVisible } = useAiCourseMotion();
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      const points = Array.from(node.querySelectorAll<HTMLElement>("[data-ai-feature] [data-ai-icon]")).map((icon) => {
        const rect = icon.getBoundingClientRect();
        return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2, visible: rect.width > 0 && rect.height > 0 };
      }).filter((point) => point.visible);
      const rows: typeof points[] = [];
      points.forEach((point) => { const row = rows.find((group) => Math.abs(group[0].y - point.y) < 3); if (row) row.push(point); else rows.push([point]); });
      const paths: string[] = [];
      rows.forEach((row, index) => {
        row.slice(1).forEach((point, column) => paths.push(`M${row[column].x},${row[column].y}H${point.x}`));
        if (index > 0) row.forEach((point) => { const above = rows[index - 1].reduce((best, item) => Math.abs(item.x - point.x) < Math.abs(best.x - point.x) ? item : best); paths.push(`M${above.x},${above.y}V${(above.y + point.y) / 2}H${point.x}V${point.y}`); });
      });
      setGeometry({ width: Math.max(1, box.width), height: Math.max(1, box.height), paths });
    };
    const frame = requestAnimationFrame(measure);
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    resize?.observe(node); node.querySelectorAll("[data-ai-feature]").forEach((card) => resize?.observe(card));
    const view = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 }) : undefined;
    view?.observe(node); window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); resize?.disconnect(); view?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (!scope.current || !geometry.paths.length || !inView || mode !== "animated" || !documentVisible || played.current) return;
    played.current = true;
    const paths = Array.from(scope.current.querySelectorAll("path"));
    const playback = animate(paths, { strokeDashoffset: [1, 0], opacity: [0.15, 0.7] }, { duration: 1.5, ease: "easeOut" });
    return () => { playback.stop(); paths.forEach((path) => { path.style.strokeDashoffset = "0"; path.style.opacity = "0.7"; }); };
  }, [animate, documentVisible, geometry, inView, mode, scope]);
  return <div ref={root} className={styles.network}>
    <svg ref={scope} aria-hidden="true" className={styles.networkLines} viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none">{geometry.paths.map((path, index) => <path key={index} d={path} pathLength={1} />)}</svg>
    <div className={styles.featureGrid}>{children}</div>
  </div>;
}
