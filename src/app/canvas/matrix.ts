import { drawHighlight, type GridCellAnnotation } from './annotations';
export type { GridCellAnnotation, MatrixCellAnnotation } from './annotations';

export type ParsedMatrix = {
  label: string;
  rows: string[][];
};

export type TeachingBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'matrix'; matrix: ParsedMatrix; prefix?: string };

/**
 * Bracket-grid rows: [[a, b], [c, d]] or [[a, b, c]]
 */
export function parseMatrixRows(matrixLiteral: string): string[][] | null {
  const trimmed = matrixLiteral.trim();
  if (!trimmed.startsWith('[[') || !trimmed.endsWith(']]')) return null;

  const inner = trimmed.slice(2, -2).trim();
  if (!inner) return null;

  if (!inner.includes('[')) {
    return [inner.split(',').map((value) => value.trim()).filter(Boolean)];
  }

  const rowChunks = inner.split(/\]\s*,\s*\[/);
  const rows = rowChunks
    .map((chunk) =>
      chunk
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length > 0);

  return rows.length ? rows : null;
}

/**
 * LaTeX array body → rows.
 * Accepts body of \begin{pmatrix} a & b \\ c & d \end{pmatrix}
 */
export function parseLatexMatrixBody(body: string): string[][] | null {
  let text = body.trim();
  if (!text) return null;

  // Normalize row breaks: \\ or \\\\ or real newlines
  text = text.replace(/\r\n/g, '\n');
  // Split on LaTeX row separators (one or more backslash pairs), not on single \commands
  const rawRows = text.split(/\\\\|\n/).map((row) => row.trim()).filter(Boolean);
  if (!rawRows.length) return null;

  const rows = rawRows
    .map((row) =>
      row
        .split('&')
        .map((cell) => cleanLatexCell(cell))
        .filter((cell) => cell.length > 0),
    )
    .filter((row) => row.length > 0);

  return rows.length ? rows : null;
}

/** Light cleanup of cell contents so the board stays readable. */
function cleanLatexCell(cell: string): string {
  return cell
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\ /g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MatrixMatch = {
  /** Text before this matrix (prose / other content). */
  prefix: string;
  matrix: ParsedMatrix;
  /** Absolute start of the matrix match in `source` (includes optional "A ="). */
  matchStart: number;
  /** Absolute end (exclusive) of the matrix match in `source`. */
  matchEnd: number;
};

export type ContentSegment =
  | { kind: 'text'; text: string }
  | { kind: 'matrix'; matrix: ParsedMatrix };

/** Find the matching `]]` for a `[[` start, respecting nested `[...]` cells. */
function findBracketMatrixEnd(source: string, start: number): number {
  if (source.slice(start, start + 2) !== '[[') return -1;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        // Expect a second closing bracket for `]]`
        if (source[i + 1] === ']') return i + 2;
        return -1;
      }
    }
  }
  return -1;
}

/**
 * If `before` ends with a standalone matrix label assignment (`A =`), return it.
 * Rejects expression LHSes like `A + B =` so the whole phrase stays as prefix.
 */
function trailingMatrixLabel(before: string): { label: string; labelAt: number } | null {
  const m = before.match(/([A-Za-z][A-Za-z0-9]*)\s*=\s*(?:\$\$\s*)?$/);
  if (!m || m.index == null) return null;
  const head = before.slice(0, m.index);
  // Ignore markdown `**` when checking for math operators (titles often end with **).
  const headForOps = head.replace(/\*+/g, ' ').replace(/\s+/g, ' ');
  // "A + B =" / "A+B =" are expressions, not grid labels
  if (/[+\-/×÷=^]\s*$/.test(headForOps)) return null;
  // Multiply: "2 * A =" (single * with spaces) — not markdown bold
  if (/\s\*\s+$/.test(head) || /[0-9]\*\s*$/.test(head)) return null;
  if (m.index > 0 && /[A-Za-z0-9]$/.test(head)) return null;
  return { label: m[1], labelAt: m.index };
}

/**
 * Find the first board-renderable matrix/grid in `source` (not pre-trimmed so
 * indices stay usable for multi-matrix splitting).
 */
