/**
 * Guardrails for canvas text coming from the tutor model.
 *
 * The board is for math, not prose or performance direction. Conversational
 * LLMs (and TTS-oriented ones especially) leak bracketed audio/emotion tags
 * like "[warm]" or "[laughs]" into tool arguments, and markdown decorations
 * like "**bold**" that chat UIs understand but a whiteboard should never show
 * as raw markup. We strip those before they land on the canvas — carefully,
 * so real math such as intervals "[0, 5]", floor "[x]", LaTeX
 * "\begin{bmatrix}", or multiplication "*" is never touched.
 */

/** ElevenLabs v3 style audio/emotion/delivery tags (normalized, lowercase). */
const AUDIO_TAGS = new Set<string>([
  // emotions / tone
  'happy', 'sad', 'angry', 'excited', 'curious', 'sarcastic', 'nervous',
  'calm', 'cheerful', 'warm', 'mischievous', 'mischievously', 'thoughtful',
  'confident', 'hesitant', 'playful', 'serious', 'gentle', 'encouraging',
  'reassuring', 'empathetic', 'disappointed', 'surprised', 'awe', 'relieved',
  'frustrated', 'sympathetic', 'apologetic', 'dramatic', 'elated', 'sorrowful',
  'tearful', 'proud', 'amused', 'annoyed', 'bored',
  // volume / whisper / shout
  'whisper', 'whispers', 'whispering', 'shouting', 'shouts', 'yelling',
  'quietly', 'loudly', 'softly',
  // non-verbal sounds
  'laughs', 'laughing', 'laugh', 'giggles', 'giggling', 'chuckles',
  'chuckling', 'sighs', 'sighing', 'sigh', 'gasps', 'gasp', 'groans',
  'clears throat', 'coughs', 'sniffs', 'snorts', 'exhales', 'inhales',
  'breathes', 'hums', 'humming', 'sings', 'singing', 'mumbles', 'stammers',
  'stutters', 'crying', 'sobbing',
  // delivery / pacing
  'pause', 'pauses', 'long pause', 'short pause', 'beat', 'slowly', 'quickly',
  'rushed', 'deadpan', 'drawn out', 'emphasize', 'emphatic',
]);

/** Remove known bracketed audio tags; leave mathematical brackets intact. */
export function stripAudioTags(text: string): string {
  if (!text || text.indexOf('[') === -1) return text;
  const stripped = text.replace(/\[([^\]\n]{1,24})\]/g, (match, inner: string) => {
    const normalized = inner.trim().toLowerCase().replace(/\s+/g, ' ');
    return AUDIO_TAGS.has(normalized) ? '' : match;
  });
  // Collapse whitespace/newlines left behind by removed tags.
  return stripped
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

/**
 * Strip chat-markdown decorations agents dump onto the board.
 * Keeps the inner text; does not try to "bold" anything — the board has its
 * own typography. Avoids touching lone `*` used as multiplication.
 */
export function stripMarkdownDecorations(text: string): string {
  if (!text) return text;
  if (
    text.indexOf('*') === -1 &&
    text.indexOf('_') === -1 &&
    text.indexOf('`') === -1 &&
    text.indexOf('\\*') === -1
  ) {
    return text;
  }
  return (
    text
      // Agents sometimes escape markdown: \*\*bold\*\*
      .replace(/\\\*\\\*/g, '**')
      // **bold** / __bold__ (repeat for nested-ish leftovers)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Unbalanced heading markers agents leave on titles: **Title or Title**
      .replace(/^\s*\*\*\s*/g, '')
      .replace(/\s*\*\*\s*$/g, '')
      // Any remaining double-asterisk markers (not used in math)
      .replace(/\*\*/g, '')
      // *italic* only when clearly wrapped (word-ish), not a*b multiplication
      .replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, '$1$2')
      // `inline code`
      .replace(/`([^`\n]+)`/g, '$1')
  );
}

/** Full inbound cleanup for any canvas text write/replace. */
export function sanitizeCanvasText(text: string): string {
  return stripMarkdownDecorations(stripAudioTags(text));
}

/** Normalized key for detecting duplicate writes (case/space-insensitive). */
export function dedupeKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
