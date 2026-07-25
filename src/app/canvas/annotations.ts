/**
 * Visual annotations for the teaching canvas — tutor highlights so the student
 * can spot the exact item being discussed (hand-drawn box / circle / underline).
 *
 * Kinds:
 * - text_match: box/circle/underline a phrase already written on the board
 * - step:       frame an entire canvas step
 * - grid_cell:  box/circle a cell in any row×column grid written on the board
 */

export type AnnotationStyle = 'box' | 'circle' | 'underline';

export type GridCellAnnotation = {
  kind: 'grid_cell';
  /** Optional label of the grid (e.g. "A", "R") when several are on the board. */
  gridLabel?: string;
  row: number;
  column: number;
  style?: AnnotationStyle;
  label?: string;
};

export type TextMatchAnnotation = {
  kind: 'text_match';
  /** Substring already present on the canvas (e.g. "opposite", "x^2", "dy/dx"). */
  match: string;
  /** Which occurrence if the match appears more than once (1-based). Default 1. */
  occurrence?: number;
  style?: AnnotationStyle;
  label?: string;
};

export type StepAnnotation = {
  kind: 'step';
  style?: AnnotationStyle;
  label?: string;
};

export type CanvasAnnotationSpec = (
  | GridCellAnnotation
  | TextMatchAnnotation
  | StepAnnotation
) & {
  /** Optional 0-based canvas step index. If omitted, the app picks a sensible target. */
  targetStepIndex?: number;
};

/** @deprecated Use GridCellAnnotation — kept for type imports that still use the old name. */
export type MatrixCellAnnotation = GridCellAnnotation;

export type AnnotationBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeAnnotationStyle(style?: string | null): AnnotationStyle {
  if (style === 'circle' || style === 'underline') return style;
  return 'box';
}

export function normalizeAnnotationSpec(
  annotation: Partial<CanvasAnnotationSpec> & {
    kind?: string;
    /** legacy aliases accepted from older tool calls */
    matrixLabel?: string;
  },
): CanvasAnnotationSpec | null {
  const kindRaw = String(annotation.kind ?? '').trim();
  // Accept legacy kind name from earlier tool configs
  const kind = kindRaw === 'matrix_cell' ? 'grid_cell' : kindRaw;
  const style = normalizeAnnotationStyle(
    typeof annotation.style === 'string' ? annotation.style : undefined,
  );
  const label =
    typeof annotation.label === 'string' && annotation.label.trim()
      ? annotation.label.trim()
      : undefined;
  const targetStepIndex =
    annotation.targetStepIndex == null || !Number.isFinite(Number(annotation.targetStepIndex))
      ? undefined
      : Math.max(0, Math.floor(Number(annotation.targetStepIndex)));

  if (kind === 'grid_cell') {
    const row = Number((annotation as GridCellAnnotation).row);
    const column = Number((annotation as GridCellAnnotation).column);
    if (!Number.isFinite(row) || !Number.isFinite(column)) return null;
    if (row < 1 || column < 1) return null;
    const fromGrid =
      typeof (annotation as GridCellAnnotation).gridLabel === 'string'
        ? (annotation as GridCellAnnotation).gridLabel!.trim()
        : '';
    const fromLegacy =
      typeof annotation.matrixLabel === 'string' ? annotation.matrixLabel.trim() : '';
    const gridLabel = fromGrid || fromLegacy || undefined;
    return {
      kind: 'grid_cell',
      row: Math.floor(row),
      column: Math.floor(column),
      gridLabel,
      style: style === 'underline' ? 'box' : style,
      label,
      targetStepIndex,
    };
  }

  if (kind === 'text_match' || !kind) {
    const match =
      typeof (annotation as TextMatchAnnotation).match === 'string'
        ? (annotation as TextMatchAnnotation).match.trim()
        : '';
    if (!match) return null;
    const occurrenceRaw = Number((annotation as TextMatchAnnotation).occurrence ?? 1);
    const occurrence =
      Number.isFinite(occurrenceRaw) && occurrenceRaw >= 1 ? Math.floor(occurrenceRaw) : 1;
    return {
      kind: 'text_match',
      match,
      occurrence,
      style,
      label,
      targetStepIndex,
    };
  }

  if (kind === 'step') {
    return {
      kind: 'step',
      style: style === 'underline' ? 'box' : style,
      label,
      targetStepIndex,
    };
  }

  return null;
}

