"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Pause, Play } from "lucide-react";
import styles from "./ai-course-motion.module.css";

export type AiCourseMotionMode = "static" | "animated";
export interface AiCourseMotionState {
  mode: AiCourseMotionMode;
  paused: boolean;
  prefersReducedMotion: boolean;
  documentVisible: boolean;
  skipIntro: boolean;
  setPaused(paused: boolean): void;
}
const SERVER = { ready: false, reduced: false, visible: true, skipIntro: true };
const fallback: AiCourseMotionState = { mode: "static", paused: true, prefersReducedMotion: false, documentVisible: true, skipIntro: true, setPaused() {} };
const Context = createContext<AiCourseMotionState>(fallback);

function createEnvironmentStore() {
  let snapshot = SERVER;
  let initialHash: string | undefined;
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER,
    subscribe(notify: () => void) {
      initialHash ??= window.location.hash;
      const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      const update = () => {
        const next = { ready: !!query, reduced: query?.matches ?? true, visible: document.visibilityState !== "hidden", skipIntro: initialHash === "#apply" };
        if (Object.keys(next).some((key) => next[key as keyof typeof next] !== snapshot[key as keyof typeof snapshot])) { snapshot = next; notify(); }
      };
      query?.addEventListener("change", update);
      document.addEventListener("visibilitychange", update);
      update();
      return () => { query?.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); };
    },
  };
}
export function AiCourseMotionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createEnvironmentStore);
  const environment = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [paused, setPaused] = useState(false);
  const mode: AiCourseMotionMode = environment.ready && !environment.reduced && !paused ? "animated" : "static";
  return <Context.Provider value={{ mode, paused, setPaused, prefersReducedMotion: environment.reduced, documentVisible: environment.visible, skipIntro: environment.skipIntro }}>
    <MotionConfig reducedMotion="user"><div className={styles.root} data-ai-course-motion={mode} data-motion-visible={environment.visible ? "true" : "false"}>{children}</div></MotionConfig>
  </Context.Provider>;
}
export function useAiCourseMotion() { return useContext(Context); }
export function AiCourseMotionControls() {
  const { mode, prefersReducedMotion, setPaused } = useAiCourseMotion();
  return <button type="button" className={styles.motionControl} disabled={prefersReducedMotion} onClick={() => setPaused(mode === "animated")}>
    {mode === "animated" ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
    {prefersReducedMotion ? "동작 줄이기 적용 중" : mode === "animated" ? "모션 끄기" : "모션 켜기"}
  </button>;
}
