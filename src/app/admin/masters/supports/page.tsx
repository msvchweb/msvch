import { SupportsEditor } from "@/components/weekly/masters/SupportsEditor";

export default function AdminMasterSupportsPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">우리가 후원하는 분들</h1>
        <p className="mt-1 text-sm text-gray-500">섹션별 제목과 줄 단위 목록.</p>
      </div>
      <SupportsEditor />
    </div>
  );
}
