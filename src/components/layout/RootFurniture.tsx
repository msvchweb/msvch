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
  
  // 별도 화면으로 쓰는 가입·링크·강의 발표 페이지에서는 글로벌 UI를 숨김
  const isStandalone = pathname === "/regist" || pathname.startsWith("/links") || pathname === "/ai-course/lessons" || /^\/ai-course\/week-[1-8]$/.test(pathname);

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
