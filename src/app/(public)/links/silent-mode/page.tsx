import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BellOff } from "lucide-react";

export const metadata: Metadata = {
  title: "예배시간 무음모드 방법",
  description: "예배시간에 방해금지 모드를 자동으로 켜는 설정 안내입니다.",
};

const steps = [
  {
    title: "방해금지 메뉴 열기",
    image: "/images/mann01.jpg",
    description: '상태바를 내린 후 "방해금지"를 길게 눌러줍니다.',
  },
  {
    title: "상세설정 들어가기",
    image: "/images/mann02.jpg",
    description: "상세설정에 들어갑니다.",
  },
  {
    title: "일정 추가하기",
    image: "/images/mann03.jpg",
    description: "일정추가를 눌러줍니다.",
  },
  {
    title: "요일과 시간 저장하기",
    image: "/images/mann04.jpg",
    description: "제목을 쓰고, 원하는 요일,시간을 설정 후 저장합니다.",
  },
];

export default function SilentModePage() {
  return (
    <main className="min-h-screen bg-church-dark px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center gap-3">
          <Link
            href="/links"
            aria-label="링크 모음으로 돌아가기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-church-gold/50 hover:text-church-gold"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-church-gold">
              Manners Mode
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              예배시간 무음모드 방법
            </h1>
          </div>
        </header>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-church-gold/15 text-church-gold">
              <BellOff size={20} />
            </div>
            <p className="text-sm leading-6 text-white/70">
              예배시간에 휴대폰 알림이 울리지 않도록 방해금지 모드를
              일정으로 설정해두세요.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          {steps.map((step, index) => (
            <article
              key={step.image}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-church-gold text-sm font-bold text-church-dark">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{step.title}</h2>
                    <p className="mt-1 text-sm leading-5 text-white/60">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
              <Image
                src={step.image}
                alt={`${step.title} 화면`}
                width={1080}
                height={2340}
                sizes="(max-width: 640px) 100vw, 448px"
                className="h-auto w-full"
              />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
