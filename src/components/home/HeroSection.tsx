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
  image: "/images/church.jpg",
  href: "/worship",
  date: null,
};

function NoticeCard({ slides, activeIdx, onSelect }: { 
  slides: HeroSlide[], 
  activeIdx: number,
  onSelect: (idx: number) => void 
}) {
  const active = slides[activeIdx];
  
  return (
    <div className="absolute inset-x-4 bottom-20 z-10 overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-10 md:right-10 md:w-[340px] lg:bottom-16 lg:right-16">
      <Link
        href={active.href}
        className="group block"
        aria-label={`${active.title} 공지사항 보기`}
      >
        <div className="relative h-[132px] overflow-hidden md:h-[160px]">
          <Image
            src={active.image}
            alt=""
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 767px) calc(100vw - 32px), 340px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold tracking-wider text-church-dark">
            공지사항
          </span>
          <div className="absolute inset-x-4 bottom-4 text-white">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] opacity-80">
              {active.eyebrow || "NEWS"}
            </div>
            <div className="line-clamp-2 text-base font-semibold tracking-tight">
              {active.title}
            </div>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => onSelect(i)}
              aria-label={`슬라이드 ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === activeIdx ? 24 : 6,
                background: i === activeIdx ? "white" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
        <div className="text-[10px] tabular-nums tracking-widest text-white/60">
          {String(activeIdx + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}

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
    <section className="relative h-[85vh] min-h-[760px] overflow-hidden bg-church-dark md:min-h-[640px]">
      {/* Background Image - Church Building */}
      <Image
        src="/images/church.jpg"
        alt="명성비전교회 전경"
        fill
        priority
        sizes="100vw"
        className="object-cover transition-transform duration-[10s] hover:scale-105"
        style={{ objectPosition: "center 40%" }}
      />
      
      {/* Dynamic Overlay for Readability */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: "linear-gradient(105deg, rgba(17,24,39,0.92) 0%, rgba(17,24,39,0.7) 35%, rgba(17,24,39,0.2) 65%, rgba(17,24,39,0.05) 100%)",
        }}
      />

      <div className="relative z-10 flex h-full max-w-7xl flex-col justify-start px-6 pb-60 pt-16 sm:px-16 md:justify-center md:px-8 md:py-0 lg:px-24">
        <div className="max-w-[800px] text-white">
          <div className="mb-8 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.4em] opacity-80 sm:text-sm">
            <span className="h-[2px] w-10 bg-liturgy-brand" />
            Welcome
          </div>
          
          <h1 className="mb-10 text-5xl font-bold leading-[1.08] tracking-[-0.05em] sm:text-7xl md:text-[92px]">
            꿈이 있는
            <br />
            <span className="font-light text-white/90">건강한 교회</span>
          </h1>
          
          <p className="mb-12 max-w-[480px] text-lg leading-relaxed tracking-tight text-white/70 sm:text-xl">
            복음의 열매를 맺는 교회{"\n"}제자들의 훈련과 헌신이 있는 명성비전교회입니다.
          </p>

          <div className="flex flex-wrap items-center gap-8 sm:gap-12">
            <Link
              href="/worship"
              className="group relative flex items-center gap-3 border-b-2 border-white/90 pb-2 text-lg font-semibold transition-all hover:border-liturgy-brand"
            >
              예배 안내
              <ArrowRight
                size={20}
                className="transition-transform group-hover:translate-x-2"
              />
            </Link>
            <Link
              href="/greetings"
              className="text-lg font-medium text-white/60 transition-colors hover:text-white"
            >
              교회 소개
            </Link>
          </div>

          <div className="absolute bottom-12 left-8 hidden flex-col gap-3 text-xs tracking-wider text-white/40 md:flex md:flex-row md:items-center md:gap-8 lg:left-24">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white/60">ADDR.</span>
              서울시 동작구 사당로 16바길 9
            </div>
            <span className="hidden opacity-30 sm:block">|</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white/60">TIME.</span>
              매주 주일 8시 · 10시 · 12시
            </div>
          </div>
        </div>
      </div>

      {/* Rotating Notice Card */}
      <NoticeCard 
        slides={list} 
        activeIdx={idx} 
        onSelect={(n) => setIdx(n)} 
      />
    </section>
  );
}
