"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface Props<T> {
  label: string;
  items: T[];
  max: number;
  createEmpty: () => T;
  renderRow: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode;
  onChange: (next: T[]) => void;
  addLabel?: string;
  minRows?: number;
  helpText?: string;
}

export function DynamicArrayField<T>({
  label,
  items,
  max,
  createEmpty,
  renderRow,
  onChange,
  addLabel = "추가",
  helpText,
}: Props<T>) {
  const atMax = items.length >= max;

  function add() {
    if (atMax) return;
    onChange([...items, createEmpty()]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  }
  function update(i: number, patch: Partial<T>) {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    onChange(next);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
          {helpText && <p className="mt-0.5 text-xs text-gray-500">{helpText}</p>}
        </div>
        <span className="text-xs text-gray-400">
          {items.length}/{max}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-gray-100 bg-gray-50/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">#{i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30"
                  aria-label="위로"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30"
                  aria-label="아래로"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded p-1 text-red-400 hover:bg-red-100 hover:text-red-600"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {renderRow(item, i, (patch) => update(i, patch))}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-gray-400">항목이 없습니다. 아래 &ldquo;{addLabel}&rdquo; 버튼으로 추가하세요.</p>
        )}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={atMax}
        className="mt-3 flex items-center gap-1 rounded-md border border-dashed border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}
