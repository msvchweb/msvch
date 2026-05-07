import { ServantsEditor } from "@/components/weekly/masters/ServantsEditor";

export default function AdminMasterServantsPage() {
  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">섬기는 분들</h1>
        <p className="mt-1 text-sm text-gray-500">
          주보 4페이지 좌측 &ldquo;섬기는 분들&rdquo; 역할 ↔ 이름. 여러 이름은 줄바꿈으로 구분합니다.
        </p>
      </div>
      <ServantsEditor />
    </div>
  );
}
