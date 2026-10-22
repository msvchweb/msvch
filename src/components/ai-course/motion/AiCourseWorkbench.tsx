"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, FileText, Globe2, Layers3, RotateCcw, Sparkles, Timer } from "lucide-react";
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
    <div className={styles.benchTop}><span><Sparkles size={13} aria-hidden />12주 뒤, 나의 작업 공간</span><span className={styles.example}>실습 예시</span></div>
    <div className={styles.stage} role="img" aria-label="메모가 모임 준비 문서와 업무 절차로 정리되고, 나만의 앱으로 완성되는 모습">
      <div aria-hidden="true" className={styles.stageGrid} />
      <svg aria-hidden="true" className={styles.orbits} viewBox="0 0 480 360"><ellipse cx="240" cy="180" rx="218" ry="105" /><ellipse cx="240" cy="180" rx="148" ry="155" transform="rotate(-28 240 180)" /><path className={styles.orbitBeam} d="M22 180C65 60 400 50 458 180S65 300 22 180" /></svg>
      <div aria-hidden="true" className={styles.memoScene}>
        <div className={styles.prompt}><span>이렇게 요청하면</span>“이 메모로 할 일 목록을 만들고,<br />우리 모임에 보낼 안내문도 써줘.”</div>
        <div className={styles.memo}><FileText size={16} />모임 준비</div><div className={styles.memo}>간식·준비물</div><div className={styles.memo}>참석 인원?</div>
        <div className={styles.core}><Sparkles size={29} /></div>
      </div>
      <div aria-hidden="true" className={styles.documentScene}>
        <div className={styles.document}><div className={styles.docHeader}><FileText size={22} /><span>모임 준비 문서<small>내 메모에서 바로 꺼낸 실행 계획</small></span></div>
          {["준비물과 담당 역할 정리", "빠진 정보 확인 목록", "바로 검토할 수 있는 안내문 초안"].map((line, index) => <div key={line} className={styles.docRow} style={{ "--row": index } as React.CSSProperties}><Check size={15} />{line}</div>)}
          <div className={styles.docLines}><i /><i /><i /></div>
        </div>
      </div>
      <div aria-hidden="true" className={styles.workflowScene}>
        <span className={styles.flowHeading}>한 번 만든 절차, 다음 작업에도.</span>
        <svg viewBox="0 0 400 190"><path className={styles.flowPath} d="M60 95H200H340" /><circle cx="200" cy="95" r="68" className={styles.flowRing} /></svg>
        <div className={styles.flowNodes}><span><FileText />내 자료</span><span><Layers3 />나만의 스킬</span><span><Timer />예약 실행</span></div>
        <p>자료가 바뀌어도, 내가 정한 기준 그대로.</p>
      </div>
      <div aria-hidden="true" className={styles.appScene}>
        <div className={styles.appWindow}>
          <div className={styles.browserBar}><span><i /><i /><i /></span><small>MY APP / 나의 작업 공간</small><ArrowUpRight size={12} /></div>
          <div className={styles.appBody}><div className={styles.appHeading}><span className={styles.appAvatar}>M</span><span>내 일의 새로운 시작<small>직접 만들고, 필요할 때 고칩니다.</small></span></div>
            <div className={styles.appBanner}><Globe2 size={23} /><span>나만의 앱이 완성되었습니다.<small>내 내용과 기능을 담아 웹 주소로 공유</small></span></div>
            <div className={styles.appTiles}><span><FileText size={16} />내 활동</span><span><Layers3 size={16} />작업 모음</span><span><Timer size={16} />나의 일정</span></div>
            <div className={styles.appFooter}><span>만들고, 확인하고, 다시 배포하기</span><Check size={14} /></div>
          </div>
        </div><div className={styles.sharedBadge}><Check size={12} />내 손으로 만든 앱</div>
      </div>
    </div>
    <div className={styles.benchBottom}><span>질문 → 문서 → 업무 절차 → 나만의 앱</span><button type="button" disabled={playing || mode === "static"} onClick={replay} aria-label="작업실 모션 다시 보기"><RotateCcw size={12} aria-hidden />다시 보기</button></div>
  </div>;
}
