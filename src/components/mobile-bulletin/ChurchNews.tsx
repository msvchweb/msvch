"use client";

import { useEffect, useRef } from "react";
import type { NewsItem } from "@/types/notice";
import { SectionHeading } from "./SectionHeading";

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function ChurchNews({ news }: { news: NewsItem[] }): React.ReactNode {
  // 첫 항목은 open 으로 그려진다. 마운트 직후 발생하는 toggle 때문에 화면이 튀지 않도록
  // 마운트가 끝난 뒤의 토글에만 반응한다.
  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = true;
  }, []);

  const visibleNews = news
    .map((item) => ({
      title: item.title.trim(),
      items: item.items.map((line) => line.trim()).filter(nonEmpty),
    }))
    .filter((item) => nonEmpty(item.title) && item.items.length > 0);

  if (visibleNews.length === 0) return null;

  return (
    <section className="scroll-mt-20 snap-start bg-[var(--bt-bg)] px-4 pb-10 transition-colors duration-300 motion-reduce:transition-none sm:px-6">
      <SectionHeading>교회소식</SectionHeading>

      <div className="flex flex-col gap-2.5">
        {visibleNews.map((item, index) => (
          <details
            key={`${item.title}-${index}`}
            open={index === 0}
            onToggle={(event) => {
              if (!readyRef.current || !event.currentTarget.open) return;
              // 펼친 항목이 화면 밖으로 밀려나지 않게 상단으로 끌어온다.
              // behavior 기본값(즉시 이동)이라 prefers-reduced-motion 과 충돌하지 않는다.
              event.currentTarget.scrollIntoView({ block: "start" });
            }}
            className="group scroll-mt-20 rounded-[15px] border border-[var(--bt-line)] bg-[var(--bt-card)] px-4"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[14.5px] font-extrabold tracking-[-0.025em] text-[var(--bt-ink)] marker:content-none">
              <span className="min-w-0 break-words">{item.title}</span>
              <span
                aria-hidden="true"
                className="shrink-0 text-[var(--bt-acc)] transition-transform group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <ul className="flex flex-col gap-2 pb-4 pl-4 text-[13px] leading-[1.65] tracking-[-0.01em] text-[var(--bt-sub)]">
              {item.items.map((line, lineIndex) => (
                <li key={`${line}-${lineIndex}`} className="list-disc whitespace-pre-wrap break-words">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
