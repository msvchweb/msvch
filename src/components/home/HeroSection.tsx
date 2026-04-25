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
  subtitle: "",
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

  return (
    <section className="relative bg-[var(--color-hero-bg-1)] px-4 pt-[60px] pb-16 text-center sm:px-12 sm:pt-[100px] sm:pb-20">
      <h1 className="mx-auto mb-6 max-w-[900px] text-4xl font-bold leading-[1.15] tracking-[-0.035em] text-church-dark sm:text-5xl md:text-[68px]">
        꿈이 있는 건강한 교회
        <br />
        <span className="text-primary-700">명성비전교회</span>입니다
      </h1>

      <div className="mb-12 flex justify-center gap-2.5 sm:mb-16">
        <Link
          href="/worship"
          className="group flex items-center gap-1 rounded-full bg-church-dark px-7 py-3.5 text-sm font-medium text-church-cream transition-colors hover:bg-gray-800"
        >
          예배 안내
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
        <div
          className="flex h-full w-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {list.map((slide, i) => {
            const isFallbackSlide = slide.id === "fallback";
            return (
              <div key={slide.id} className="relative h-full w-full shrink-0">
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  sizes="(max-width: 1100px) 100vw, 1100px"
                  className="object-cover"
                  priority={i === 0}
                  unoptimized={slide.image.startsWith("http")}
                />
                {!isFallbackSlide && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-16 pt-10 text-left sm:px-10 sm:pb-20">
                      <h2 className="max-w-[900px] text-lg font-bold leading-[1.3] tracking-[-0.02em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-2xl md:text-3xl">
                        {slide.title}
                      </h2>
                    </div>
                    <Link
                      href={slide.href}
                      aria-label={slide.title}
                      className="absolute inset-0"
                    >
                      <span className="sr-only">{slide.title}</span>
                    </Link>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {list.length > 1 && (
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-white/85 px-3.5 py-2 backdrop-blur-md">
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