/** Find the Nth occurrence of `match` in `haystack` (case-sensitive, then case-insensitive). */
export function findMatchIndex(
  haystack: string,
  match: string,
  occurrence = 1,
): { start: number; end: number; caseSensitive: boolean } | null {
  if (!match || occurrence < 1) return null;

  let from = 0;
  let found = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(match, from);
    if (idx === -1) break;
    found += 1;
    if (found === occurrence) {
      return { start: idx, end: idx + match.length, caseSensitive: true };
    }
    from = idx + 1;
  }

  const lowerHay = haystack.toLowerCase();
  const lowerMatch = match.toLowerCase();
  from = 0;
  found = 0;
  while (from <= lowerHay.length) {
    const idx = lowerHay.indexOf(lowerMatch, from);
    if (idx === -1) break;
    found += 1;
    if (found === occurrence) {
      return { start: idx, end: idx + match.length, caseSensitive: false };
    }
    from = idx + 1;
  }

  return null;
}

export function contentContainsMatch(content: string, match: string, occurrence = 1): boolean {
  return findMatchIndex(content, match, occurrence) != null;
}

/**
 * Given a flat list of laid-out text lines, locate bounds for a substring match.
 * `fullText` should be the join of lines with `\n` (same order as `lines`).
 */
export function findTextMatchBounds(
  context: CanvasRenderingContext2D,
  lines: Array<{ text: string; x: number; y: number; lineHeight: number }>,
  match: string,
  occurrence = 1,
): AnnotationBounds | null {
  if (!lines.length || !match) return null;

  const fullText = lines.map((line) => line.text).join('\n');
  const hit = findMatchIndex(fullText, match, occurrence);
  if (!hit) return null;

  let cursor = 0;
  for (const line of lines) {
    const lineStart = cursor;
    const lineEnd = cursor + line.text.length;
    if (hit.start >= lineStart && hit.start <= lineEnd) {
      const localStart = hit.start - lineStart;
      const localEnd = Math.min(hit.end - lineStart, line.text.length);
      const prefix = line.text.slice(0, localStart);
      const fragment = line.text.slice(localStart, localEnd);
      const x = line.x + context.measureText(prefix).width;
      const width = Math.max(context.measureText(fragment).width, 8);
      const height = line.lineHeight * 0.85;
      const y = line.y - height * 0.78;
      return { x, y, width, height };
    }
    cursor = lineEnd + 1;
  }

  return null;
}

/** High-contrast mark color (reads CSS vars when available). */
export function annotationStrokeColor(isDark: boolean): string {
  if (typeof document !== 'undefined') {
    const fromCss = getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas-annotate')
      .trim();
    if (fromCss) return fromCss;
  }
  // Fallbacks: orange-red on cream, bright orange on dark — not gold-on-paper
  return isDark ? '#fb923c' : '#c2410c';
}

/** Draw a tutor-style highlight (box, circle, or underline) in step-local coordinates. */
export function drawHighlight(
  context: CanvasRenderingContext2D,
  bounds: AnnotationBounds,
  style: AnnotationStyle,
  isDark: boolean,
  label?: string,
) {
  const stroke = annotationStrokeColor(isDark);
  context.save();
  context.lineWidth = 3;
  context.strokeStyle = stroke;
  context.fillStyle = stroke;
  context.font = '20px Caveat, Kalam, cursive';

  const inset = 3;
  const x = bounds.x - inset;
  const y = bounds.y - inset;
  const width = bounds.width + inset * 2;
  const height = bounds.height + inset * 2;

  if (style === 'underline') {
    context.beginPath();
    context.moveTo(bounds.x, bounds.y + bounds.height * 0.95);
    const midX = bounds.x + bounds.width / 2;
    const endX = bounds.x + bounds.width;
    const baseY = bounds.y + bounds.height * 0.95;
    context.quadraticCurveTo(midX, baseY + 4, endX, baseY - 1);
    context.stroke();
  } else if (style === 'circle') {
    context.beginPath();
    context.ellipse(
      x + width / 2,
      y + height / 2,
      Math.max(width / 2, 10),
      Math.max(height / 2, 10),
      -0.08,
      0,
      Math.PI * 2,
    );
    context.stroke();
  } else {
    const radius = 8;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.stroke();
  }

  if (label) {
    context.fillText(label, x + width + 8, y + height / 2 + 6);
  }

  context.restore();
}
