"use client";

import { useState } from "react";
import { BookOpen, Images, Sparkles } from "lucide-react";
import { PromptBuilder } from "./PromptBuilder";
import { BookRecommendationAutomation } from "./BookRecommendationAutomation";
import { SavedPosters } from "./SavedPosters";
import type { PosterRatio, PromptBuilderInput } from "@/lib/poster-prompts";

type Tab = "prompt" | "book" | "saved";

export interface SharedPosterData {
  ratio: PosterRatio;
  title: string;
  bodyText: string;
  imageUrl?: string;
  fullInput?: PromptBuilderInput;
}

export function PostersTabs() {
  const [tab, setTab] = useState<Tab>("prompt");

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<Sparkles size={14} />}
          label="이미지 만들기"
          hint="입력값으로 이미지 프롬프트와 GPT 이미지를 생성합니다."
          dataTour="poster-prompt-tab"
        />
        <TabButton
          active={tab === "book"}
          onClick={() => setTab("book")}
          icon={<BookOpen size={14} />}
          label="추천도서 자동화"
          hint="YES24 도서 URL로 추천도서 포스터와 공지사항 초안을 만듭니다."
        />
        <TabButton
          active={tab === "saved"}
          onClick={() => setTab("saved")}
          icon={<Images size={14} />}
          label="저장된 포스터"
          hint="다운로드하며 저장된 포스터를 보고 이어 수정합니다."
        />
      </div>

      <div className={tab === "prompt" ? "" : "hidden"} aria-hidden={tab !== "prompt"}>
        <PromptBuilder />
      </div>
      <div className={tab === "book" ? "" : "hidden"} aria-hidden={tab !== "book"}>
        <BookRecommendationAutomation />
      </div>
      <div className={tab === "saved" ? "" : "hidden"} aria-hidden={tab !== "saved"}>
        <SavedPosters />
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
      className={`flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
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
