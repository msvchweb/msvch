"use client";
import { useEffect, useRef, useState } from "react";
import { Check, FileText, Layers3, RotateCcw, Sparkles, Timer, UserRound } from "lucide-react";
import { useAiCourseMotion } from "./AiCourseMotionProvider";
import { useWorkbenchPlayback } from "./useWorkbenchPlayback";
import styles from "./ai-course-motion.module.css";

export default function AiCourseWorkbench() {
  const scope = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const { mode } = useAiCourseMotion();
  useEffect(() => {
    if (!scope.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(scope.current); return () => observer.disconnect();
  }, []);
  const { scene, playing, replay } = useWorkbenchPlayback({ scope, inView });
  return <div ref={scope} className={styles.workbench} data-scene={scene} data-playing={playing ? "true" : "false"}>
    <div className={styles.benchTop}><span><Sparkles size={15} aria-hidden />이런 일을 해봐요</span><span className={styles.example}>실습 예시</span></div>
    <div className={styles.stage} role="img" aria-label="메모를 정리하고 반복할 일을 줄여, 나만의 앱까지 만드는 모습">
      <div aria-hidden="true" className={styles.stageGrid} />
      <svg aria-hidden="true" className={styles.orbits} viewBox="0 0 480 360"><ellipse cx="240" cy="180" rx="218" ry="105" /><ellipse cx="240" cy="180" rx="148" ry="155" transform="rotate(-28 240 180)" /><path className={styles.orbitBeam} d="M22 180C65 60 400 50 458 180S65 300 22 180" /></svg>
      <div aria-hidden="true" className={styles.memoScene}>
        <div className={styles.sceneTitle}>메모를 정리하고</div>
        <div className={styles.memo + " " + styles.simpleMemo}><FileText size={20} />수업 메모</div><div className={styles.memo + " " + styles.simpleMemo}>할 일</div><div className={styles.memo + " " + styles.simpleMemo}>아이디어</div>
        <div className={styles.core}><Sparkles size={29} /></div>
      </div>
      <div aria-hidden="true" className={styles.documentScene}>
        <div className={styles.sceneTitle}>한눈에 핵심 정리</div>
        <div className={styles.document + " " + styles.simpleDocument}>{[0, 1, 2].map(index => <div key={index} className={styles.summaryLine}><Check size={21} /><i style={{ width: (100 - index * 15) + "%" }} /></div>)}</div>
      </div>
      <div aria-hidden="true" className={styles.workflowScene}>
        <div className={styles.sceneTitle}>반복할 일은 줄이고</div>
        <svg viewBox="0 0 400 190"><path className={styles.flowPath} d="M60 95H200H340" /><circle cx="200" cy="95" r="68" className={styles.flowRing} /></svg>
        <div className={styles.flowNodes + " " + styles.simpleFlow}><span><FileText />내 자료</span><span><Layers3 />AI 도움</span><span><Timer />다음에도</span></div>
      </div>
      <div aria-hidden="true" className={styles.appScene}>
        <div className={styles.sceneTitle}>나만의 앱까지</div>
        <div className={styles.appWindow + " " + styles.simpleAppWindow}>
          <div className={styles.browserBar}><span><i /><i /><i /></span><small>나의 앱</small><Check size={14} /></div>
          <div className={styles.simpleAppBody}><div className={styles.simpleAppIdentity}><span className={styles.appAvatar}>M</span><strong>나의 공간</strong></div>
            <div className={styles.simpleAppTiles}><span><UserRound size={23} />소개</span><span><Layers3 size={23} />활동</span><span><FileText size={23} />기록</span></div>
          </div>
        </div><div className={styles.sharedBadge}><Check size={14} />내 앱 완성!</div>
      </div>
    </div>
    <div className={styles.benchBottom}><span>함께 따라 하며 배워요.</span><button type="button" aria-disabled={playing || mode === "static"} onClick={replay} aria-label="작업실 모션 다시 보기"><RotateCcw size={14} aria-hidden />다시 보기</button></div>
  </div>;
}
