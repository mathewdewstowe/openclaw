"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

const SUGGESTED = [
  "What are our biggest unvalidated assumptions?",
  "Which strategic bet is most exposed to risk?",
  "What should the board focus on at the next review?",
  "Where are the biggest gaps between our diagnosis and our strategy?",
  "What are the 3 most important actions we need to take?",
  "How confident are we in our strategic direction?",
];

import { renderWithCitations } from "@/lib/render-citations";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatClient({
  companyName,
  context,
  completedStages,
}: {
  companyName: string;
  context: string;
  completedStages: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [chipHover, setChipHover] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;
    const newMessages: Message[] = [...messages, { role: "user" as const, content: messageText }];
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ maxWidth: isMobile ? "100%" : 800, margin: "0 auto", padding: isMobile ? "16px 0 120px" : "32px 24px 80px" }}>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .cursor-blink {
          animation: blink 1s step-start infinite;
          display: inline-block;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 8 }}>
          Ask Inflexion
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Ask questions across all {completedStages} completed strategy report{completedStages !== 1 ? "s" : ""} for {companyName}
        </p>
      </div>

      {/* Empty state — no completed stages */}
      {completedStages === 0 && (
        <div
          style={{
            border: "1.5px dashed #d1d5db",
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          <p style={{ margin: "0 0 12px", fontWeight: 600, color: "#374151", fontSize: 15 }}>
            No strategy reports available yet
          </p>
          <p style={{ margin: "0 0 20px" }}>
            Complete at least one stage report to start asking questions.
          </p>
          <Link
            href="/inflexion/strategy"
            style={{
              display: "inline-block",
              background: "#111827",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to Strategy
          </Link>
        </div>
      )}

      {/* Suggested questions — shown when no messages and stages available */}
      {completedStages > 0 && messages.length === 0 && !loading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
          {SUGGESTED.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              onMouseEnter={() => setChipHover(i)}
              onMouseLeave={() => setChipHover(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: chipHover === i ? "#1f2937" : "#111827",
                border: "none",
                borderRadius: 999,
                padding: "10px 18px 10px 10px",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
                transition: "background 0.15s",
                fontFamily: "inherit",
              }}
            >
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "rgba(163,230,53,0.15)",
                flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      {completedStages > 0 && (
        <>
          <div
            style={{
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={
                    msg.role === "user"
                      ? {
                          background: "#111827",
                          color: "#fff",
                          borderRadius: "12px 12px 0 12px",
                          padding: "12px 16px",
                          fontSize: 14,
                          maxWidth: "75%",
                          alignSelf: "flex-end",
                        }
                      : {
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px 12px 12px 0",
                          padding: "12px 16px",
                          fontSize: 14,
                          maxWidth: "85%",
                          alignSelf: "flex-start",
                          color: "#374151",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap" as const,
                        }
                  }
                >
                  {msg.role === "assistant" ? renderWithCitations(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {loading && streamingContent && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px 12px 12px 0",
                    padding: "12px 16px",
                    fontSize: 14,
                    maxWidth: "85%",
                    color: "#374151",
                    lineHeight: 1.7,
                  }}
                >
                  {renderWithCitations(streamingContent)}
                  <span className="cursor-blink">▋</span>
                </div>
              </div>
            )}

            {/* Loading indicator when no content yet */}
            {loading && !streamingContent && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px 12px 12px 0",
                    padding: "12px 16px",
                    fontSize: 14,
                    color: "#9ca3af",
                  }}
                >
                  <span className="cursor-blink">▋</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={isMobile ? { position: "fixed", bottom: 60, left: 0, right: 0, display: "flex", gap: 8, alignItems: "flex-end", background: "#fff", borderTop: "1px solid #e5e7eb", padding: "8px 12px", zIndex: 40 } : { position: "relative", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your strategy..."
              rows={1}
              style={{
                flex: 1,
                minHeight: 52,
                maxHeight: 200,
                padding: "14px 16px",
                fontSize: 14,
                border: "1.5px solid #e5e7eb",
                borderRadius: 12,
                resize: "none" as const,
                fontFamily: "inherit",
                outline: "none",
                color: "#111827",
                boxSizing: "border-box" as const,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#111827"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "#d1d5db" : "#111827",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                height: 52,
                whiteSpace: "nowrap" as const,
                transition: "background 0.15s",
              }}
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>

          {/* Footer note */}
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
            Responses are based on your completed strategy reports only.
          </p>
        </>
      )}
    </div>
  );
}
