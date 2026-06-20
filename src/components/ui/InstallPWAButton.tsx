'use client';

import { usePWAInstall } from '@/lib/use-pwa-install';
import { Download, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstallPWAButtonProps {
  className?: string;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  showIconOnly?: boolean;
}

export function InstallPWAButton({ 
  className, 
  variant = 'primary',
  size = 'md',
  showIconOnly = false 
}: InstallPWAButtonProps) {
  const { isInstalled, canPrompt, install } = usePWAInstall({
    hideWhenStandalone: false,
  });

  if (!canPrompt || isInstalled) return null;

  const handleClick = async () => {
    await install();
  };

  const variants = {
    primary: "bg-amber-400 text-slate-900 hover:bg-amber-500",
    outline: "border border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
    ghost: "text-gray-500 hover:bg-gray-100",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
    >
      <Download size={size === 'sm' ? 14 : 16} />
      {!showIconOnly && <span>앱으로 설치</span>}
    </button>
  );
}

export function InstallPWACard({ className }: { className?: string }) {
  const { isInstalled, canPrompt, install } = usePWAInstall({
    hideWhenStandalone: false,
  });

  if (!canPrompt || isInstalled) return null;

  const handleClick = async () => {
    await install();
  };

  return (
    <div className={cn(
      "flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 text-slate-900 shadow-sm",
      className
    )}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-600">
        <Smartphone className="h-6 w-6" />
      </div>
      <div className="space-y-1 text-center">
        <h3 className="text-lg font-semibold leading-none tracking-tight">앱으로 설치하기</h3>
        <p className="text-sm text-gray-500">
          홈 화면에 추가하여 더 편리하게 이용하세요.
        </p>
      </div>
      <button
        onClick={handleClick}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-500"
      >
        <Download className="h-4 w-4" />
        설치하기
      </button>
    </div>
  );
}
