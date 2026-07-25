'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_DISPLAY_NAME,
  displayNameInitial,
  getOrCreateBrowserUserId,
  readStoredDisplayName,
  resolveDisplayName,
  writeStoredDisplayName,
} from '../lib/browserIdentity';

type DisplayNameContextValue = {
  name: string;
  setName: (next: string) => void;
  ready: boolean;
  needsSetup: boolean;
  initial: string;
  refresh: () => void;
};

const DisplayNameContext = createContext<DisplayNameContextValue | null>(null);

/**
 * Shared display name for the whole app (sidebar + home greeting stay in sync).
 * Also ensures a browser user id exists for session scoping.
 */
export function DisplayNameProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState(DEFAULT_DISPLAY_NAME);
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    getOrCreateBrowserUserId();

    const stored = readStoredDisplayName();
    if (stored) {
      setNameState(stored);
      setNeedsSetup(false);
    } else {
      setNameState(DEFAULT_DISPLAY_NAME);
      setNeedsSetup(true);
    }
    setReady(true);
  }, []);

  const setName = useCallback((next: string) => {
    const clean = writeStoredDisplayName(next);
    setNameState(clean);
    setNeedsSetup(false);
  }, []);

  const refresh = useCallback(() => {
    setNameState(resolveDisplayName());
    setNeedsSetup(!readStoredDisplayName());
  }, []);

  const value = useMemo<DisplayNameContextValue>(
    () => ({
      name,
      setName,
      ready,
      needsSetup,
      initial: displayNameInitial(name),
      refresh,
    }),
    [name, setName, ready, needsSetup, refresh],
  );

  return createElement(DisplayNameContext.Provider, { value }, children);
}

export function useDisplayName(): DisplayNameContextValue {
  const ctx = useContext(DisplayNameContext);
  if (!ctx) {
    throw new Error('useDisplayName must be used within DisplayNameProvider');
  }
  return ctx;
}
