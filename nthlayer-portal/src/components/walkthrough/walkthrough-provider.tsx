"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { DESKTOP_STEPS, MOBILE_STEPS, type WalkthroughStep } from "./walkthrough-steps";

const STORAGE_KEY = "nthlayer_walkthrough_v1";
const DISCLAIMER_KEY = "nthlayer_disclaimer_accepted_v1";

interface WalkthroughCtx {
  isActive: boolean;
  currentStep: number;
  steps: WalkthroughStep[];
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

const WalkthroughContext = createContext<WalkthroughCtx | null>(null);

export function useWalkthrough() {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) throw new Error("useWalkthrough must be used within WalkthroughProvider");
  return ctx;
}

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const allSteps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;

  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Filter to only steps whose target element actually exists in the DOM
  const [visibleSteps, setVisibleSteps] = useState<WalkthroughStep[]>(allSteps);

  const resolveVisibleSteps = useCallback(() => {
    const visible = allSteps.filter(
      (s) => document.querySelector(`[data-tour="${s.target}"]`) !== null,
    );
    setVisibleSteps(visible.length > 0 ? visible : allSteps);
  }, [allSteps]);

  // Auto-start on first visit (after disclaimer is accepted)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyDone = localStorage.getItem(STORAGE_KEY);
    if (alreadyDone) return;

    // Wait for disclaimer to be accepted first
    const check = () => {
      const disclaimerAccepted = sessionStorage.getItem(DISCLAIMER_KEY);
      if (disclaimerAccepted) {
        resolveVisibleSteps();
        setCurrentStep(0);
        setIsActive(true);
        return true;
      }
      return false;
    };

    // Check immediately, then poll briefly in case disclaimer modal is showing
    const timer = setTimeout(() => {
      if (!check()) {
        const interval = setInterval(() => {
          if (check()) clearInterval(interval);
        }, 500);
        // Stop polling after 30s
        setTimeout(() => clearInterval(interval), 30000);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  }, []);

  const start = useCallback(() => {
    resolveVisibleSteps();
    setCurrentStep(0);
    setIsActive(true);
  }, [resolveVisibleSteps]);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= visibleSteps.length - 1) {
        finish();
        return 0;
      }
      return prev + 1;
    });
  }, [visibleSteps.length, finish]);

  const prev = useCallback(() => {
    setCurrentStep((p) => Math.max(0, p - 1));
  }, []);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  return (
    <WalkthroughContext.Provider
      value={{ isActive, currentStep, steps: visibleSteps, start, next, prev, skip }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
}
