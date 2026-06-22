"use client";

import { usePathname } from "next/navigation";

interface RootFurnitureProps {
  navigation: React.ReactNode;
  footer: React.ReactNode;
  chatbot: React.ReactNode;
  noticeBanner: React.ReactNode;
  children: React.ReactNode;
}

export function RootFurniture({
  navigation,
  footer,
  chatbot,
  noticeBanner,
  children,
}: RootFurnitureProps) {
  const pathname = usePathname();
  
  // 가입 페이지(/regist) 및 링크 모음(/links 하위 포함)에서는 모든 글로벌 UI 요소를 숨김
  const isStandalone = pathname === "/regist" || pathname.startsWith("/links");

  if (isStandalone) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      {navigation}
      <main className="flex-1 pb-14 lg:pb-0">{children}</main>
      {footer}
      {chatbot}
      {noticeBanner}
    </>
  );
}
