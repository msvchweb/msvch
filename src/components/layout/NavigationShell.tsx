"use client";

import { NewContentProvider } from "@/lib/new-content-provider";
import { Header } from "./Header";
import { BottomTabBar } from "./BottomTabBar";

/**
 * Header + BottomTabBar를 하나의 Client Component 경계로 묶음.
 * NewContentProvider를 여기서만 사용하여:
 * - API 호출 1회 (이중 호출 방지)
 * - Server Component인 main/Footer를 클라이언트 번들에 포함시키지 않음
 */
export function NavigationShell() {
  return (
    <NewContentProvider>
      <Header />
      <BottomTabBar />
    </NewContentProvider>
  );
}
