import type { Metadata } from "next";
import { MenuContent } from "./MenuContent";

export const metadata: Metadata = { title: "메뉴" };

export default function MenuPage() {
  return <MenuContent />;
}
