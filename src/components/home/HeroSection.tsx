import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden bg-church-dark">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/90 via-church-dark/70 to-church-dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(97,114,243,0.15),transparent_70%)]" />

      {/* Decorative elements */}
      <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-church-gold/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-primary-200 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-church-gold" />
          환영합니다
        </div>

        <h1 className="animate-fade-up text-5xl font-bold leading-[1.15] tracking-tight text-white md:text-7xl">
          명성비전교회
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-gray-300 md:text-xl">
          하나님의 사랑으로 함께하는
          <br className="hidden sm:block" />
          따뜻한 공동체입니다
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/worship"
            className="group flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-gray-900 shadow-lg shadow-white/10 transition-all hover:shadow-xl hover:shadow-white/20"
          >
            예배 안내
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/intro"
            className="flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/5"
          >
            교회 소개
          </Link>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-church-cream to-transparent" />
    </section>
  );
}
