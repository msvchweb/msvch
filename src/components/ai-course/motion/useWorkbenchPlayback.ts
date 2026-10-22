"use client";
import { useCallback, useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { animate } from "motion/react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";

export type WorkbenchScene = "intro" | "document" | "workflow" | "app" | "settled";
const REST = { scene: "settled" as WorkbenchScene, playing: false };
function createPlayer() {
  let snapshot = REST;
  let consumed = false;
  let generation = 0;
  let controls: ReturnType<typeof animate> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: typeof REST) => {
    if (snapshot.scene === next.scene && snapshot.playing === next.playing) return;
    snapshot = next; listeners.forEach((notify) => notify());
  };
  return {
    subscribe(notify: () => void) { listeners.add(notify); return () => { listeners.delete(notify); }; },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => REST,
    canAutoplay: () => !consumed,
    cancel() { generation++; controls?.stop(); controls = undefined; publish(REST); },
    start() {
      if (snapshot.playing) return;
      consumed = true;
      const run = ++generation;
      publish({ scene: "intro", playing: true });
      controls = animate(0, 1, {
        duration: 4.5, ease: "linear",
        onUpdate(progress) {
          if (run !== generation) return;
          const scene: WorkbenchScene = progress < 0.8 / 4.5 ? "intro" : progress < 2 / 4.5 ? "document" : progress < 3.3 / 4.5 ? "workflow" : "app";
          publish({ scene, playing: true });
        },
        onComplete() { if (run === generation) { controls = undefined; publish(REST); } },
      });
    },
  };
}
export function useWorkbenchPlayback({ scope, inView }: { scope: RefObject<HTMLDivElement | null>; inView: boolean }) {
  const { mode, documentVisible, skipIntro } = useAiCourseMotion();
  const [player] = useState(createPlayer);
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getServerSnapshot);
  const eligible = mode === "animated" && documentVisible && inView;
  useEffect(() => {
    let disposed = false;
    // Deferring one microtask lets StrictMode's abandoned effect cancel before it starts.
    if (eligible && !skipIntro && player.canAutoplay()) queueMicrotask(() => {
      if (!disposed && scope.current) player.start();
    });
    return () => { disposed = true; player.cancel(); };
  }, [eligible, skipIntro, player, scope]);
  const replay = useCallback(() => { if (eligible && scope.current) player.start(); }, [eligible, scope, player]);
  return { scene: eligible ? state.scene : "settled" as WorkbenchScene, playing: eligible && state.playing, replay };
}
