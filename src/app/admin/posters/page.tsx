import type { Metadata } from "next";
import { PostersTabs } from "./PostersTabs";

export const metadata: Metadata = { title: "포스터 도구" };

export default function AdminPostersPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">
        포스터 도구
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        ① 프롬프트를 만들어 ChatGPT·Gemini·Midjourney 등에서 이미지를 생성하고,
        ② 받은 이미지에 한글 제목·교회 footer 를 합성해 최종 PNG 로 저장합니다.
      </p>
      <PostersTabs />
    </div>
  );
}
