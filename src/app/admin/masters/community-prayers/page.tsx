import { CommunityPrayersEditor } from "@/components/weekly/masters/CommunityPrayersEditor";

export default function AdminMasterCommunityPrayersPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">교회공동체 기도제목</h1>
        <p className="mt-1 text-sm text-gray-500">
          주보 2페이지 &ldquo;교회공동체 기도제목&rdquo; 섹션. 최대 7개까지 표시됩니다.
        </p>
      </div>
      <CommunityPrayersEditor />
    </div>
  );
}
