import { WorshipResourcesEditor } from "@/components/weekly/masters/WorshipResourcesEditor";

export default function AdminMasterWorshipResourcesPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">예배자료</h1>
        <p className="mt-1 text-sm text-gray-500">성경·찬송가·신앙고백 본문과 출처를 관리합니다.</p>
      </div>
      <WorshipResourcesEditor />
    </div>
  );
}
