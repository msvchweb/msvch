import { OfferingAccountEditor } from "@/components/weekly/masters/OfferingAccountEditor";

export default function AdminMasterOfferingAccountPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">온라인 헌금 계좌</h1>
        <p className="mt-1 text-sm text-gray-500">
          모바일 주보의 &ldquo;온라인 헌금&rdquo; 안내에 표시됩니다.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <OfferingAccountEditor />
      </div>
    </div>
  );
}
