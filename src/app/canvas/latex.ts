/**
 * LaTeX rendering for the teaching board via KaTeX.
 * Math content is typeset properly — not dumped as raw source.
 *
 * Matrices/grids are emitted as real HTML tables with data-row/data-col so
 * annotations (box/circle) can target individual cells.
 */

import katex from 'katex';
import {
  extractMatrixFromLine,
  parseLatexMatrixBody,
  splitContentWithMatrices,
  type ParsedMatrix,
} from './matrix';
import type { CanvasAnnotationSpec } from './annotations';
import { stripMarkdownDecorations } from './sanitize';

/** Convert common TeX delimiters `\(...\)` / `\[...\]` into `$...$` / `$$...$$`. */
export function convertParenDelimiters(text: string): string {
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body}$`);
}

export function containsLatex(text: string): boolean {
  if (!text) return false;
  if (/\\\(|\\\)|\\\[|\\\]/.test(text)) return true;
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;
  if (/\$[^$\n]+\$/.test(text)) return true;
  if (/\\begin\{/.test(text)) return true;
  // Any TeX control sequence (frac, quad, cdot, pmatrix, …)
  if (/\\[a-zA-Z]+/.test(text)) return true;
  return false;
}

/** Wrap bare environments so KaTeX will parse them. */
export function normalizeLatexInput(text: string): string {
  const t = convertParenDelimiters(text.trim());
  if (!t) return t;

  // Already delimited (including after \(...\) conversion) — keep mixed prose + math.
  if (t.includes('$$') || /\$[^$\n]+\$/.test(t)) {
    return t;
  }

  if (/\\begin\{/.test(t)) {
    return `$$${t}$$`;
  }

  // Bare command-only lines (e.g. "\sqrt{2x+5}=x-1") — wrap whole step.
  if (/\\[a-zA-Z]+/.test(t) && !t.includes('$')) {
    return `$$${t}$$`;
  }

  return t;
}

function renderKatexChunk(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      strict: 'ignore',
      trust: true,
      output: 'html',
    });
  } catch {
    const escaped = tex
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span class="mathlon-latex-fallback">${escaped}</span>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build an annotate-friendly HTML table for a parsed matrix/grid. */
export function renderMatrixAsHtmlTable(matrix: ParsedMatrix): string {
  const labelHtml = matrix.label
    ? `<span class="mathlon-matrix-label">${escapeHtml(matrix.label)}&nbsp;=&nbsp;</span>`
    : '';

  const rowsHtml = matrix.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const cellHtml = renderKatexChunk(cell, false);
          return `<td class="mathlon-matrix-cell" data-row="${rowIndex + 1}" data-col="${colIndex + 1}">${cellHtml}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const labelAttr = matrix.label ? ` data-grid-label="${escapeHtml(matrix.label)}"` : '';

  return (
    `<div class="mathlon-matrix-block"${labelAttr}>` +
    labelHtml +
    `<span class="mathlon-matrix-brackets" aria-hidden="true">` +
    `<span class="mathlon-matrix-bracket mathlon-matrix-bracket-left"></span>` +
    `<table class="mathlon-matrix-table"><tbody>${rowsHtml}</tbody></table>` +
    `<span class="mathlon-matrix-bracket mathlon-matrix-bracket-right"></span>` +
    `</span></div>`
  );
}

/**
 * If the whole step (or a $$ chunk) is a labeled/bare matrix, render as HTML table.
 * Returns null when the chunk is not a matrix we can structure.
 */
function tryRenderMatrixChunk(texOrLine: string): string | null {
  const extracted = extractMatrixFromLine(texOrLine.trim());
  if (extracted?.matrix.rows.length) {
    const prefix = extracted.prefix
      ? `<span class="mathlon-latex-prose">${escapeHtml(stripMarkdownDecorations(extracted.prefix))} </span>`
      : '';
    return prefix + renderMatrixAsHtmlTable(extracted.matrix);
  }

  // Bare environment body only
  const loose = texOrLine.match(
    /\\begin\{((?:p|b|v|V)?matrix|array)\}([\s\S]*?)\\end\{\1\}/,
  );
  if (loose) {
    const rows = parseLatexMatrixBody(loose[2]);
    if (rows) {
      return renderMatrixAsHtmlTable({ label: '', rows });
    }
  }

  return null;
}

/**
 * Render a non-matrix prose/math fragment: strip markdown, then KaTeX when needed.
 * Avoids dumping raw `\quad` / commands as escaped source.
 */
