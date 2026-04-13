"use client";

import { useEffect, useRef, useState } from "react";

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useMinimumLoadingDuration(active: boolean, minimumMs = 3000) {
  const startedAtRef = useRef<number | null>(active ? getNow() : null);
  const previousActiveRef = useRef(active);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      if (!previousActiveRef.current) {
        startedAtRef.current = getNow();
      }

      previousActiveRef.current = true;
      setVisible(true);
      return undefined;
    }

    previousActiveRef.current = false;

    if (!visible) {
      startedAtRef.current = null;
      return undefined;
    }

    const startedAt = startedAtRef.current ?? getNow();
    const now = getNow();
    const elapsed = now - startedAt;
    const remaining = Math.max(0, minimumMs - elapsed);
    const timer = window.setTimeout(() => {
      startedAtRef.current = null;
      setVisible(false);
    }, remaining);

    return () => {
      window.clearTimeout(timer);
    };
  }, [active, minimumMs, visible]);

  return visible;
}
