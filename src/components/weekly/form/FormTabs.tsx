"use client";

import { useState, type ReactNode } from "react";

export interface FormTab {
  key: string;
  label: string;
  description?: string;
  content: ReactNode;
}

interface Props {
  tabs: FormTab[];
  initialKey?: string;
  onActiveChange?: (key: string) => void;
}

export function FormTabs({ tabs, initialKey, onActiveChange }: Props) {
  const [active, setActive] = useState<string>(initialKey ?? tabs[0]?.key ?? "");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  function handleClick(key: string) {
    setActive(key);
    onActiveChange?.(key);
  }

  return (
    <div>
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Form sections">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleClick(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active === t.key
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      {activeTab?.description && (
        <p className="mb-3 text-xs text-gray-500">{activeTab.description}</p>
      )}
      <div>{activeTab?.content}</div>
    </div>
  );
}
