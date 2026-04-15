"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    clarity?: (method: string, ...args: unknown[]) => void;
  }
}

export function ClarityIdentify({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name?: string | null;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.clarity) return;

    // Identify the logged-in user so Clarity can stitch sessions together
    // clarity("identify", customUserId, customSessionId, customPageId, friendlyName)
    const friendlyName = name || email;
    window.clarity("identify", userId, undefined, undefined, friendlyName);
  }, [userId, email, name]);

  // Also fire when clarity loads (in case the script hasn't loaded yet on first render)
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.clarity) {
        const friendlyName = name || email;
        window.clarity("identify", userId, undefined, undefined, friendlyName);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [userId, email, name]);

  return null;
}
