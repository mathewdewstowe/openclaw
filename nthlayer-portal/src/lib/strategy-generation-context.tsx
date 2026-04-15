"use client";

/**
 * Strategy document generation context.
 * Lives at the app layout level so generation persists across navigation.
 * The fetch stream keeps running even when the modal is closed.
 */

import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";

interface GenState {
  isGenerating: boolean;
  progress: number;
  step: string;
  detail: string;
  error: string;
  companyName: string;
}

interface StrategyGenContextValue extends GenState {
  startGeneration: (companyId: string, companyName: string) => void;
  clearError: () => void;
}

const STEPS: Record<string, { label: string; detail: string; pct: number }> = {
  resolver:      { label: "Synthesising stage outputs",   detail: "Resolving 5 stage reports into one canonical synthesis object — deduplicating facts, resolving contradictions, and aligning strategy.",  pct: 15 },
  resolver_done: { label: "Synthesis complete",           detail: "Stage outputs unified. Briefing 6 specialist writing agents with the synthesis object.",                                                     pct: 35 },
  sections:      { label: "Writing sections in parallel", detail: "Executive Summary, Strategic Context, Strategic Choice, Market Strategy, Commitment, and Appendix agents writing simultaneously.",            pct: 50 },
  sections_done: { label: "All sections written",         detail: "Six section groups complete. Passing to the Final Editor to assemble into one coherent document.",                                            pct: 82 },
};

const StrategyGenContext = createContext<StrategyGenContextValue | null>(null);

export function StrategyGenerationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GenState>({
    isGenerating: false,
    progress: 0,
    step: "",
    detail: "",
    error: "",
    companyName: "",
  });

  // Keep a ref to the abort controller so we can cancel if needed
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback((companyId: string, companyName: string) => {
    // Don't start if already running
    if (state.isGenerating) return;

    abortRef.current = new AbortController();

    setState({ isGenerating: true, progress: 5, step: "Starting pipeline", detail: "Fetching your 5 stage reports and initialising the generation pipeline.", error: "", companyName });

    (async () => {
      try {
        const response = await fetch("/api/strategy/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId }),
          signal: abortRef.current?.signal,
        });

        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const line = chunk.replace(/^data: /m, "").trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as { type: string; step?: string; message?: string; document?: string; error?: string };

              if (event.type === "progress" && event.step) {
                const s = STEPS[event.step];
                if (s) setState((prev) => ({ ...prev, step: s.label, detail: s.detail, progress: s.pct }));

              } else if (event.type === "complete" && event.document) {
                setState((prev) => ({ ...prev, step: "Complete", detail: "Document assembled and quality-checked.", progress: 100 }));
                await new Promise((r) => setTimeout(r, 600));

                // Trigger download
                const blob = new Blob([event.document], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${companyName.replace(/\s+/g, "-")}-strategy.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                setState({ isGenerating: false, progress: 0, step: "", detail: "", error: "", companyName: "" });
                return;

              } else if (event.type === "error") {
                throw new Error(event.error ?? "Generation failed");
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Generation failed";
        setState((prev) => ({ ...prev, isGenerating: false, error: message, progress: 0 }));
      }
    })();
  }, [state.isGenerating]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: "" }));
  }, []);

  return (
    <StrategyGenContext.Provider value={{ ...state, startGeneration, clearError }}>
      {children}
    </StrategyGenContext.Provider>
  );
}

export function useStrategyGeneration() {
  const ctx = useContext(StrategyGenContext);
  if (!ctx) throw new Error("useStrategyGeneration must be used within StrategyGenerationProvider");
  return ctx;
}
