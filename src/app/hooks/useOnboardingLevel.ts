'use client';

import { useCallback, useEffect, useState } from 'react';

export type OnboardingLevel = 'foundations' | 'exam-prep' | 'university' | 'self-learner';

const STORAGE_KEY = 'mathlon.onboardingLevel';

const LEVEL_LABELS: Record<OnboardingLevel, string> = {
  foundations: 'Foundations',
  'exam-prep': 'Exam prep',
  university: 'University',
  'self-learner': 'Self-learner',
};

export function readStoredLevel(): OnboardingLevel | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (raw && raw in LEVEL_LABELS) return raw as OnboardingLevel;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredLevel(level: OnboardingLevel): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // ignore
  }
}

export function levelLabel(level: OnboardingLevel): string {
  return LEVEL_LABELS[level] ?? level;
}

export function useOnboardingLevel() {
  const [level, setLevelState] = useState<OnboardingLevel | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLevelState(readStoredLevel());
    setReady(true);
  }, []);

  const setLevel = useCallback((next: OnboardingLevel) => {
    writeStoredLevel(next);
    setLevelState(next);
  }, []);

  const clearLevel = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setLevelState(null);
  }, []);

  return { level, ready, setLevel, clearLevel };
}
