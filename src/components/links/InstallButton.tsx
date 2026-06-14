'use client';

import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. 이미 설치되어 있는지 확인
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsStandalone(isStandaloneMode);

    // 2. iOS 여부 확인
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // 3. Android/Chrome 설치 프로프트 이벤트 리스너
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS이거나 이미 설치 가능 환경인 경우 가시성 확보 (테스트 등을 위해 항상 노출할 수도 있음)
    if (ios && !isStandaloneMode) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // 프로프트가 없는데 클릭된 경우 (안내 메시지 등)
      alert('이 브라우저에서는 직접 설치를 지원하지 않습니다. 브라우저 메뉴에서 "홈 화면에 추가"를 선택해주세요.');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible || isStandalone) return null;

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
