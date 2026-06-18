'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

interface UsePWAInstallOptions {
  showFallback?: boolean;
}

export function usePWAInstall({ showFallback = false }: UsePWAInstallOptions = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hasCheckedInstallState, setHasCheckedInstallState] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const canPrompt = deferredPrompt !== null;
  const isInstallable =
    hasCheckedInstallState && !isInstalled && (canPrompt || isIOS || showFallback);

  useEffect(() => {
    // 1. 이미 설치되어 있는지 확인 (Standalone 모드)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone
      || document.referrer.includes('android-app://');
    
    requestAnimationFrame(() => {
      setIsInstalled(!!isStandaloneMode);

      // 2. iOS 여부 확인
      const userAgent = window.navigator.userAgent.toLowerCase();
      const ios = /iphone|ipad|ipod/.test(userAgent)
        || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
      setIsIOS(ios);
      setHasCheckedInstallState(true);
    });

    const handler = (e: Event) => {
      // 브라우저 기본 설치 팝업 방지 (Android/Chrome)
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setHasCheckedInstallState(true);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    // 저장해둔 설치 프롬프트 표시
    await deferredPrompt.prompt();
    
    // 사용자의 선택 결과 대기
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }
    
    // 프롬프트는 1회용이므로 초기화
    setDeferredPrompt(null);
    return outcome === 'accepted';
  };

  return { isInstallable, isInstalled, isIOS, canPrompt, install };
}
