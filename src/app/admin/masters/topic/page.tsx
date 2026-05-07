import { TopicEditor } from "@/components/weekly/masters/TopicEditor";

export default function AdminMasterTopicPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">올해의 표어</h1>
        <p className="mt-1 text-sm text-gray-500">
          주보 1페이지 우측 하단 &ldquo;○년 표어&rdquo; 영역에 표시됩니다.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <TopicEditor />
      </div>
    </div>
  );
}
