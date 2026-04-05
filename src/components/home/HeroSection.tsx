import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src="/images/worship-hall.avif"
        alt="명성비전교회 예배당"
        fill
        className="object-cover"
        priority
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-church-dark/80 via-church-dark/60 to-church-dark/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(97,114,243,0.12),transparent_70%)]" />

      {/* Bottom gold line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-church-gold/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-primary-200 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-church-gold" />
          환영합니다
        </div>

        <h1 className="animate-fade-up text-4xl font-bold leading-[1.2] tracking-tight text-white sm:text-5xl md:text-6xl">
          꿈이 있는 건강한 교회
          <br />
          <span className="text-church-gold">명성비전교회</span>
          <span className="text-primary-300">입니다</span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-gray-300">
          복음의 열매를 맺는 교회
          <br />
          제자는 Training! 훈련이다.
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
