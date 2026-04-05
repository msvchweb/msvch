import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex h-[70vh] min-h-[500px] items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600">
      <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] opacity-10" />
      <div className="relative z-10 flex flex-col items-center px-4 text-center text-white">
        <p className="mb-2 text-lg font-medium text-primary-200">
          환영합니다
        </p>
        <h1 className="text-4xl font-bold leading-tight md:text-6xl">
          명성비전교회
        </h1>
        <p className="mt-4 max-w-lg text-lg text-primary-100 md:text-xl">
          하나님의 사랑으로 함께하는 교회입니다
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/worship"
            className="rounded-full bg-white px-8 py-3 font-medium text-primary-700 shadow-lg transition hover:bg-primary-50"
          >
            예배 안내
          </Link>
          <Link
            href="/intro"
            className="rounded-full border-2 border-white/80 px-8 py-3 font-medium text-white transition hover:bg-white/10"
          >
            교회 소개
          </Link>
        </div>
      </div>
    </section>
  );
}