export function findNextMatrix(source: string): MatrixMatch | null {
  if (!source) return null;

  type Candidate = MatrixMatch;
  let best: Candidate | null = null;

  const consider = (candidate: Candidate | null) => {
    if (!candidate) return;
    if (!best || candidate.matchStart < best.matchStart) best = candidate;
  };

  // 1) Bracket form: A = [[...]]
  const bracketLabeledRe = /([A-Za-z][A-Za-z0-9]*)\s*=\s*\[\[/g;
  let bracketLabeled: RegExpExecArray | null;
  while ((bracketLabeled = bracketLabeledRe.exec(source)) !== null) {
    const litStart = bracketLabeled.index + bracketLabeled[0].length - 2; // at `[[`
    const litEnd = findBracketMatrixEnd(source, litStart);
    if (litEnd < 0) continue;
    const literal = source.slice(litStart, litEnd);
    const rows = parseMatrixRows(literal);
    if (!rows) continue;
    consider({
      prefix: source.slice(0, bracketLabeled.index).replace(/^\$+|\$+$/g, ''),
      matrix: { label: bracketLabeled[1], rows },
      matchStart: bracketLabeled.index,
      matchEnd: litEnd,
    });
    break; // first left-to-right is enough; consider() keeps earliest
  }

  // Bare [[...]] (no label) — only if earlier than any labeled candidate
  if (source.includes('[[')) {
    let from = 0;
    while (from < source.length) {
      const bareStart = source.indexOf('[[', from);
      if (bareStart < 0) break;
      // Skip if this [[ is part of a labeled match we already considered
      const bareEnd = findBracketMatrixEnd(source, bareStart);
      if (bareEnd < 0) {
        from = bareStart + 2;
        continue;
      }
      const rows = parseMatrixRows(source.slice(bareStart, bareEnd));
      if (rows) {
        consider({
          prefix: source.slice(0, bareStart).replace(/^\$+|\$+$/g, ''),
          matrix: { label: '', rows },
          matchStart: bareStart,
          matchEnd: bareEnd,
        });
        break;
      }
      from = bareStart + 2;
    }
  }

  // 2) LaTeX environments — match begin/end, then decide label from the prefix
  //    so "A + B = \begin{pmatrix}" does not steal "B" as the grid label.
  const latexEnvRe =
    /\\begin\{((?:p|b|v|V)?matrix|array)\}([\s\S]*?)\\end\{\1\}/g;
  let latexMatch: RegExpExecArray | null;
  while ((latexMatch = latexEnvRe.exec(source)) !== null) {
    const parsedRows = parseLatexMatrixBody(latexMatch[2] ?? '');
    if (!parsedRows) continue;

    let matchStart = latexMatch.index;
    let matchEnd = latexMatch.index + latexMatch[0].length;
    let label = '';

    // Optional $$ wrappers around the environment
    if (source.slice(Math.max(0, matchStart - 2), matchStart) === '$$') {
      matchStart -= 2;
    }
    if (source.slice(matchEnd, matchEnd + 2) === '$$') {
      matchEnd += 2;
    }

    const before = source.slice(0, matchStart);
    const labeled = trailingMatrixLabel(before);
    if (labeled) {
      label = labeled.label;
      matchStart = labeled.labelAt;
      // Optional $$ between "A =" and \begin
      // (already excluded from label via trailingMatrixLabel pattern)
    }

    consider({
      prefix: source.slice(0, matchStart).replace(/^\$+|\$+$/g, ''),
      matrix: { label, rows: parsedRows },
      matchStart,
      matchEnd,
    });
    break;
  }

  return best;
}

/**
 * Pull a labeled or bare matrix/grid out of a canvas line.
 * Supports:
 *   A = [[a, b], [c, d]]
 *   $$A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$$
 *   \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}
 *
 * Note: only the *first* matrix. Prefer `splitContentWithMatrices` when a step
 * may contain several grids (A and B, or work + answer).
 */
export function extractMatrixFromLine(line: string): { prefix: string; matrix: ParsedMatrix } | null {
  const source = line.trim();
  if (!source) return null;
  const found = findNextMatrix(source);
  if (!found) return null;
  return {
    prefix: found.prefix.trim(),
    matrix: found.matrix,
  };
}

/**
 * Split a teaching step into ordered text/matrix segments so multi-matrix
 * lines render every grid (not just the first) and leave no raw TeX residue.
 */
export function splitContentWithMatrices(text: string): ContentSegment[] {
  const source = text
    .replace(/^\$\$+|\$\$+$/g, '')
    .replace(/^\$+|\$+$/g, '')
    .trim();
  if (!source) return [];

  const segments: ContentSegment[] = [];
  let remaining = source;
  let guard = 0;

  while (remaining && guard++ < 32) {
    const found = findNextMatrix(remaining);
    if (!found) {
      segments.push({ kind: 'text', text: remaining });
      break;
    }

    const before = remaining.slice(0, found.matchStart);
    if (before.trim()) {
      segments.push({ kind: 'text', text: before });
    }
    segments.push({ kind: 'matrix', matrix: found.matrix });
    remaining = remaining.slice(found.matchEnd);
  }

  // Drop empty text crumbs
  return segments.filter((seg) => seg.kind === 'matrix' || seg.text.trim().length > 0);
}

export function parseMatrixLine(line: string): ParsedMatrix | null {
  const extracted = extractMatrixFromLine(line);
  if (!extracted) return null;
  return extracted.matrix;
}

/** True if this text contains a board-renderable grid (bracket or LaTeX). */
export function textContainsRenderableGrid(text: string, gridLabel?: string): boolean {
  const segments = splitContentWithMatrices(text.replace(/\n/g, ' '));
  return segments.some((seg) => {
    if (seg.kind !== 'matrix') return false;
    return !gridLabel || seg.matrix.label === gridLabel;
  });
}

/**
 * Strip outer $$ / $ that agents often wrap around board text.
 * Does not try to fully render LaTeX — only cleans wrappers for plain display.
 */
export function stripMathDelimiters(text: string): string {
  let t = text.trim();
  if (t.startsWith('$$') && t.endsWith('$$') && t.length > 4) {
    t = t.slice(2, -2).trim();
  } else if (t.startsWith('$') && t.endsWith('$') && t.length > 2) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export type MatrixDrawMetrics = {
  width: number;
  height: number;
  rowHeight: number;
  colWidths: number[];
};

export function measureMatrixBlock(
  context: CanvasRenderingContext2D,
  matrix: ParsedMatrix,
  cellPaddingX = 16,
  rowGap = 8,
): MatrixDrawMetrics {
  const colCount = Math.max(...matrix.rows.map((row) => row.length), 1);
  const colWidths = Array.from({ length: colCount }, (_, columnIndex) => {
    const maxCell = Math.max(
      ...matrix.rows.map((row) => context.measureText(row[columnIndex] ?? '').width),
      12,
    );
    return maxCell + cellPaddingX * 2;
  });

  const rowHeight = 36;
  const height = matrix.rows.length * rowHeight + (matrix.rows.length - 1) * rowGap + 8;
  const width =
    colWidths.reduce((sum, value) => sum + value, 0) +
    24 +
    (matrix.label ? context.measureText(`${matrix.label} = `).width : 0);

  return { width, height, rowHeight: rowHeight + rowGap, colWidths };
}

export function drawMatrixBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  matrix: ParsedMatrix,
  options: {
    isDark: boolean;
    accentColor: string;
    baseColor: string;
    annotations?: GridCellAnnotation[];
  },
) {
  const metrics = measureMatrixBlock(context, matrix);
  let cursorX = x;

  context.save();
  context.fillStyle = options.baseColor;
  context.strokeStyle = options.accentColor;
  context.lineWidth = 2.5;

  if (matrix.label) {
    const label = `${matrix.label} =`;
    context.fillText(label, cursorX, y + metrics.rowHeight * 0.72);
    cursorX += context.measureText(`${label} `).width + 6;
  }

  const gridTop = y + 4;
  const gridHeight = matrix.rows.length * metrics.rowHeight - 8;
  const gridWidth = metrics.colWidths.reduce((sum, value) => sum + value, 0);

  context.beginPath();
  context.moveTo(cursorX + 10, gridTop);
  context.lineTo(cursorX, gridTop);
  context.lineTo(cursorX, gridTop + gridHeight);
  context.lineTo(cursorX + 10, gridTop + gridHeight);
  context.stroke();

  context.beginPath();
  const rightX = cursorX + gridWidth + 10;
  context.moveTo(rightX - 10, gridTop);
  context.lineTo(rightX, gridTop);
  context.lineTo(rightX, gridTop + gridHeight);
  context.lineTo(rightX - 10, gridTop + gridHeight);
  context.stroke();

  context.fillStyle = options.accentColor;
  let rowY = y;
  matrix.rows.forEach((row) => {
    let cellX = cursorX;
    row.forEach((value, columnIndex) => {
      const colWidth = metrics.colWidths[columnIndex] ?? 40;
      context.fillText(
        value,
        cellX + colWidth / 2 - context.measureText(value).width / 2,
        rowY + metrics.rowHeight * 0.72,
      );
      cellX += colWidth;
    });
    rowY += metrics.rowHeight;
  });

  const matchingAnnotations = (options.annotations ?? []).filter((annotation) => {
    if (annotation.kind !== 'grid_cell') return false;
    if (annotation.gridLabel && annotation.gridLabel !== matrix.label) return false;
    return annotation.row >= 1 && annotation.column >= 1;
  });

  if (matchingAnnotations.length) {
    matchingAnnotations.forEach((annotation) => {
      const rowIndex = annotation.row - 1;
      const columnIndex = annotation.column - 1;
      const row = matrix.rows[rowIndex];
      if (!row || columnIndex >= row.length) return;

      const cellX =
        cursorX + metrics.colWidths.slice(0, columnIndex).reduce((sum, value) => sum + value, 0);
      const cellY = y + 4 + rowIndex * metrics.rowHeight;
      const cellWidth = metrics.colWidths[columnIndex] ?? 40;
      const cellHeight = metrics.rowHeight - 8;
      const inset = 4;

      drawHighlight(
        context,
        {
          x: cellX + inset,
          y: cellY + inset,
          width: cellWidth - inset * 2,
          height: cellHeight - inset * 2,
        },
        annotation.style === 'circle'
          ? 'circle'
          : annotation.style === 'underline'
            ? 'underline'
            : 'box',
        options.isDark,
        annotation.label,
      );
    });
  }

  context.restore();
}

export function matrixBlockLineCount(rows: number): number {
  return Math.max(2, rows + 1);
}
