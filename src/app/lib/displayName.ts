/**
 * Display name helpers — re-exported from browserIdentity for a stable import path.
 * Names are browser-local only (no env var).
 */

export {
  DEFAULT_DISPLAY_NAME,
  DISPLAY_NAME_STORAGE_KEY,
  displayNameInitial,
  readStoredDisplayName,
  resolveDisplayName,
  writeStoredDisplayName,
} from './browserIdentity';
