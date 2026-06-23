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
        행사 정보를 입력해 그림체 샘플 기반 이미지를 만들고 수정한 뒤, 교회 footer 를 합성해
        PNG 저장 또는 공지사항 등록까지 진행합니다.
      </p>
      <PostersTabs />
    </div>
  );
}
