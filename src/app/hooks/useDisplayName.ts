'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DISPLAY_NAME,
  displayNameInitial,
  getOrCreateBrowserUserId,
  readStoredDisplayName,
  resolveDisplayName,
  writeStoredDisplayName,
} from '../lib/browserIdentity';

/**
 * Client display name + ensures a browser user id exists for session scoping.
 */
export function useDisplayName() {
  const [name, setNameState] = useState(DEFAULT_DISPLAY_NAME);
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // Mint/restore anonymous user id before any session API calls
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

  return {
    name,
    setName,
    ready,
    needsSetup,
    initial: displayNameInitial(name),
    refresh: () => setNameState(resolveDisplayName()),
  };
}
