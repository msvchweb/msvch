"use client";

import { Sparkles } from "lucide-react";

export function AdminTourStartButton({
  className,
  label = "둘러보기",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("admin-tour:start"))}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 sm:text-sm"
      }
    >
      <Sparkles size={14} />
      {label}
    </button>
  );
}
