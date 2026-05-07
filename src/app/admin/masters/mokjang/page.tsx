import { MokjangEditor } from "@/components/weekly/masters/MokjangEditor";

export default function AdminMasterMokjangPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">소그룹 목장</h1>
        <p className="mt-1 text-sm text-gray-500">
          주보 3페이지 목장 표 (최대 40목장).
        </p>
      </div>
      <MokjangEditor />
    </div>
  );
}
