"use client";

import { Printer } from "lucide-react";

export function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-primary-700"
    >
      <Printer size={16} />
      인쇄하기
    </button>
  );
}
