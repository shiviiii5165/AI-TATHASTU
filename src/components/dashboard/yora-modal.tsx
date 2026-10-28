"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, Sparkles, User, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const SUGGESTED_PROMPTS = [
  "What are my biggest skill gaps?",
  "Connect with peer researchers",
  "View my career roadmap and milestones",
  "Find top internships and opportunities",
  "Check my profile completeness and stats",
];

const INITIAL_MESSAGES = [
  {
    sender: "yora",
    text: "Hi! I'm Yora, your career guide. Ask me anything about your skills, roadmap milestones, or finding opportunities. How can I help today?",
    time: "Just now",
  },
];

export function YoraModal({
  open,
  onOpenChange,
  userName = "Scholar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
}) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || isTyping) return;

    const userMsg = {
      sender: "user",
      text,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await res.json();
      const responseText = data.response || "I've analyzed your profile. How else can I assist your career goals?";

      setMessages((prev) => [
        ...prev,
        {
          sender: "yora",
          text: responseText,
          time: "Just now",
        },
      ]);
    } catch (err) {
      console.error("Yora chat request error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "yora",
          text: "I had trouble connecting just now. Please try asking again in a moment, or explore your milestones on the dashboard.",
          time: "Just now",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-xl rounded-2xl sm:rounded-3xl p-0 overflow-hidden border border-slate-200/90 shadow-2xl bg-white max-h-[92dvh] sm:max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FFF0F3] via-[#F8EEFD] to-[#F1F5FF] px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative size-9 sm:size-10 rounded-full overflow-hidden border-2 border-white shadow-xs shrink-0">
              <Image
                src="/brand/yora-avatar.jpg"
                alt="Yora AI Assistant"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                Yora
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-[#FF496D]/10 text-[#FF496D]">
                  <Sparkles className="size-3 mr-1" /> AI Companion
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">Live intelligence for {userName} · Verified proof-of-work</p>
            </div>
          </div>
        </div>

        {/* Chat message body */}
        <div ref={scrollRef} className="p-4 sm:p-6 flex-1 min-h-[220px] max-h-[380px] overflow-y-auto space-y-4 text-sm bg-slate-50/30">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.sender === "user" ? "flex-row-reverse" : ""}`}
            >
              {m.sender === "yora" ? (
                <div className="relative size-7 rounded-full overflow-hidden shrink-0 mt-0.5 border border-slate-200">
                  <Image
                    src="/brand/yora-avatar.jpg"
                    alt="Yora"
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
              ) : (
                <div className="size-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs mt-0.5">
                  <User className="size-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[82%] px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs sm:text-sm ${
                  m.sender === "user"
                    ? "bg-slate-900 text-white rounded-tr-xs"
                    : "bg-white text-slate-800 border border-slate-200/70 shadow-xs rounded-tl-xs leading-relaxed whitespace-pre-line"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 pl-9">
              <span className="inline-flex gap-1 items-center">
                <span className="size-1.5 rounded-full bg-[#FF496D] animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-[#FF496D] animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-[#FF496D] animate-bounce" />
              </span>
              <span>Yora is analyzing your career profile…</span>
            </div>
          )}
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 sm:px-6 py-2 sm:py-2.5 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              type="button"
              disabled={isTyping}
              onClick={() => handleSend(prompt)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 transition-colors font-medium border border-slate-200/50 cursor-pointer disabled:opacity-50 touch-manipulation min-h-[32px]"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            type="text"
            value={input}
            disabled={isTyping}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Ask Yora anything about your roadmap…`}
            className="flex-1 text-base md:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 sm:px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF496D]/20 focus:border-[#FF496D] transition-all disabled:opacity-60"
          />
          <button
            type="button"
            disabled={isTyping || !input.trim()}
            onClick={() => handleSend()}
            className="size-10 sm:size-10 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white flex items-center justify-center shrink-0 shadow-sm hover:opacity-95 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[40px] min-w-[40px]"
            aria-label="Send message"
          >
            {isTyping ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
