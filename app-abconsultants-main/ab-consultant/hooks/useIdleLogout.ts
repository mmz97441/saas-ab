import { useEffect, useState, useRef, useCallback } from 'react';

interface UseIdleLogoutOptions {
  enabled: boolean;
  timeoutMs: number;
  warningMs: number;
  onLogout: () => void | Promise<void>;
}

interface UseIdleLogoutResult {
  isWarning: boolean;
  remainingMs: number;
  extend: () => void;
}

// Excludes mousemove on purpose: cursor drift / cleaning software shouldn't
// reset the idle timer on a B2B finance app. Real activity = explicit input.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'] as const;
const TICK_MS = 1000;

export function useIdleLogout({ enabled, timeoutMs, warningMs, onLogout }: UseIdleLogoutOptions): UseIdleLogoutResult {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);
  const lastActivityRef = useRef<number>(Date.now());
  const isWarningRef = useRef(false);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  const recordActivity = useCallback(() => {
    // Once in warning state, ambient activity does NOT reset the timer.
    // The user must explicitly click "Rester connecté" to extend.
    // This prevents a sleeping user / passing cursor from indefinitely
    // keeping the session alive on shared machines.
    if (isWarningRef.current) return;
    lastActivityRef.current = Date.now();
  }, []);

  const extend = useCallback(() => {
    lastActivityRef.current = Date.now();
    isWarningRef.current = false;
    setIsWarning(false);
    setRemainingMs(timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      isWarningRef.current = false;
      setIsWarning(false);
      return;
    }

    lastActivityRef.current = Date.now();
    isWarningRef.current = false;
    setIsWarning(false);
    setRemainingMs(timeoutMs);

    ACTIVITY_EVENTS.forEach(evt => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        window.clearInterval(interval);
        ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, recordActivity));
        void onLogoutRef.current();
        return;
      }

      setRemainingMs(remaining);

      if (remaining <= warningMs && !isWarningRef.current) {
        isWarningRef.current = true;
        setIsWarning(true);
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(interval);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, recordActivity));
    };
  }, [enabled, timeoutMs, warningMs, recordActivity]);

  return { isWarning, remainingMs, extend };
}
