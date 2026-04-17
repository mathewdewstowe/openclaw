"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { renderWithCitations } from "@/lib/render-citations";

const SUGGESTED = [
  "What are our biggest unvalidated assumptions?",
  "Which strategic bet is most exposed to risk?",
  "What should the board focus on at the next review?",
  "Where are the biggest gaps between our diagnosis and our strategy?",
  "What are the 3 most important actions we need to take?",
  "How confident are we in our strategic direction?",
];

type Message = { role: "user" | "assistant"; content: string };

export function AskMeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [context, setContext] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [completedStages, setCompletedStages] = useState(0);
  const [contextLoaded, setContextLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Fetch context when modal opens
  useEffect(() => {
    if (!open || contextLoaded) return;
    fetch("/api/strategy/chat-context")
      .then((r) => r.json())
      .then((d) => {
        setContext(d.context ?? "");
        setCompanyName(d.companyName ?? "");
        setCompletedStages(d.completedStages ?? 0);
        setContextLoaded(true);
      })
      .catch(() => setContextLoaded(true));
  }, [open, contextLoaded]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: messageText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamingContent("");
    try {
      const response = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, context }),
      });
      if (!response.ok) throw new Error("Chat failed");
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingContent(accumulated);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
      setStreamingContent("");
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, context]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 600,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>Ask Me Anything</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                {completedStages > 0
                  ? `Across ${completedStages} completed stage${completedStages !== 1 ? "s" : ""}${companyName ? ` · ${companyName}` : ""}`
                  : "Complete a stage report to ask questions"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Suggested chips — shown when empty */}
          {messages.length === 0 && !loading && completedStages > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  style={{ fontSize: 12, fontWeight: 500, color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {completedStages === 0 && contextLoaded && (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "#6b7280" }}>
              <p style={{ fontWeight: 600, color: "#374151", marginBottom: 8 }}>No strategy reports yet</p>
              <p style={{ fontSize: 13 }}>Complete at least one stage to start asking questions.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "#111827" : "#f3f4f6",
                color: m.role === "user" ? "#fff" : "#111827",
                fontSize: 14,
                lineHeight: 1.6,
              }}>
                {m.role === "assistant"
                  ? <div style={{ fontSize: 14 }}>{renderWithCitations(m.content)}</div>
                  : m.content}
              </div>
            </div>
          ))}

          {(loading || streamingContent) && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ maxWidth: "85%", padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "#f3f4f6", fontSize: 14, lineHeight: 1.6, color: "#111827" }}>
                {streamingContent
                  ? <div>{renderWithCitations(streamingContent)}<span style={{ display: "inline-block", width: 8, height: 14, background: "#111827", marginLeft: 2, animation: "blink 1s step-start infinite", verticalAlign: "text-bottom" }} /></div>
                  : <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
                      {[0, 1, 2].map((n) => (
                        <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af", animation: `bounce 1.2s ${n * 0.2}s infinite` }} />
                      ))}
                    </div>
                }
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
          <style>{`
            @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
            @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
          `}</style>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "8px 8px 8px 14px", background: "#fff" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your strategy…"
              rows={1}
              style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 14, fontFamily: "inherit", lineHeight: 1.5, background: "transparent", color: "#111827", minHeight: 24, maxHeight: 120, overflowY: "auto" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: 8, background: input.trim() && !loading ? "#111827" : "#e5e7eb", border: "none", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 150ms" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? "#fff" : "#9ca3af"} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0", textAlign: "center" }}>Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}
