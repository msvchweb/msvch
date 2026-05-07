"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BulletinFrontLeft,
  BulletinFrontRight,
  weeklyToFrontData,
} from "./BulletinFront";
import {
  BulletinBackLeft,
  BulletinBackRight,
  weeklyToBackData,
} from "./BulletinBack";
import type { Weekly } from "@/types/notice";
import type { BulletinMasterData } from "@/types/bulletin-master";

interface Props {
  weekly: Weekly;
  master?: BulletinMasterData;
}

/**
 * 공개용 주보 웹뷰. 4개 면(P1·P2·P3·P4)을 PC 에서는 2×2 그리드, 모바일에서는 1열로 배치.
 * 각 면은 컨테이너 폭에 맞춰 자동 스케일되어 가로 스크롤 없이 보이게 한다.
 */
export function BulletinWebView({ weekly, master }: Props) {
  const frontData = weeklyToFrontData(weekly, master);
  const backData = weeklyToBackData(weekly, master);

  return (
    <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
      <Pane>
        <BulletinFrontRight data={frontData} />
      </Pane>
      <Pane>
        <BulletinBackLeft data={backData} />
      </Pane>
      <Pane>
        <BulletinBackRight data={backData} />
      </Pane>
      <Pane>
        <BulletinFrontLeft data={frontData} />
      </Pane>
    </div>
  );
}

const DESIGN_WIDTH = 520;

function Pane({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const w = outer.clientWidth;
      const s = Math.min(1, w / DESIGN_WIDTH);
      const naturalH = inner.offsetHeight;
      setScale(s);
      setInnerH(naturalH * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div
        ref={outerRef}
        className="relative w-full overflow-hidden"
        style={{ height: innerH ?? undefined }}
      >
        <div
          ref={innerRef}
          style={{
            width: DESIGN_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          className="bg-white p-3 text-[10px] leading-tight text-gray-800"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
