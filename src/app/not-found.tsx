import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center px-4 text-center">
      <p className="text-8xl font-bold text-gray-100">404</p>
      <h2 className="mt-2 text-xl font-bold text-gray-900">
        페이지를 찾을 수 없습니다
      </h2>
      <p className="mt-2 text-gray-500">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
      >
        <Home size={16} />
        홈으로 돌아가기
      </Link>
    </div>
  );
}