function renderProseOrMathFragment(fragment: string): string {
  const cleaned = stripMarkdownDecorations(fragment).replace(/\$\$/g, '').trim();
  if (!cleaned) return '';

  // Pure prose (no TeX commands) — escape only.
  if (!containsLatex(cleaned)) {
    const escaped = escapeHtml(cleaned).replace(/\n/g, '<br/>');
    return `<span class="mathlon-latex-prose">${escaped}</span>`;
  }

  // Fragments with commands (`\quad`, mixed "A = ...") → KaTeX so source never leaks.
  // Keep leading/trailing punctuation readable by wrapping the math-ish core.
  const normalized = normalizeLatexInput(cleaned);
  if (normalized.startsWith('$$') && normalized.endsWith('$$') && normalized.length >= 4) {
    const tex = normalized.slice(2, -2).trim();
    return `<span class="mathlon-katex-inline">${renderKatexChunk(tex, false)}</span>`;
  }

  // Inline $...$ pieces mixed with prose
  const parts: string[] = [];
  const inlineSplit = normalized.split(/(\$[^$\n]+\$)/g);
  for (const piece of inlineSplit) {
    if (!piece) continue;
    if (piece.startsWith('$') && piece.endsWith('$') && piece.length >= 2) {
      parts.push(
        `<span class="mathlon-katex-inline">${renderKatexChunk(piece.slice(1, -1).trim(), false)}</span>`,
      );
      continue;
    }
    const plain = stripMarkdownDecorations(piece);
    if (!plain.trim()) continue;
    if (/\\[a-zA-Z]+/.test(plain)) {
      parts.push(
        `<span class="mathlon-katex-inline">${renderKatexChunk(plain.trim(), false)}</span>`,
      );
    } else {
      parts.push(
        `<span class="mathlon-latex-prose">${escapeHtml(plain).replace(/\n/g, '<br/>')}</span>`,
      );
    }
  }
  return parts.join('');
}

/**
 * Convert a teaching-step string (mixed prose + TeX) into HTML safe for the board overlay.
 */
