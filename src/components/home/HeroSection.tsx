"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { HeroSlide } from "@/types/notice";

const FALLBACK: HeroSlide = {
  id: "fallback",
  eyebrow: "환영합니다",
  title: "꿈이 있는 건강한 교회",
  subtitle: "복음의 열매를 맺는 교회\n제자는 Training! 훈련이다.",
  image: "/images/main.jpg",
  href: "/worship",
  date: null,
};

export function HeroSection({ slides }: { slides: HeroSlide[] }) {
  const list: HeroSlide[] = slides.length > 0 ? slides : [FALLBACK];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(
      () => setIdx((p) => (p + 1) % list.length),
      6000,
    );
    return () => clearInterval(t);
  }, [list.length]);

  const s = list[idx];

  return (
    <section className="relative bg-[var(--color-hero-bg-1)] px-4 pt-20 pb-16 text-center sm:px-12 sm:pt-[120px] sm:pb-20">
      <div className="mb-7 text-xs font-medium uppercase tracking-[0.36em] text-gray-500">
        — {s.eyebrow} —
      </div>

      <h1 className="mx-auto mb-6 max-w-[900px] text-4xl font-bold leading-[1.15] tracking-[-0.035em] text-church-dark sm:text-5xl md:text-[68px]">
        {s.title}
        <br />
        <span className="text-primary-700">명성비전교회</span>입니다
      </h1>

      <p className="mx-auto mb-11 max-w-[480px] whitespace-pre-line text-base leading-[1.75] text-gray-600 sm:text-[17px]">
        {s.subtitle}
      </p>

      <div className="mb-12 flex justify-center gap-2.5 sm:mb-16">
        <Link
          href={s.href}
          className="group flex items-center gap-1 rounded-full bg-church-dark px-7 py-3.5 text-sm font-medium text-church-cream transition-colors hover:bg-gray-800"
        >
          자세히 보기
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/greetings"
          className="rounded-full border border-gray-300 px-7 py-3.5 text-sm font-medium text-church-dark hover:bg-white"
        >
          교회 소개
        </Link>
      </div>

      <div className="relative mx-auto h-[280px] max-w-[1100px] overflow-hidden rounded-[20px] shadow-[0_30px_80px_-30px_rgba(30,40,60,0.3)] sm:h-[440px]">
        <Image
          key={s.id}
          src={s.image}
          alt={s.title}
          fill
          sizes="(max-width: 1100px) 100vw, 1100px"
          className="object-cover transition-opacity duration-700"
          priority
          unoptimized={s.image.startsWith("http")}
        />
        {list.length > 1 && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-white/85 px-3.5 py-2 backdrop-blur-md">
            {list.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setIdx(i)}
                aria-label={`슬라이드 ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 24 : 6,
                  background: i === idx ? "#1a2332" : "rgba(30,40,60,0.3)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
