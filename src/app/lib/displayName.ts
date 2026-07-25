/**
 * Pre-auth display name for team testing and demos.
 * Each browser keeps its own name in localStorage so teammates don't all
 * appear as the same hardcoded person.
 */

export const DISPLAY_NAME_STORAGE_KEY = 'mathlon.displayName';

/** Fallback when nothing is stored or configured. */
export const DEFAULT_DISPLAY_NAME = 'Learner';

export function readEnvDisplayName(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_USER_NAME?.trim();
  return fromEnv || null;
}

export function readStoredDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeStoredDisplayName(name: string): string {
  const clean = name.trim() || DEFAULT_DISPLAY_NAME;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, clean);
    } catch {
      // ignore quota / private mode
    }
  }
  return clean;
}

/**
 * Resolve the name to show / pass to the voice agent.
 * Order: localStorage → NEXT_PUBLIC_USER_NAME → "Learner"
 */
export function resolveDisplayName(): string {
  return readStoredDisplayName() || readEnvDisplayName() || DEFAULT_DISPLAY_NAME;
}

export function displayNameInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'L';
  return trimmed.charAt(0).toUpperCase();
}
