"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "model";
  content: string;
}

type View = "chat" | "inquiry" | "inquiry-done";

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "안녕하세요! 명성비전교회 챗봇입니다. 궁금하신 점을 편하게 물어보세요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [inquiryMsg, setInquiryMsg] = useState("");
  const [inquiryError, setInquiryError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, view]);

  useEffect(() => {
    if (isOpen && view === "chat") {
      inputRef.current?.focus();
    }
  }, [isOpen, view]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : (data.error ?? "오류가 발생했습니다.");
      setMessages([...nextMessages, { role: "model", content: reply }]);
    } catch {
      setMessages([
        ...nextMessages,
        { role: "model", content: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitInquiry() {
    setInquiryError("");
    if (!name.trim()) { setInquiryError("이름을 입력해주세요."); return; }
    if (!phone.trim()) { setInquiryError("연락처를 입력해주세요."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/chat/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), message: inquiryMsg.trim() || undefined }),
      });
      if (res.ok) {
        setView("inquiry-done");
      } else {
        const data = await res.json();
        setInquiryError(data.error ?? "저장에 실패했습니다.");
      }
    } catch {
      setInquiryError("연결에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function close() {
    setIsOpen(false);
    setView("chat");
  }

  return (
    <>
      {/* 채팅창 */}
      {isOpen && (
        <div className="fixed bottom-[72px] right-4 z-50 w-[calc(100vw-32px)] max-w-sm lg:bottom-6">
          <div className="flex h-[480px] flex-col overflow-hidden rounded-2xl shadow-2xl" style={{ background: "var(--color-surface, #fff)", border: "1px solid color-mix(in srgb, var(--color-primary-200, #c7d7f8) 60%, transparent)" }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--color-primary-600, #3b5bdb)" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">
                  ✝
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">명성비전교회</p>
                  <p className="text-xs text-white/70">AI 챗봇</p>
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-full p-1 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="닫기"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>

            {/* 탭 */}
            <div className="flex border-b" style={{ borderColor: "var(--color-primary-100, #e8effe)" }}>
              <button
                onClick={() => setView("chat")}
                className={`flex-1 py-2 text-xs font-medium transition ${view === "chat" ? "border-b-2 text-[var(--color-primary-600,#3b5bdb)]" : "text-gray-500 hover:text-gray-700"}`}
                style={view === "chat" ? { borderColor: "var(--color-primary-600, #3b5bdb)" } : {}}
              >
                채팅
              </button>
              <button
                onClick={() => { setView("inquiry"); setInquiryError(""); }}
                className={`flex-1 py-2 text-xs font-medium transition ${view === "inquiry" || view === "inquiry-done" ? "border-b-2 text-[var(--color-primary-600,#3b5bdb)]" : "text-gray-500 hover:text-gray-700"}`}
                style={view === "inquiry" || view === "inquiry-done" ? { borderColor: "var(--color-primary-600, #3b5bdb)" } : {}}
              >
                문의 남기기
              </button>
            </div>

            {/* 채팅 뷰 */}
            {view === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "rounded-br-sm text-white"
                            : "rounded-bl-sm bg-gray-100 text-gray-800"
                        }`}
                        style={msg.role === "user" ? { background: "var(--color-primary-600, #3b5bdb)" } : {}}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t px-3 py-2" style={{ borderColor: "var(--color-primary-100, #e8effe)" }}>
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && sendMessage()}
                      placeholder="메시지를 입력하세요"
                      disabled={isLoading}
                      className="flex-1 rounded-full border bg-gray-50 px-4 py-2 text-sm outline-none transition focus:bg-white focus:ring-2 disabled:opacity-50"
                      style={{ borderColor: "var(--color-primary-200, #c7d7f8)", "--tw-ring-color": "var(--color-primary-300, #a5c0f5)" } as React.CSSProperties}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
                      style={{ background: "var(--color-primary-600, #3b5bdb)" }}
                      aria-label="전송"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 문의 뷰 */}
            {view === "inquiry" && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <p className="mb-4 text-sm text-gray-600">
                  연락처를 남겨주시면 담당자가 직접 연락드립니다.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동"
                      maxLength={50}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: "var(--color-primary-200, #c7d7f8)", "--tw-ring-color": "var(--color-primary-300, #a5c0f5)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      maxLength={20}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: "var(--color-primary-200, #c7d7f8)", "--tw-ring-color": "var(--color-primary-300, #a5c0f5)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      문의 내용 <span className="text-gray-400">(선택)</span>
                    </label>
                    <textarea
                      value={inquiryMsg}
                      onChange={(e) => setInquiryMsg(e.target.value)}
                      placeholder="문의하실 내용을 입력해주세요"
                      maxLength={500}
                      rows={3}
                      className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
                      style={{ borderColor: "var(--color-primary-200, #c7d7f8)", "--tw-ring-color": "var(--color-primary-300, #a5c0f5)" } as React.CSSProperties}
                    />
                  </div>
                  {inquiryError && (
                    <p className="text-xs text-red-500">{inquiryError}</p>
                  )}
                  <button
                    onClick={submitInquiry}
                    disabled={isSubmitting}
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--color-primary-600, #3b5bdb)" }}
                  >
                    {isSubmitting ? "제출 중..." : "문의 남기기"}
                  </button>
                </div>
              </div>
            )}

            {/* 문의 완료 뷰 */}
            {view === "inquiry-done" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "var(--color-primary-100, #e8effe)" }}>
                  ✓
                </div>
                <p className="font-medium text-gray-800">문의가 접수되었습니다</p>
                <p className="text-sm text-gray-500">담당자 확인 후 연락드리겠습니다. 감사합니다.</p>
                <button
                  onClick={() => { setView("chat"); setName(""); setPhone(""); setInquiryMsg(""); }}
                  className="mt-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  style={{ background: "var(--color-primary-600, #3b5bdb)" }}
                >
                  채팅으로 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-[72px] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95 lg:bottom-6"
        style={{ background: "var(--color-primary-600, #3b5bdb)" }}
        aria-label={isOpen ? "채팅 닫기" : "채팅 열기"}
      >
        {isOpen ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
      </button>
    </>
  );
}
