'use client';

import { useState } from 'react';
import { usePWAInstall } from '@/lib/use-pwa-install';
import { Download, Smartphone, X, Share } from 'lucide-react';
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
  const { isInstallable, isInstalled, isIOS, canPrompt, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (!isInstallable || isInstalled) return null;

  const handleClick = async () => {
    if (isIOS || !canPrompt) {
      setShowGuide(true);
      return;
    }
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
    <>
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

      {showGuide && <InstallGuide isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}

export function InstallPWACard({ className }: { className?: string }) {
  const { isInstallable, isInstalled, isIOS, canPrompt, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (!isInstallable || isInstalled) return null;

  const handleClick = async () => {
    if (isIOS || !canPrompt) {
      setShowGuide(true);
      return;
    }
    await install();
  };

  return (
    <>
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

      {showGuide && <InstallGuide isIOS={isIOS} onClose={() => setShowGuide(false)} />}
    </>
  );
}

function InstallGuide({
  isIOS,
  onClose,
}: {
  isIOS: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white"
        >
          <X size={20} />
        </button>
        
        <div className="flex flex-col items-center text-center gap-4">
          <div className="bg-amber-400/20 p-4 rounded-full text-amber-400">
            <Smartphone size={32} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">홈 화면에 추가</h3>
            <p className="text-white/60 text-sm mt-2">
              관리자 페이지를 앱처럼 사용하려면 아래 순서대로 진행해주세요.
            </p>
          </div>
          
          <div className="w-full space-y-3 mt-2">
            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
              <span className="bg-white/10 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0">1</span>
              <p className="text-white/80 text-xs text-left">
                {isIOS ? (
                  <>
                    하단 메뉴의 <Share size={14} className="inline mx-1 text-blue-400" /> <b>공유 버튼</b>을 누릅니다.
                  </>
                ) : (
                  <>브라우저 메뉴를 엽니다.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
              <span className="bg-white/10 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0">2</span>
              <p className="text-white/80 text-xs text-left">
                <b>{isIOS ? "홈 화면에 추가" : "앱 설치 또는 홈 화면에 추가"}</b>를 선택합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-amber-400 text-slate-900 font-bold py-3 rounded-xl mt-2 hover:bg-amber-400/90 transition-colors"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}
