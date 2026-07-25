'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DISPLAY_NAME,
  displayNameInitial,
  readEnvDisplayName,
  readStoredDisplayName,
  resolveDisplayName,
  writeStoredDisplayName,
} from '../lib/displayName';

/**
 * Client display name for sidebar / home greeting / voice variables.
 * Prompts once when neither localStorage nor env has a name.
 */
export function useDisplayName() {
  const [name, setNameState] = useState(DEFAULT_DISPLAY_NAME);
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const stored = readStoredDisplayName();
    const env = readEnvDisplayName();
    if (stored) {
      setNameState(stored);
      setNeedsSetup(false);
    } else if (env) {
      // Seed localStorage from env so later sessions stay consistent in this browser
      setNameState(writeStoredDisplayName(env));
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

  return {
    name,
    setName,
    ready,
    needsSetup,
    initial: displayNameInitial(name),
    /** Re-read storage (e.g. after another tab updates the name). */
    refresh: () => setNameState(resolveDisplayName()),
  };
}