export function renderLatexToHtml(text: string): string {
  const source = normalizeLatexInput(text);
  if (!source) return '';

  // Any step that contains a matrix env/brackets → segment every grid so A, B,
  // and answer matrices all become annotate-friendly HTML tables (not raw TeX).
  if (/\\begin\{(?:p|b|v|V)?matrix\}|\[\[/.test(source)) {
    const segments = splitContentWithMatrices(source);
    if (segments.some((seg) => seg.kind === 'matrix')) {
      const html = segments
        .map((seg) => {
          if (seg.kind === 'matrix') return renderMatrixAsHtmlTable(seg.matrix);
          return renderProseOrMathFragment(seg.text);
        })
        .join(' ');
      return `<div class="mathlon-latex-step">${html}</div>`;
    }
  }

  const parts: string[] = [];
  const displaySplit = source.split(/(\$\$[\s\S]+?\$\$)/g);

  for (const chunk of displaySplit) {
    if (!chunk) continue;
    if (chunk.startsWith('$$') && chunk.endsWith('$$') && chunk.length >= 4) {
      const tex = chunk.slice(2, -2).trim();
      const asMatrix = tryRenderMatrixChunk(tex);
      if (asMatrix) {
        parts.push(`<div class="mathlon-katex-display">${asMatrix}</div>`);
      } else {
        parts.push(`<div class="mathlon-katex-display">${renderKatexChunk(tex, true)}</div>`);
      }
      continue;
    }

    const inlineSplit = chunk.split(/(\$[^$\n]+\$)/g);
    for (const piece of inlineSplit) {
      if (!piece) continue;
      if (piece.startsWith('$') && piece.endsWith('$') && piece.length >= 2) {
        const tex = piece.slice(1, -1).trim();
        parts.push(
          `<span class="mathlon-katex-inline">${renderKatexChunk(tex, false)}</span>`,
        );
        continue;
      }

      // Strip markdown bold that agents dump onto the board
      const plain = stripMarkdownDecorations(piece);
      const escaped = escapeHtml(plain).replace(/\n/g, '<br/>');
      if (escaped.trim()) {
        parts.push(`<span class="mathlon-latex-prose">${escaped}</span>`);
      }
    }
  }

  return `<div class="mathlon-latex-step">${parts.join('')}</div>`;
}

let measureHost: HTMLDivElement | null = null;

function getMeasureHost(): HTMLDivElement {
  if (typeof document === 'undefined') {
    throw new Error('LaTeX measure requires document');
  }
  if (!measureHost) {
    measureHost = document.createElement('div');
    measureHost.setAttribute('aria-hidden', 'true');
    measureHost.style.cssText =
      'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;z-index:-1;';
    document.body.appendChild(measureHost);
  }
  return measureHost;
}

export function measureLatexHtml(
  html: string,
  maxWidth: number,
  fontSizePx = 22,
): { width: number; height: number } {
  if (typeof document === 'undefined') {
    const lines = html.split(/<br\s*\/?>/).length;
    return { width: maxWidth, height: Math.max(48, lines * 32) };
  }

  const host = getMeasureHost();
  host.style.width = `${Math.max(maxWidth, 80)}px`;
  host.style.fontSize = `${fontSizePx}px`;
  host.innerHTML = html;
  const rect = host.getBoundingClientRect();
  const height = Math.ceil(rect.height) || Math.ceil(host.scrollHeight) || 48;
  const width = Math.min(maxWidth, Math.ceil(rect.width) || maxWidth);
  host.innerHTML = '';
  return { width, height };
}

export function measureLatexText(
  text: string,
  maxWidth: number,
  paddingX = 40,
  paddingY = 36,
): number {
  const contentWidth = Math.max(maxWidth - paddingX * 2, 120);
  const html = renderLatexToHtml(text);
  const { height } = measureLatexHtml(html, contentWidth);
  return Math.max(64, height + paddingY);
}

/**
 * Apply annotation classes onto a mounted latex step root.
 * Returns how many marks were applied (0 = nothing visible).
 */
export function applyLatexAnnotations(
  root: HTMLElement,
  annotations: CanvasAnnotationSpec[] | undefined,
): number {
  // Clear previous marks
  root.querySelectorAll('.mathlon-ann-mark').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  root.querySelectorAll('.mathlon-matrix-cell.mathlon-ann-cell').forEach((el) => {
    el.classList.remove('mathlon-ann-cell', 'mathlon-ann-box', 'mathlon-ann-circle', 'mathlon-ann-underline');
  });
  root.classList.remove('mathlon-ann-step', 'mathlon-ann-box', 'mathlon-ann-circle');

  if (!annotations?.length) return 0;
  let applied = 0;

  for (const ann of annotations) {
    if (ann.kind === 'step') {
      root.classList.add('mathlon-ann-step');
      root.classList.add(ann.style === 'circle' ? 'mathlon-ann-circle' : 'mathlon-ann-box');
      applied += 1;
      continue;
    }

    if (ann.kind === 'grid_cell') {
      const row = ann.row;
      const col = ann.column;
      const label = ann.gridLabel;
      const blocks = root.querySelectorAll('.mathlon-matrix-block');
      let cell: Element | null = null;
      for (const block of blocks) {
        if (label) {
          const blockLabel = block.getAttribute('data-grid-label') ?? '';
          if (blockLabel && blockLabel !== label) continue;
        }
        cell = block.querySelector(
          `.mathlon-matrix-cell[data-row="${row}"][data-col="${col}"]`,
        );
        if (cell) break;
      }
      if (cell) {
        cell.classList.add('mathlon-ann-cell');
        cell.classList.add(
          ann.style === 'circle'
            ? 'mathlon-ann-circle'
            : ann.style === 'underline'
              ? 'mathlon-ann-underline'
              : 'mathlon-ann-box',
        );
        if (ann.label) cell.setAttribute('data-ann-label', ann.label);
        applied += 1;
      }
      continue;
    }

    if (ann.kind === 'text_match') {
      const match = ann.match;
      const occurrence = ann.occurrence ?? 1;
      if (!match) continue;
      const ok = wrapTextMatch(root, match, occurrence, ann.style ?? 'box', ann.label);
      if (ok) applied += 1;
    }
  }

  return applied;
}

function wrapTextMatch(
  root: HTMLElement,
  match: string,
  occurrence: number,
  style: string,
  label?: string,
): boolean {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let found = 0;
  let node: Text | null = walker.nextNode() as Text | null;

  while (node) {
    const value = node.nodeValue ?? '';
    let from = 0;
    while (from < value.length) {
      let idx = value.indexOf(match, from);
      let caseSensitive = true;
      if (idx === -1) {
        idx = value.toLowerCase().indexOf(match.toLowerCase(), from);
        caseSensitive = false;
      }
      if (idx === -1) break;
      found += 1;
      if (found === occurrence) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + (caseSensitive ? match.length : match.length));
        const mark = document.createElement('span');
        mark.className = `mathlon-ann-mark mathlon-ann-${style === 'circle' ? 'circle' : style === 'underline' ? 'underline' : 'box'}`;
        if (label) mark.setAttribute('data-ann-label', label);
        try {
          range.surroundContents(mark);
        } catch {
          // Partial nodes — fall back to replacing text
          const before = value.slice(0, idx);
          const hit = value.slice(idx, idx + match.length);
          const after = value.slice(idx + match.length);
          const parent = node.parentNode;
          if (!parent) return false;
          const frag = document.createDocumentFragment();
          if (before) frag.appendChild(document.createTextNode(before));
          mark.textContent = hit;
          frag.appendChild(mark);
          if (after) frag.appendChild(document.createTextNode(after));
          parent.replaceChild(frag, node);
        }
        return true;
      }
      from = idx + 1;
    }
    node = walker.nextNode() as Text | null;
  }
  return false;
}
