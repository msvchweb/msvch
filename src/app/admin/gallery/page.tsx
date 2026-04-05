import type { Metadata } from "next";

export const metadata: Metadata = { title: "갤러리 관리" };

export default function AdminGalleryPage() {
  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">갤러리 관리</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <p className="text-gray-600">
          갤러리는 Notion 데이터베이스에서 관리됩니다.
        </p>
        <div className="mt-4 rounded-lg bg-primary-50 p-4 text-sm text-primary-700">
          <p className="font-medium">Notion에서 갤러리 관리하는 방법:</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Notion 갤러리 데이터베이스로 이동합니다.</li>
            <li>새 항목을 추가하고 제목, 카테고리, 날짜를 입력합니다.</li>
            <li>대표이미지와 전체 이미지를 업로드합니다.</li>
            <li>&ldquo;공개&rdquo; 체크박스를 선택하면 홈페이지에 표시됩니다.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
