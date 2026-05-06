"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
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
  const active = list[idx];
  const isFallback = active.id === "fallback";

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(
      () => setIdx((p) => (p + 1) % list.length),
      6000,
    );
    return () => clearInterval(t);
  }, [list.length]);

  return (
    <section className="relative h-[82vh] min-h-[560px] overflow-hidden sm:min-h-[640px]">
      <div className="absolute inset-0">
        <div
          className="flex h-full w-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {list.map((slide, i) => (
            <div key={slide.id} className="relative h-full w-full shrink-0">
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                sizes="100vw"
                className="object-cover"
                priority={i === 0}
                unoptimized={slide.image.startsWith("http")}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.15)_35%,rgba(0,0,0,0.2)_65%,rgba(0,0,0,0.78)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between px-6 pt-24 pb-10 sm:px-16 sm:pt-32 sm:pb-12">
        <div className="max-w-[920px]">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.28em] text-white/70">
            Welcome
          </p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl md:text-[80px]">
            꿈이 있는 건강한 교회
            <br />
            <span className="font-light text-white/90">명성비전교회</span>
          </h1>
          <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
            <Link
              href="/worship"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-white"
            >
              예배 안내
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="/greetings"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/75 hover:text-white"
            >
              교회 소개
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            {!isFallback && (
              <Link
                href={active.href}
                className="group block max-w-[680px]"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                  현재 공지
                </p>
                <h2 className="mt-2 line-clamp-2 text-lg font-medium leading-snug text-white sm:text-2xl">
                  {active.title}
                </h2>
              </Link>
            )}
          </div>
          {list.length > 1 && (
            <div className="flex shrink-0 items-center gap-1.5">
              {list.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setIdx(i)}
                  aria-label={`슬라이드 ${i + 1}`}
                  className="h-[3px] rounded-full transition-all"
                  style={{
                    width: i === idx ? 36 : 14,
                    background:
                      i === idx
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
