import Link from "next/link";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        페이지를 찾을 수 없습니다
      </h2>
      <p className="mt-2 text-gray-500">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-primary-600 px-8 py-3 font-medium text-white hover:bg-primary-700"
      >
        홈으로 돌아가기
      </Link>
    </Container>
  );
}
