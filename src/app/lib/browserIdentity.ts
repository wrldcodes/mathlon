/**
 * Pre-auth browser identity.
 *
 * Until real login lands, each browser gets a stable anonymous user id in
 * localStorage. Sessions are scoped to that id so teammates never share
 * history when hitting the same Mongo cluster. Display names live beside it.
 *
 * Not a security boundary — anyone can spoof the header. Good enough for
 * team testing; replace with auth before production multi-tenant use.
 */

export const BROWSER_USER_ID_KEY = 'mathlon.userId';
export const DISPLAY_NAME_STORAGE_KEY = 'mathlon.displayName';

/** Header the client sends on session API calls. */
export const MATHLON_USER_ID_HEADER = 'x-mathlon-user-id';

export const DEFAULT_DISPLAY_NAME = 'Learner';

/** `browser_<uuid>` — only this shape is accepted server-side. */
const USER_ID_RE = /^browser_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidBrowserUserId(value: string | null | undefined): value is string {
  return typeof value === 'string' && USER_ID_RE.test(value.trim());
}

function createBrowserUserId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `browser_${uuid}`;
}

/** Read or create the anonymous user id for this browser. Client-only. */
export function getOrCreateBrowserUserId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateBrowserUserId is client-only');
  }
  try {
    const existing = window.localStorage.getItem(BROWSER_USER_ID_KEY)?.trim();
    if (existing && isValidBrowserUserId(existing)) return existing;
    const next = createBrowserUserId();
    window.localStorage.setItem(BROWSER_USER_ID_KEY, next);
    return next;
  } catch {
    // Private mode / blocked storage — ephemeral id for this page load
    return createBrowserUserId();
  }
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
      // ignore
    }
  }
  return clean;
}

export function resolveDisplayName(): string {
  return readStoredDisplayName() || DEFAULT_DISPLAY_NAME;
}

export function displayNameInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'L';
  return trimmed.charAt(0).toUpperCase();
}

/** Parse and validate user id from a Request (header). */
export function userIdFromRequest(request: Request): string | null {
  const raw = request.headers.get(MATHLON_USER_ID_HEADER)?.trim() ?? '';
  return isValidBrowserUserId(raw) ? raw : null;
}
