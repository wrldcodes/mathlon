/** @deprecated Prefer useDisplayName() / resolveDisplayName() — kept for rare static fallbacks. */
export { DEFAULT_DISPLAY_NAME as CURRENT_USER_NAME } from './displayName';

export const TOPIC_SUGGESTIONS = [
  { label: 'Quadratic equations', prompt: 'Teach me quadratic equations' },
  { label: 'Trigonometry', prompt: 'Teach me trigonometry' },
  { label: 'Calculus derivatives', prompt: 'Teach me calculus derivatives' },
  { label: 'Pythagorean theorem', prompt: 'Teach me the Pythagorean theorem' },
] as const;

export const HOME_TOPIC_CHIP_CLASSES = [
  'w-[172px]',
  'w-[128px]',
  'w-[172px]',
  'w-[182px]',
];

export function deriveSessionTitle(content: string): string {
  const clean = content.replace(/\n\n\[Attached images:.*\]$/s, '').trim();
  if (!clean) return 'New session';
  return clean.length > 42 ? `${clean.slice(0, 42).trim()}…` : clean;
}

export function sessionPath(sessionId: string, isDemo = false): string {
  const base = `/session/${sessionId}`;
  return isDemo ? `${base}?demo=true` : base;
}
