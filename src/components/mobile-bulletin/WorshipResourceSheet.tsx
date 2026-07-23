"use client";

import { useId, useRef } from "react";
import type { WorshipResource } from "@/types/mobile-bulletin";

function resourceActionLabel(kind: WorshipResource["kind"]): string {
  if (kind === "scripture") return "본문 보기";
  if (kind === "hymn") return "찬송가 보기";
  return "내용 보기";
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
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-liturgy-brand px-4 py-2 text-sm font-semibold text-liturgy-brand transition-colors hover:bg-liturgy-brand-soft motion-reduce:transition-none"
      >
        {resource.title} {actionLabel}
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
        className="fixed inset-0 m-0 h-dvh w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 open:flex open:items-end open:justify-center sm:open:items-center"
      >
        <div
          className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white px-5 pb-8 pt-5 text-left text-stone-800 transition-transform motion-reduce:transition-none sm:max-w-2xl sm:rounded-2xl sm:px-8 sm:py-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-xl font-bold text-stone-950">
                {resource.title}
              </h2>
              {resource.reference.trim() && (
                <p className="mt-1 break-words text-sm text-stone-600">
                  {resource.reference}
                </p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100"
            >
              닫기
            </button>
          </div>

          <div className="mt-6 whitespace-pre-wrap break-words text-base leading-8 text-stone-800">
            {resource.content}
          </div>

          {(resource.source_label || resource.rights_note) && (
            <div className="mt-6 border-t border-stone-200 pt-4 text-sm leading-6 text-stone-500">
              {resource.source_label && <p>출처: {resource.source_label}</p>}
              {resource.rights_note && <p>{resource.rights_note}</p>}
            </div>
          )}

          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center rounded-full border border-liturgy-brand px-4 py-2 text-sm font-semibold text-liturgy-brand hover:bg-liturgy-brand-soft"
            >
              원문 링크 열기
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
