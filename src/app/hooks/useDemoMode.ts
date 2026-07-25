'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'mathlon_demo_used_at';

/**
 * Gates the free, unauthenticated `?demo=true` experience.
 *
 * Enforcement is anchored to `expiresAt` — a server-persisted timestamp
 * (`session.demoExpiresAt`, set once at session creation in
 * `src/lib/sessions/repository.ts`). Remaining time is *recomputed* from
 * that fixed wall-clock deadline on every tick, rather than decremented by
 * a local counter. That means the cap survives page reloads, a dropped
 * `?demo=true` query param, and the device sleeping mid-session — "5
 * minutes" always means 5 real minutes elapsed, not 5 minutes of
 * uninterrupted JS execution in one tab. Reopening an already-expired demo
 * session correctly shows it as expired immediately, instead of granting a
 * fresh countdown.
 *
 * Before a session exists (the homepage topic picker), there's no
 * `expiresAt` yet. `isConsumed` there is just a client-side soft "already
 * used your one free demo" gate for that pre-session screen — not a
 * security boundary. A real cross-device/cross-browser cap needs
 * server-side usage metering once accounts exist.
 */
export function useDemoMode(onExpire: () => void, expiresAt?: string | null) {
  const [isDemo, setIsDemo] = useState(false);
  const [isConsumed, setIsConsumed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Read demo state from the URL/localStorage once, on mount (client-only).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemoParam = params.get('demo') === 'true';
    setIsDemo(isDemoParam);

    // ?demo=true&reset=true clears the "already used" flag — handy for
    // repeat sales demos / QA on the same browser without opening devtools.
    if (isDemoParam && params.get('reset') === 'true') {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setIsConsumed(Boolean(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  const deadlineMs = useMemo(() => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [expiresAt]);

  // Recompute remaining time from the deadline every second instead of
  // decrementing — self-corrects after any gap (backgrounded tab, sleep,
  // throttled timers) instead of drifting or pausing.
  useEffect(() => {
    if (deadlineMs == null) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  // Fire the expiry callback exactly once, the tick the countdown reaches 0.
  const hasFiredExpiry = useRef(false);
  useEffect(() => {
    if (secondsLeft === 0 && !hasFiredExpiry.current) {
      hasFiredExpiry.current = true;
      onExpireRef.current();
    }
    if (secondsLeft !== 0) hasFiredExpiry.current = false;
  }, [secondsLeft]);

  /** Call when the learner picks a topic chip — marks the browser's one-time
   * free demo as used. Does not itself start any countdown; the real timer
   * only exists once a session (and its server-anchored expiresAt) exists. */
  const start = useCallback(() => {
    if (!isDemo || isConsumed) return;
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setIsConsumed(true);
  }, [isDemo, isConsumed]);

  return {
    /** True when the app was opened with ?demo=true. */
    isDemo,
    /** True once this browser has burned its one free demo (persists across reloads). */
    isConsumed,
    /** True while the countdown is actively running. */
    isActive: secondsLeft !== null && secondsLeft > 0,
    /** True the instant the countdown hits zero. */
    hasExpired: secondsLeft === 0,
    /** Seconds remaining, or null before a server-anchored deadline is known. */
    secondsLeft,
    start,
  };
}

export function formatDemoTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
