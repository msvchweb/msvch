"use client";

import { Children, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Expand, Minimize, Pause, Play, Sparkles } from "lucide-react";
import styles from "./lesson.module.css";

export type LessonSlide = { title: string; phase: string; time: string; tone?: "dark" };

function subscribeMotion(notify: () => void) {
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  query?.addEventListener("change", notify);
  document.addEventListener("visibilitychange", notify);
  return () => { query?.removeEventListener("change", notify); document.removeEventListener("visibilitychange", notify); };
}
function readMotionEnvironment() {
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (!query) return "static";
  if (query.matches) return "reduced";
  return document.visibilityState === "hidden" ? "static" : "animated";
}
const serverMotionEnvironment = () => "static";

export default function LessonDeck({ slides, children }: { slides: readonly LessonSlide[]; children: ReactNode }) {
  const [current, setCurrent] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [motionPaused, setMotionPaused] = useState(false);
  const motionEnvironment = useSyncExternalStore(subscribeMotion, readMotionEnvironment, serverMotionEnvironment);
  const reducedMotion = motionEnvironment === "reduced";
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const count = slides.length;
  const move = useCallback((index: number) => {
    const next = Math.max(0, Math.min(count - 1, index));
    setCurrent(next);
    setMessage("");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#slide-${next + 1}`);
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [count]);

  useEffect(() => {
    const restore = () => {
      const match = /^#slide-([1-9]\d*)$/.exec(window.location.hash);
      const index = match ? Number(match[1]) - 1 : 0;
      move(index >= 0 && index < count ? index : 0);
    };
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, [count, move]);

  useEffect(() => {
    const navigate = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], details[open]")) return;
      if (event.key === " " && target?.closest("button, a, summary")) return;
      const next = ["ArrowRight", "PageDown", " "].includes(event.key);
      const previous = ["ArrowLeft", "PageUp"].includes(event.key);
      if (!next && !previous && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      move(event.key === "Home" ? 0 : event.key === "End" ? count - 1 : current + (next ? 1 : -1));
    };
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [count, current, move]);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullscreen() {
    setMessage("");
    try {
      if (document.fullscreenElement === root.current) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else throw new Error("Fullscreen unavailable");
    } catch {
      setMessage("전체화면을 열지 못했어요. 브라우저의 전체화면 기능을 이용해 주세요.");
    }
  }

  return <div ref={root} data-lesson-motion={!motionPaused && motionEnvironment === "animated" ? "animated" : "static"} className={`${styles.deck} ${slides[current].tone === "dark" ? styles.dark : ""}`}>
    <header className={styles.toolbar}>
      <Link href="/ai-course" className={styles.brand} aria-label="AI 강의 소개로 돌아가기"><Sparkles size={21} aria-hidden /><span>명성비전교회 <b>AI 활용 · 1주차</b></span></Link>
      <div className={styles.tools}>
        <label className={styles.srOnly} htmlFor="lesson-slide">슬라이드 선택</label>
        <select id="lesson-slide" value={current} onChange={event => move(Number(event.target.value))} className={styles.jump}>
          {slides.map((slide, index) => <option key={slide.title} value={index}>{String(index + 1).padStart(2, "0")} {slide.title.replace(/\n/g, " ")}</option>)}
        </select>
        <button type="button" className={styles.motionToggle} disabled={reducedMotion} aria-label={reducedMotion ? "동작 줄이기 적용 중" : motionPaused ? "모션 재생" : "모션 멈추기"} aria-pressed={motionPaused || reducedMotion} onClick={() => setMotionPaused(value => !value)}>
          {motionPaused || reducedMotion ? <Play size={17} aria-hidden /> : <Pause size={17} aria-hidden />}<span>{reducedMotion ? "동작 줄이기" : motionPaused ? "모션 재생" : "모션 멈추기"}</span>
        </button>
        <button type="button" className={styles.fullscreen} aria-label={fullscreen ? "전체화면 종료" : "전체화면"} aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? <Minimize size={18} aria-hidden /> : <Expand size={18} aria-hidden />}<span>전체화면</span></button>
      </div>
    </header>
    <div ref={viewport} className={styles.viewport}>
      {Children.toArray(children).map((slide, index) => <article key={index} id={`slide-${index + 1}`} className={styles.slide} hidden={index !== current} aria-labelledby={`lesson-title-${index}`}>{slide}</article>)}
    </div>
    <footer className={styles.controls}>
      <button type="button" aria-label="이전 슬라이드" disabled={current === 0} onClick={() => move(current - 1)} className={styles.previous}><ArrowLeft size={20} aria-hidden /><span>이전</span></button>
      <div className={styles.position}><span className={styles.phase}>{slides[current].phase} <span>{slides[current].time}</span></span><span aria-live="polite" aria-atomic="true"><b>{String(current + 1).padStart(2, "0")}</b><span className={styles.total}> / {String(count).padStart(2, "0")}</span><span className={styles.srOnly}> {slides[current].title}</span></span></div>
      <button type="button" aria-label="다음 슬라이드" disabled={current === count - 1} onClick={() => move(current + 1)} className={styles.next}><span>다음</span><ArrowRight size={20} aria-hidden /></button>
      <div className={styles.progress} role="progressbar" aria-label="슬라이드 진행" aria-valuemin={1} aria-valuemax={count} aria-valuenow={current + 1}><span style={{ width: `${((current + 1) / count) * 100}%` }} /></div>
    </footer>
    {message && <p role="status" className={styles.feedback}>{message}</p>}
  </div>;
}
