"use client";

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { PromptBuilder } from "./PromptBuilder";
import { Finalizer } from "./Finalizer";
import type { PosterRatio, PromptBuilderInput } from "@/lib/poster-prompts";

type Tab = "prompt" | "finalize";

export interface SharedPosterData {
  ratio: PosterRatio;
  title: string;
  bodyText: string;
  imageUrl?: string;
  /** AI 공지사항 초안 생성을 위한 원본 입력값 */
  fullInput?: PromptBuilderInput;
}

/**
 * 탭 컨테이너. 두 패널 모두 항상 마운트해두고 CSS 로 가시성만 토글한다.
 */
export function PostersTabs() {
  const [tab, setTab] = useState<Tab>("prompt");
  const [sharedData, setSharedData] = useState<SharedPosterData | null>(null);

  // PromptBuilder 에서 이미지를 생성하거나 확정했을 때 호출
  const handleTransferToFinalize = (data: SharedPosterData) => {
    setSharedData(data);
    setTab("finalize");
  };

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<Sparkles size={14} />}
          label="① 프롬프트 만들기"
          hint="입력 → 영문 프롬프트 → 복사 또는 바로 생성"
          dataTour="poster-prompt-tab"
        />
        <TabButton
          active={tab === "finalize"}
          onClick={() => setTab("finalize")}
          icon={<Wand2 size={14} />}
          label="② 이미지 마무리"
          hint="AI 결과 이미지 + 한글 텍스트 + 교회 footer 합성 → PNG"
          dataTour="poster-finalize-tab"
        />
      </div>

      <div className={tab === "prompt" ? "" : "hidden"} aria-hidden={tab !== "prompt"}>
        <PromptBuilder onTransfer={handleTransferToFinalize} />
      </div>
      <div className={tab === "finalize" ? "" : "hidden"} aria-hidden={tab !== "finalize"}>
        <Finalizer sharedData={sharedData} />
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
  dataTour,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  dataTour?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      data-tour={dataTour}
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
