"use client";

import { useRef, useState } from "react";
import { Copy } from "lucide-react";
import styles from "./lesson.module.css";

export default function CopyLessonPrompt({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const details = useRef<HTMLDetailsElement>(null);
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("manual");
      if (details.current) details.current.open = true;
    }
  }
  return <div className={styles.copyArea}>
    <button type="button" className={styles.action} onClick={copy}><Copy size={18} aria-hidden />요청문 전체 복사</button>
    <p role="status" className={styles.copyStatus}>{status === "copied" ? "복사했어요. AI 대화에 붙여넣으세요." : status === "manual" ? "아래 내용을 직접 선택해 복사해 주세요." : ""}</p>
    <details ref={details} className={styles.promptDetails}><summary>전체 요청문 보기</summary>{status === "manual" ? <textarea className={styles.manualCopy} aria-label="복사할 요청문" value={text} readOnly rows={9} onFocus={event => event.currentTarget.select()} /> : <pre>{text}</pre>}</details>
  </div>;
}
