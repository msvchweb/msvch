'use client';

import { useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePWAInstall } from '@/lib/use-pwa-install';

export function InstallButton() {
  const { isInstallable, isInstalled, isIOS, canPrompt, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS || !canPrompt) {
      setShowIOSGuide(true);
      return;
    }

    await install();
  };

  if (!isInstallable || isInstalled) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={cn(
          "w-full max-w-sm flex items-center gap-4 bg-church-gold/10 hover:bg-church-gold/20 border border-church-gold/30 hover:border-church-gold/50 rounded-xl px-5 py-4 text-white transition-all duration-200 group mb-6",
          "animate-in fade-in slide-in-from-top-4 duration-500"
        )}
      >
        <span className="bg-church-gold text-church-dark p-2 rounded-lg group-hover:scale-110 transition-transform duration-200">
          <Smartphone size={20} strokeWidth={2.5} />
        </span>
        <div className="flex flex-col items-start text-left">
          <span className="font-bold text-sm leading-tight text-church-gold">앱으로 설치하기</span>
          <span className="text-white/60 text-xs mt-0.5">홈 화면에 추가하여 편하게 이용하세요</span>
        </div>
        <Download size={18} className="ml-auto text-church-gold/50 group-hover:text-church-gold transition-colors" />
      </button>

      {/* iOS 설치 가이드 모달/팝업 */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl relative">
            <button 
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-church-gold/20 p-4 rounded-full">
                <Smartphone className="text-church-gold" size={32} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">홈 화면에 추가</h3>
                <p className="text-white/60 text-sm mt-2">
                  iPhone/iPad에서 앱처럼 사용하려면 아래 순서대로 진행해주세요.
                </p>
              </div>
              
              <div className="w-full space-y-3 mt-2">
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="bg-white/10 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0">1</span>
                  <p className="text-white/80 text-xs text-left">하단 메뉴의 <Share size={14} className="inline mx-1 text-blue-400" /> <b>공유 버튼</b>을 누릅니다.</p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                  <span className="bg-white/10 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0">2</span>
                  <p className="text-white/80 text-xs text-left">스크롤을 내려 <b>홈 화면에 추가</b>를 선택합니다.</p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full bg-church-gold text-church-dark font-bold py-3 rounded-xl mt-2 hover:bg-church-gold/90 transition-colors"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
