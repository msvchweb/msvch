"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { PromptBuilder } from "./PromptBuilder";
import { Finalizer } from "./Finalizer";

type Tab = "prompt" | "finalize";

/**
 * 탭 컨테이너. 두 패널 모두 항상 마운트해두고 CSS 로 가시성만 토글한다.
 * - 탭 전환 시 작성 중이던 입력값/생성 요청 in-flight 가 보존됨
 * - 비활성 패널의 `useEffect` 는 그대로 동작 (preload 등) — 비용 미미
 */
export function PostersTabs() {
  const [tab, setTab] = useState<Tab>("prompt");
  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<Sparkles size={14} />}
          label="① 프롬프트 만들기"
          hint="입력 → 영문 프롬프트 → 복사 → ChatGPT/Gemini/Midjourney"
        />
        <TabButton
          active={tab === "finalize"}
          onClick={() => setTab("finalize")}
          icon={<Wand2 size={14} />}
          label="② 이미지 마무리"
          hint="AI 결과 이미지 + 한글 텍스트 + 교회 footer 합성 → PNG"
        />
      </div>

      <div className={tab === "prompt" ? "" : "hidden"} aria-hidden={tab !== "prompt"}>
        <PromptBuilder />
      </div>
      <div className={tab === "finalize" ? "" : "hidden"} aria-hidden={tab !== "finalize"}>
        <Finalizer />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
        active
          ? "border-b-2 border-primary-600 font-semibold text-primary-700"
          : "border-b-2 border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
