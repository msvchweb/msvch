"use client";

import { useId, useRef } from "react";
import type { WorshipResource } from "@/types/mobile-bulletin";

function resourceActionLabel(kind: WorshipResource["kind"]): string {
  if (kind === "scripture") return "본문 보기";
  if (kind === "hymn") return "찬송가 보기";
  return "내용 보기";
}

/** 순서 카드 우측 알약 뱃지에 표시할 짧은 라벨. 접근성 이름은 actionLabel 이 담당한다. */
function resourceBadgeLabel(kind: WorshipResource["kind"]): string {
  if (kind === "scripture") return "본문";
  if (kind === "hymn") return "가사";
  if (kind === "creed") return "전문";
  if (kind === "link") return "열기";
  return "보기";
}

function safeExternalUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function WorshipResourceSheet({
  resource,
}: {
  resource: WorshipResource;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const actionLabel = resourceActionLabel(resource.kind);
  const externalUrl = safeExternalUrl(resource.external_url);

  function open() {
    dialogRef.current?.showModal();
    closeButtonRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label={`${resource.title} ${actionLabel}`}
        className="inline-grid min-h-11 min-w-11 place-items-center rounded-full bg-[var(--bt-acc-soft)] px-2.5 text-[10.5px] font-extrabold text-[var(--bt-acc)] transition-colors motion-reduce:transition-none"
      >
        {resourceBadgeLabel(resource.kind)}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-0 m-0 h-dvh w-full max-w-none bg-transparent p-0 backdrop:bg-[rgba(6,10,18,0.6)] open:flex open:items-end open:justify-center sm:open:items-center"
      >
        <div
          className="flex max-h-[84dvh] w-full flex-col rounded-t-[22px] bg-[var(--bt-sheet)] text-left text-[var(--bt-ink)] sm:max-w-2xl sm:rounded-[22px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 justify-center pt-3">
            <span
              aria-hidden="true"
              className="h-[5px] w-[38px] rounded-[3px] bg-[var(--bt-line)]"
            />
          </div>

          <div className="flex shrink-0 items-start justify-between gap-4 px-[22px] pb-3.5 pt-2.5">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="break-words text-base font-extrabold tracking-[-0.03em] text-[var(--bt-ink)]"
              >
                {resource.title}
              </h2>
              {resource.reference.trim() && (
                <p className="mt-1 break-words text-[12.5px] text-[var(--bt-sub)]">
                  {resource.reference}
                </p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="닫기"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--bt-acc-soft)] text-[17px] leading-none text-[var(--bt-acc)]"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="overflow-y-auto px-[22px] pb-10 pt-1">
            <div className="whitespace-pre-wrap break-words text-[16.5px] leading-[1.85] tracking-[-0.01em] text-[var(--bt-ink)]">
              {resource.content}
            </div>

            {(resource.source_label || resource.rights_note) && (
              <div className="mt-6 border-t border-[var(--bt-line)] pt-4 text-[12.5px] leading-6 text-[var(--bt-faint)]">
                {resource.source_label && <p>출처: {resource.source_label}</p>}
                {resource.rights_note && <p>{resource.rights_note}</p>}
              </div>
            )}

            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center text-[13.5px] font-bold text-[var(--bt-acc)]"
              >
                원문 링크 열기 →
              </a>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
