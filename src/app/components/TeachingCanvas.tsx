import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Crosshair, Move, Radio, Trash2 } from 'lucide-react';
import zoomFitIcon from '../../assets/icons/zoom-fit.png';
import {
  normalizeConstructionSpec,
  renderConstruction,
  type ConstructionSpec,
} from '../canvas/construction';
import {
  contentContainsMatch,
  drawHighlight,
  findTextMatchBounds,
  normalizeAnnotationSpec,
  type CanvasAnnotationSpec,
} from '../canvas/annotations';
import {
  applyLatexAnnotations,
  containsLatex,
  measureLatexText,
  renderLatexToHtml,
} from '../canvas/latex';
import {
  drawMatrixBlock,
  extractMatrixFromLine,
  measureMatrixBlock,
  parseMatrixRows,
  splitContentWithMatrices,
  stripMathDelimiters,
  textContainsRenderableGrid,
  type GridCellAnnotation,
  type TeachingBlock,
} from '../canvas/matrix';
import { stripMarkdownDecorations } from '../canvas/sanitize';
import type { PersistedCanvasState } from '@/lib/sessions/types';
import type { BoardSummary } from '../canvas/boardSummary';
import { summarizeBoard } from '../canvas/boardSummary';

export type { CanvasAnnotationSpec } from '../canvas/annotations';

export type CanvasSnapshot = PersistedCanvasState;

export interface TeachingCanvasHandle {
  addTextStep: (text: string) => { ok: boolean; stepIndex?: number };
  addDiagramStep: (
    diagram: DiagramSpec | string,
    label?: string,
  ) => { ok: boolean; stepIndex?: number; diagramId?: string };
  addConstructionStep: (
    construction: ConstructionSpec | unknown,
    label?: string,
  ) => { ok: boolean; stepIndex?: number; reason?: string };
  addAnnotation: (annotation: CanvasAnnotationSpec) => {
    ok: boolean;
    reason?: string;
    stepIndex?: number;
    kind?: string;
    /** false when the mark was stored but cannot be painted (e.g. no matching DOM yet) */
    visible?: boolean;
  };
  navigateToStep: (stepIndex: number) => { ok: boolean; stepIndex: number };
  replaceTextStep: (
    stepIndex: number,
    text: string,
  ) => { ok: boolean; stepIndex?: number; reason?: string };
  deleteStep: (stepIndex: number) => {
    ok: boolean;
    stepIndex?: number;
    reason?: string;
    stepCount?: number;
  };
  getSnapshot: () => CanvasSnapshot;
  loadSnapshot: (snapshot: CanvasSnapshot) => void;
  getBoardSummary: () => BoardSummary;
}

interface TeachingCanvasProps {
  isTeaching: boolean;
  currentStep: string;
  onClear?: () => void;
  /** Restore board from a persisted session (e.g. after refresh). */
  initialCanvasState?: PersistedCanvasState | null;
}

export type DiagramId =
  | 'right_triangle'
  | 'coordinate_grid'
  | 'unit_circle'
  | 'sine_wave'
  | 'parabola'
  | 'pythagorean_rearrangement_square'
  | 'unknown';

export type DiagramSpec = {
  diagramId: DiagramId | string;
  title?: string;
  labels?: Record<string, string>;
  variant?: string;
};

const DIAGRAM_ALIASES: Record<string, DiagramId> = {
  triangle: 'right_triangle',
  'right-triangle': 'right_triangle',
  right_triangle: 'right_triangle',
  coordinate: 'coordinate_grid',
  'coordinate-grid': 'coordinate_grid',
  coordinate_grid: 'coordinate_grid',
  circle: 'unit_circle',
  'unit-circle': 'unit_circle',
  unit_circle: 'unit_circle',
  sine: 'sine_wave',
  'sine-wave': 'sine_wave',
  sine_wave: 'sine_wave',
  parabola: 'parabola',
  pythagorean_rearrangement_square: 'pythagorean_rearrangement_square',
  'pythagorean-rearrangement-square': 'pythagorean_rearrangement_square',
};

const DIAGRAM_TITLES: Record<DiagramId, string> = {
  right_triangle: 'Right triangle',
  coordinate_grid: 'Coordinate grid',
  unit_circle: 'Unit circle',
  sine_wave: 'Sine wave',
  parabola: 'Parabola',
  pythagorean_rearrangement_square: 'Pythagorean square proof',
  unknown: 'Diagram unavailable',
};

function normalizeDiagramSpec(diagram: DiagramSpec | string, label?: string): DiagramSpec {
  const rawId = typeof diagram === 'string' ? diagram : diagram.diagramId;
  const normalizedKey = String(rawId ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  const diagramId = DIAGRAM_ALIASES[normalizedKey] ?? 'unknown';
  const explicitTitle = typeof diagram === 'string' ? label : diagram.title;

  return {
    ...(typeof diagram === 'string' ? {} : diagram),
    diagramId,
    title: explicitTitle || DIAGRAM_TITLES[diagramId],
    labels: typeof diagram === 'string' ? {} : diagram.labels,
  };
}

interface BaseCanvasElement {
  content: string;
  displayContent: string;
  drawProgress: number;
  timestamp: number;
  annotations?: CanvasAnnotationSpec[];
}

type TextCanvasElement = BaseCanvasElement & {
  kind: 'text';
};

type DiagramCanvasElement = BaseCanvasElement & {
  kind: 'diagram';
  diagram: DiagramSpec;
};

type ConstructionCanvasElement = BaseCanvasElement & {
  kind: 'construction';
  construction: ConstructionSpec;
};

type CanvasElement = TextCanvasElement | DiagramCanvasElement | ConstructionCanvasElement;

const STEP_GAP = 12;
const BOARD_PADDING_X = 40;
const BOARD_PADDING_TOP = 18;
const TEACHING_FONT = '32px Caveat, Kalam, cursive';
const LINE_HEIGHT = 40;
const TEXT_PADDING_X = 40;
const TEXT_PADDING_TOP = 32;
const TEXT_BOTTOM_PADDING = 10;
const MIN_TEXT_STEP_HEIGHT = 64;
/** Built-in named diagrams (right_triangle, unit_circle, …). */
const DIAGRAM_STEP_HEIGHT = 280;
/**
 * Freeform constructions (trig figures, labeled geometry). Taller so figures
 * aren't a cramped stamp in the board column.
 */
const CONSTRUCTION_STEP_HEIGHT = 420;
const DEFAULT_CAMERA = { x: 100, y: 50 };
const LESSON_TOP_ANCHOR = { x: 90, y: 72 };
const LESSON_BOTTOM_MARGIN = 108;
const CAMERA_SETTLE_DISTANCE = 0.45;

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureContext) {
    const canvas = document.createElement('canvas');
    measureContext = canvas.getContext('2d');
    if (!measureContext) {
      throw new Error('Unable to create canvas measure context');
    }
    measureContext.font = TEACHING_FONT;
  }
  return measureContext;
}

function wrapTeachingLine(context: CanvasRenderingContext2D, line: string, maxWidth: number): string[] {
  if (!line.trim()) return [''];

  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}


function parseTeachingBlocks(context: CanvasRenderingContext2D, text: string, maxWidth: number): TeachingBlock[] {
  const blocks: TeachingBlock[] = [];

  const pushText = (raw: string) => {
    const cleaned = stripMarkdownDecorations(stripMathDelimiters(raw));
    if (!cleaned.trim()) return;
    blocks.push({
      kind: 'text',
      lines: wrapTeachingLine(context, cleaned, maxWidth),
    });
  };

  // Whole-step blob (often multi-matrix: A, B, and A+B on one write)
  const flattened = text.replace(/\n/g, ' ').trim();
  if (/\\begin\{(?:p|b|v|V)?matrix\}|\[\[/.test(flattened)) {
    const segments = splitContentWithMatrices(flattened);
    if (segments.some((seg) => seg.kind === 'matrix')) {
      for (const seg of segments) {
        if (seg.kind === 'matrix') {
          blocks.push({ kind: 'matrix', matrix: seg.matrix });
        } else {
          pushText(seg.text);
        }
      }
      return blocks;
    }
  }

  for (const rawLine of text.split('\n')) {
    if (rawLine.startsWith('[DIAGRAM:')) continue;

    if (/\\begin\{(?:p|b|v|V)?matrix\}|\[\[/.test(rawLine)) {
      const segments = splitContentWithMatrices(rawLine);
      if (segments.some((seg) => seg.kind === 'matrix')) {
        for (const seg of segments) {
          if (seg.kind === 'matrix') {
            blocks.push({ kind: 'matrix', matrix: seg.matrix });
          } else {
            pushText(seg.text);
          }
        }
        continue;
      }
    }

    const extracted = extractMatrixFromLine(rawLine);
    if (extracted) {
      if (extracted.prefix) pushText(extracted.prefix);
      blocks.push({ kind: 'matrix', matrix: extracted.matrix });
      continue;
    }

    const bareRows = rawLine.trim().startsWith('[[') ? parseMatrixRows(rawLine.trim()) : null;
    if (bareRows) {
      blocks.push({ kind: 'matrix', matrix: { label: '', rows: bareRows } });
      continue;
    }

    pushText(rawLine);
  }

  return blocks;
}

function textContainsMatrix(text: string, matrixLabel?: string) {
  return textContainsRenderableGrid(text, matrixLabel);
}

function resolveAnnotationTarget(
  elements: CanvasElement[],
  annotation: CanvasAnnotationSpec,
): { index: number; reason?: string } | { index: null; reason: string } {
  const explicitIndex =
    typeof annotation.targetStepIndex === 'number' && elements.length > 0
      ? Math.min(Math.max(Math.floor(annotation.targetStepIndex), 0), elements.length - 1)
      : null;

  // Prefer explicit index only when it actually matches the annotation content.
  // Agents often pass a wrong targetStepIndex (e.g. dimension sentence instead of the matrix).
  const allTextNewestFirst = elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.kind === 'text')
    .map(({ index }) => index)
    .reverse();

  if (annotation.kind === 'grid_cell') {
    const matches = (index: number) => {
      const element = elements[index];
      return element?.kind === 'text' && textContainsMatrix(element.content, annotation.gridLabel);
    };
    if (explicitIndex != null && matches(explicitIndex)) return { index: explicitIndex };
    const targetIndex = allTextNewestFirst.find(matches);
    if (targetIndex == null) return { index: null, reason: 'grid_step_not_found' };
    return { index: targetIndex };
  }

  if (annotation.kind === 'text_match') {
    const matches = (index: number) => {
      const element = elements[index];
      return (
        element?.kind === 'text' &&
        contentContainsMatch(element.content, annotation.match, annotation.occurrence ?? 1)
      );
    };
    // Short tokens like "2" often appear in both a matrix and a "2×2" sentence.
    // Prefer a real matrix/grid step when one exists.
    const matchToken = annotation.match.trim();
    const preferMatrix =
      matchToken.length > 0 &&
      matchToken.length <= 12 &&
      !/\s/.test(matchToken);
    if (preferMatrix) {
      const matrixHit = allTextNewestFirst.find(
        (index) => textContainsMatrix(elements[index]?.content ?? '') && matches(index),
      );
      if (matrixHit != null) {
        // Only honor explicit index if it is also a matrix step
        if (explicitIndex != null && textContainsMatrix(elements[explicitIndex]?.content ?? '') && matches(explicitIndex)) {
          return { index: explicitIndex };
        }
        return { index: matrixHit };
      }
    }
    if (explicitIndex != null && matches(explicitIndex)) return { index: explicitIndex };
    const targetIndex = allTextNewestFirst.find(matches);
    if (targetIndex == null) return { index: null, reason: 'text_match_not_found' };
    return { index: targetIndex };
  }

  // step — any element kind
  if (explicitIndex != null && elements[explicitIndex]) {
    return { index: explicitIndex };
  }
  if (elements.length === 0) return { index: null, reason: 'no_steps' };
  return { index: elements.length - 1 };
}

/** Latex step overlay — KaTeX HTML + live annotation classes */
function LatexStepOverlay({
  content,
  annotations,
  layout,
  stepKey,
}: {
  content: string;
  annotations?: CanvasAnnotationSpec[];
  layout: { x: number; y: number; width: number; height: number };
  stepKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const html = renderLatexToHtml(content);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    applyLatexAnnotations(el, annotations);
  }, [html, annotations, stepKey]);

  return (
    <div
      ref={ref}
      className="mathlon-latex-step-box"
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function measureTeachingBlocks(context: CanvasRenderingContext2D, blocks: TeachingBlock[]): number {
  let height = TEXT_PADDING_TOP;

  blocks.forEach((block) => {
    if (block.kind === 'text') {
      height += block.lines.length * LINE_HEIGHT;
      return;
    }
    height += measureMatrixBlock(context, block.matrix).height + 10;
  });

  return height + TEXT_BOTTOM_PADDING;
}

function measureTextStepHeight(text: string, width: number): number {
  // LaTeX / TeX content is typeset with KaTeX (real math rendering).
  if (typeof document !== 'undefined' && containsLatex(text)) {
    return measureLatexText(text, width, TEXT_PADDING_X, TEXT_PADDING_TOP + TEXT_BOTTOM_PADDING);
  }

  const measureCtx = getMeasureContext();
  const maxWidth = width - TEXT_PADDING_X * 2;
  const blocks = parseTeachingBlocks(measureCtx, text, maxWidth);
  const contentHeight = measureTeachingBlocks(measureCtx, blocks);
  return Math.max(MIN_TEXT_STEP_HEIGHT, contentHeight);
}

function getLessonBounds(layouts: ElementLayout[], endIndex: number) {
  const start = layouts[0];
  const end = layouts[Math.min(Math.max(endIndex, 0), layouts.length - 1)];
  if (!start || !end) return null;

  return {
    x: start.x,
    y: start.y,
    width: end.x + end.width - start.x,
    height: end.y + end.height - start.y,
  };
}

function getElementLayouts(elements: CanvasElement[], viewportWidth: number): ElementLayout[] {
  const columnWidth = Math.max(viewportWidth - BOARD_PADDING_X * 2, 320);
  let y = BOARD_PADDING_TOP;

  return elements.map((element) => {
    const height =
      element.kind === 'text'
        ? measureTextStepHeight(element.content, columnWidth)
        : element.kind === 'construction'
          ? CONSTRUCTION_STEP_HEIGHT
          : DIAGRAM_STEP_HEIGHT;

    const layout = {
      x: BOARD_PADDING_X,
      y,
      width: columnWidth,
      height,
    };
    y += height + STEP_GAP;
    return layout;
  });
}

type Point = {
  x: number;
  y: number;
};

type ElementLayout = Point & {
  width: number;
  height: number;
};

export const TeachingCanvas = forwardRef<TeachingCanvasHandle, TeachingCanvasProps>(function TeachingCanvas({ isTeaching, currentStep, onClear, initialCanvasState }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const elementsRef = useRef<CanvasElement[]>([]);
  elementsRef.current = elements;
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const lastStepRef = useRef<string>('');
  const writingIntervalRef = useRef<number | null>(null);

  const [panOffset, setPanOffset] = useState(DEFAULT_CAMERA);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const isCameraMovingRef = useRef(false);
  const [lastManualMoveAt, setLastManualMoveAt] = useState<number | null>(null);
  const panOffsetRef = useRef<Point>(DEFAULT_CAMERA);
  const cameraTargetRef = useRef<Point>(DEFAULT_CAMERA);
  const cameraFrameRef = useRef<number | null>(null);
  /** After annotate, hold camera on that step so new writes don't scroll the mark off-screen. */
  const annotationFocusRef = useRef<{ stepIndex: number; until: number } | null>(null);
  const didRestoreInitialRef = useRef(false);

  const buildSnapshot = (): CanvasSnapshot => ({
    version: 1,
    camera: { panOffset: { ...panOffsetRef.current }, zoom },
    steps: elementsRef.current.map((element) => {
      if (element.kind === 'text') {
        return {
          kind: 'text' as const,
          content: element.content,
          annotations: element.annotations,
        };
      }
      if (element.kind === 'diagram') {
        return {
          kind: 'diagram' as const,
          content: element.content,
          diagramId: String(element.diagram.diagramId),
          title: element.diagram.title,
          labels: element.diagram.labels,
          variant: element.diagram.variant,
          annotations: element.annotations,
        };
      }
      return {
        kind: 'construction' as const,
        content: element.content,
        title: element.construction.title,
        construction: {
          title: element.construction.title,
          steps: element.construction.steps,
        },
        annotations: element.annotations,
      };
    }),
  });

  const applySnapshot = (snapshot: CanvasSnapshot) => {
    if (writingIntervalRef.current) {
      clearInterval(writingIntervalRef.current);
      writingIntervalRef.current = null;
    }
    annotationFocusRef.current = null;

    const nextElements: CanvasElement[] = [];
    for (const step of snapshot.steps ?? []) {
      const annotations = Array.isArray(step.annotations)
        ? step.annotations
            .map((a) => normalizeAnnotationSpec(a as Parameters<typeof normalizeAnnotationSpec>[0]))
            .filter((a): a is CanvasAnnotationSpec => a != null)
        : undefined;
      const base = {
        content: String(step.content ?? ''),
        displayContent: String(step.content ?? ''),
        drawProgress: 1,
        timestamp: Date.now() + nextElements.length,
        annotations,
      };

      if (step.kind === 'text') {
        nextElements.push({ kind: 'text', ...base });
        continue;
      }
      if (step.kind === 'diagram') {
        const diagram = normalizeDiagramSpec({
          diagramId: step.diagramId,
          title: step.title,
          labels: step.labels,
          variant: step.variant,
        });
        nextElements.push({
          kind: 'diagram',
          ...base,
          content: base.content || diagram.title || DIAGRAM_TITLES[diagram.diagramId as DiagramId] || 'Diagram',
          displayContent:
            base.content || diagram.title || DIAGRAM_TITLES[diagram.diagramId as DiagramId] || 'Diagram',
          diagram,
        });
        continue;
      }
      if (step.kind === 'construction') {
        const spec = normalizeConstructionSpec(step.construction);
        if (!spec) continue;
        const title = step.title || spec.title || 'Construction';
        nextElements.push({
          kind: 'construction',
          ...base,
          content: title,
          displayContent: title,
          construction: { ...spec, title },
        });
      }
    }

    setElements(nextElements);
    elementsRef.current = nextElements;

    const camera = snapshot.camera;
    if (camera?.panOffset && Number.isFinite(camera.panOffset.x) && Number.isFinite(camera.panOffset.y)) {
      const nextPan = { x: camera.panOffset.x, y: camera.panOffset.y };
      panOffsetRef.current = nextPan;
      cameraTargetRef.current = nextPan;
      setPanOffset(nextPan);
    }
    if (camera?.zoom && Number.isFinite(camera.zoom) && camera.zoom > 0) {
      setZoom(Math.min(Math.max(camera.zoom, 0.4), 2.5));
    }
    setIsAutoFollowEnabled(nextElements.length === 0);
    setLastManualMoveAt(null);
  };

  useLayoutEffect(() => {
    if (didRestoreInitialRef.current) return;
    if (!initialCanvasState?.steps?.length) return;
    didRestoreInitialRef.current = true;
    applySnapshot(initialCanvasState);
  }, [initialCanvasState]); // eslint-disable-line react-hooks/exhaustive-deps

  const getFollowStepIndex = (count: number) => {
    const focus = annotationFocusRef.current;
    if (focus && Date.now() < focus.until && focus.stepIndex >= 0 && focus.stepIndex < count) {
      return focus.stepIndex;
    }
    if (focus && Date.now() >= focus.until) {
      annotationFocusRef.current = null;
    }
    return Math.max(count - 1, 0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    setCtx(context);

    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);


  useEffect(() => {
    return () => {
      if (writingIntervalRef.current) {
        clearInterval(writingIntervalRef.current);
      }
      if (cameraFrameRef.current) {
        cancelAnimationFrame(cameraFrameRef.current);
      }
    };
  }, []);

  const setCameraPosition = (point: Point) => {
    panOffsetRef.current = point;
    cameraTargetRef.current = point;
    setPanOffset(point);
    isCameraMovingRef.current = false;
    setIsCameraMoving(false);
  };

  const moveCameraTo = (point: Point, immediate = false) => {
    const current = panOffsetRef.current;
    const alreadyThere =
      Math.abs(current.x - point.x) <= CAMERA_SETTLE_DISTANCE &&
      Math.abs(current.y - point.y) <= CAMERA_SETTLE_DISTANCE;

    cameraTargetRef.current = point;

    if (immediate || alreadyThere) {
      setCameraPosition(point);
      return;
    }

    if (!isCameraMovingRef.current) {
      isCameraMovingRef.current = true;
      setIsCameraMoving(true);
    }
  };

  const getCanvasWorldSize = (nextZoom = zoom) => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 1100, height: 720 };

    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width / nextZoom,
      height: rect.height / nextZoom,
    };
  };

  const getStepCameraTarget = (
    stepIndex: number,
    nextZoom = zoom,
    layoutElements = elements,
    viewportSize?: { width: number; height: number },
  ) => {
    const canvas = canvasRef.current;
    const viewport = viewportSize ?? canvas?.getBoundingClientRect() ?? { width: 1100, height: 720 };
    const worldSize = getCanvasWorldSize(nextZoom);
    const layouts = getElementLayouts(layoutElements, worldSize.width);
    const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(layouts.length - 1, 0));
    const focusLayout = layouts[safeIndex];
    const lessonBounds = getLessonBounds(layouts, safeIndex);

    if (!focusLayout || !lessonBounds) {
      return DEFAULT_CAMERA;
    }

    const viewportHeightWorld = viewport.height / nextZoom;
    const maxLessonVisible = viewportHeightWorld * 0.78;
    const panX = LESSON_TOP_ANCHOR.x - lessonBounds.x * nextZoom;

    if (lessonBounds.height <= maxLessonVisible) {
      return {
        x: panX,
        y: LESSON_TOP_ANCHOR.y - lessonBounds.y * nextZoom,
      };
    }

    const bottomScreenY = viewport.height - LESSON_BOTTOM_MARGIN;
    return {
      x: panX,
      y: bottomScreenY - (focusLayout.y + focusLayout.height) * nextZoom,
    };
  };

  const releaseTeacherFollow = () => {
    setIsAutoFollowEnabled(false);
    setLastManualMoveAt(Date.now());
    isCameraMovingRef.current = false;
    setIsCameraMoving(false);
    cameraTargetRef.current = panOffsetRef.current;
  };

  const setManualCameraPosition = (point: Point) => {
    panOffsetRef.current = point;
    cameraTargetRef.current = point;
    setPanOffset(point);
    isCameraMovingRef.current = false;
    setIsCameraMoving(false);
  };

  const returnToTeacher = () => {
    setIsAutoFollowEnabled(true);
    setLastManualMoveAt(null);
    const latestIndex = Math.max(elements.length - 1, 0);
    moveCameraTo(getStepCameraTarget(latestIndex));
  };

  const animateWriting = (timestamp: number, fullContent: string) => {
    if (writingIntervalRef.current) {
      clearInterval(writingIntervalRef.current);
      writingIntervalRef.current = null;
    }

    // KaTeX cannot typeset half-written TeX — reveal as a finished expression.
    if (containsLatex(fullContent)) {
      setElements((prev) =>
        prev.map((element) =>
          element.timestamp === timestamp
            ? { ...element, displayContent: fullContent, drawProgress: 1 }
            : element,
        ),
      );
      return;
    }

    let charIndex = 0;
    const totalChars = fullContent.length;
    const charsPerTick = totalChars > 260 ? 2 : 1;
    const tickMs = 34;

    writingIntervalRef.current = window.setInterval(() => {
      charIndex = Math.min(totalChars, charIndex + charsPerTick);
      const nextText = fullContent.slice(0, charIndex);

      setElements((prev) =>
        prev.map((element) =>
          element.timestamp === timestamp
            ? { ...element, displayContent: nextText, drawProgress: charIndex / totalChars }
            : element
        )
      );

      if (charIndex >= totalChars && writingIntervalRef.current) {
        clearInterval(writingIntervalRef.current);
        writingIntervalRef.current = null;
      }
    }, tickMs);
  };

  useImperativeHandle(ref, () => ({
    addTextStep: (text: string) => {
      const timestamp = Date.now();
      let stepIndex = 0;
      setElements((prev) => {
        stepIndex = prev.length;
        const next: CanvasElement[] = [
          ...prev,
          { kind: 'text', content: text, displayContent: '', drawProgress: 0, timestamp },
        ];
        elementsRef.current = next;
        return next;
      });
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      animateWriting(timestamp, text);
      return { ok: true, stepIndex };
    },
    addDiagramStep: (diagram: DiagramSpec | string, label?: string) => {
      const diagramSpec = normalizeDiagramSpec(diagram, label);
      const content = diagramSpec.title || DIAGRAM_TITLES[diagramSpec.diagramId as DiagramId] || 'Diagram';
      const timestamp = Date.now();
      let stepIndex = 0;
      setElements((prev) => {
        stepIndex = prev.length;
        const next: CanvasElement[] = [
          ...prev,
          {
            kind: 'diagram',
            content,
            displayContent: '',
            drawProgress: 0,
            timestamp,
            diagram: diagramSpec,
          },
        ];
        elementsRef.current = next;
        return next;
      });
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      animateWriting(timestamp, content);
      return { ok: true, stepIndex, diagramId: String(diagramSpec.diagramId) };
    },
    addConstructionStep: (construction: ConstructionSpec | unknown, label?: string) => {
      const spec = normalizeConstructionSpec(construction);
      if (!spec) return { ok: false, reason: 'invalid_construction' };
      const content = label?.trim() || spec.title || 'Construction';
      const timestamp = Date.now();
      let stepIndex = 0;
      setElements((prev) => {
        stepIndex = prev.length;
        const next: CanvasElement[] = [
          ...prev,
          {
            kind: 'construction',
            content,
            displayContent: '',
            drawProgress: 0,
            timestamp,
            construction: { ...spec, title: content },
          },
        ];
        elementsRef.current = next;
        return next;
      });
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      animateWriting(timestamp, content);
      return { ok: true, stepIndex };
    },
    addAnnotation: (annotation: CanvasAnnotationSpec) => {
      const normalized = normalizeAnnotationSpec(annotation);
      if (!normalized) return { ok: false, reason: 'invalid_annotation' };

      const resolved = resolveAnnotationTarget(elementsRef.current, normalized);
      if (resolved.index == null) {
        return { ok: false, reason: resolved.reason ?? 'target_not_found' };
      }
      const targetIndex = resolved.index;

      setElements((prev) => {
        const next = prev.map((element, index) => {
          if (index !== targetIndex) return element;
          const existing = element.annotations ?? [];
          const filtered = existing.filter((a) => {
            if (a.kind !== normalized.kind) return true;
            if (normalized.kind === 'grid_cell' && a.kind === 'grid_cell') {
              return !(
                a.row === normalized.row &&
                a.column === normalized.column &&
                (a.gridLabel ?? '') === (normalized.gridLabel ?? '')
              );
            }
            if (normalized.kind === 'text_match' && a.kind === 'text_match') {
              return a.match !== normalized.match;
            }
            if (normalized.kind === 'step' && a.kind === 'step') return false;
            return true;
          });
          return { ...element, annotations: [...filtered, normalized] };
        });
        elementsRef.current = next;
        return next;
      });

      annotationFocusRef.current = {
        stepIndex: targetIndex,
        until: Date.now() + 14_000,
      };
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      moveCameraTo(getStepCameraTarget(targetIndex));

      return {
        ok: true,
        stepIndex: targetIndex,
        kind: normalized.kind,
        visible: true,
      };
    },
    navigateToStep: (stepIndex: number) => {
      const clamped = Math.max(0, Math.min(stepIndex, Math.max(elementsRef.current.length - 1, 0)));
      annotationFocusRef.current = null;
      setIsAutoFollowEnabled(false);
      setLastManualMoveAt(null);
      moveCameraTo(getStepCameraTarget(clamped));
      return { ok: true, stepIndex: clamped };
    },
    replaceTextStep: (stepIndex: number, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return { ok: false, reason: 'empty_text' };
      const current = elementsRef.current[stepIndex];
      if (!current) return { ok: false, reason: 'step_not_found' };
      if (current.kind !== 'text') return { ok: false, reason: 'not_a_text_step' };

      if (writingIntervalRef.current) {
        clearInterval(writingIntervalRef.current);
        writingIntervalRef.current = null;
      }

      setElements((prev) => {
        const next = prev.map((element, index) =>
          index === stepIndex
            ? {
                ...element,
                kind: 'text' as const,
                content: trimmed,
                displayContent: trimmed,
                drawProgress: 1,
                annotations: undefined,
              }
            : element,
        );
        elementsRef.current = next;
        return next;
      });
      annotationFocusRef.current = {
        stepIndex,
        until: Date.now() + 8_000,
      };
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      moveCameraTo(getStepCameraTarget(stepIndex));
      return { ok: true, stepIndex };
    },
    deleteStep: (stepIndex: number) => {
      if (stepIndex < 0 || stepIndex >= elementsRef.current.length) {
        return { ok: false, reason: 'step_not_found' };
      }

      if (writingIntervalRef.current) {
        clearInterval(writingIntervalRef.current);
        writingIntervalRef.current = null;
      }

      let stepCount = 0;
      setElements((prev) => {
        const next = prev.filter((_, index) => index !== stepIndex);
        stepCount = next.length;
        elementsRef.current = next;
        return next;
      });
      annotationFocusRef.current = null;
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      if (stepCount > 0) {
        const focus = Math.min(stepIndex, stepCount - 1);
        moveCameraTo(getStepCameraTarget(focus));
      }
      return { ok: true, stepIndex, stepCount };
    },
    getSnapshot: () => buildSnapshot(),
    loadSnapshot: (snapshot: CanvasSnapshot) => {
      applySnapshot(snapshot);
    },
    getBoardSummary: () => summarizeBoard(buildSnapshot()),
  }), [zoom, elements]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentStep && currentStep !== lastStepRef.current) {
      lastStepRef.current = currentStep;
      const timestamp = Date.now();
      setElements((prev) => [
        ...prev,
        { kind: 'text', content: currentStep, displayContent: '', drawProgress: 0, timestamp },
      ]);
      setIsAutoFollowEnabled(true);
      setLastManualMoveAt(null);
      animateWriting(timestamp, currentStep);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isAutoFollowEnabled || elements.length === 0) return;
    const focusIndex = getFollowStepIndex(elements.length);
    moveCameraTo(getStepCameraTarget(focusIndex));
    // Re-target only when the step COUNT changes (not on every typewriter char),
    // otherwise setElements churn re-fires this effect ~30×/s and trips
    // React's "maximum update depth" via repeated setIsCameraMoving.
  }, [elements.length, zoom, isAutoFollowEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAutoFollowEnabled || elements.length === 0) return;

    const handleResize = () => {
      const focusIndex = getFollowStepIndex(elements.length);
      moveCameraTo(getStepCameraTarget(focusIndex, zoom, elements, canvas.getBoundingClientRect()));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [elements.length, zoom, isAutoFollowEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = () => {
      const current = panOffsetRef.current;
      const target = cameraTargetRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= CAMERA_SETTLE_DISTANCE) {
        if (current.x !== target.x || current.y !== target.y) {
          panOffsetRef.current = target;
          setPanOffset(target);
        }
        if (isCameraMovingRef.current) {
          isCameraMovingRef.current = false;
          setIsCameraMoving(false);
        }
      } else {
        const distanceEase = Math.min(0.22, Math.max(0.075, distance / 3600));
        const next = {
          x: current.x + dx * distanceEase,
          y: current.y + dy * distanceEase,
        };
        panOffsetRef.current = next;
        setPanOffset(next);
        if (!isCameraMovingRef.current) {
          isCameraMovingRef.current = true;
          setIsCameraMoving(true);
        }
      }

      cameraFrameRef.current = requestAnimationFrame(tick);
    };

    cameraFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (cameraFrameRef.current) {
        cancelAnimationFrame(cameraFrameRef.current);
      }
    };
  }, []);

  // Stop the typewriter interval on unmount so it never setState after teardown.
  useEffect(() => {
    return () => {
      if (writingIntervalRef.current) {
        clearInterval(writingIntervalRef.current);
        writingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ctx || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    const worldWidth = rect.width / zoom;

    const layouts = getElementLayouts(elements, worldWidth);

    elements.forEach((element, index) => {
      const layout = layouts[index];
      if (!layout) return;
      ctx.save();
      ctx.translate(layout.x, layout.y);
      if (element.kind === 'diagram') {
        renderDiagram(ctx, element.diagram, element.displayContent, layout.width, layout.height, element.drawProgress);
      } else if (element.kind === 'construction') {
        renderConstruction(
          ctx,
          element.construction,
          element.displayContent,
          layout.width,
          layout.height,
          element.drawProgress,
        );
      } else if (containsLatex(element.content)) {
        // Typeset by KaTeX HTML overlay (see latex layer below) — skip raw-source draw.
      } else {
        drawTeachingContent(
          ctx,
          element.displayContent || element.content,
          layout.width,
          layout.height,
          element.annotations
        );
      }

      // Whole-step frames (tutor boxing a board card)
      const stepMarks = (element.annotations ?? []).filter((a) => a.kind === 'step');
      if (stepMarks.length) {
        const isDark = document.documentElement.classList.contains('dark');
        stepMarks.forEach((mark) => {
          drawHighlight(
            ctx,
            { x: 6, y: 6, width: Math.max(layout.width - 12, 24), height: Math.max(layout.height - 12, 24) },
            mark.style === 'circle' ? 'circle' : 'box',
            isDark,
            mark.label,
          );
        });
      }
      ctx.restore();
    });

    ctx.restore();
  }, [ctx, elements, panOffset, zoom]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      releaseTeacherFollow();
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    releaseTeacherFollow();
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastPinchDistance(distance);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsPanning(true);
      setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.touches.length === 2 && lastPinchDistance !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const delta = (distance - lastPinchDistance) * 0.003;
      const newZoom = Math.min(Math.max(0.1, zoom + delta), 5);

      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;

        const zoomRatio = newZoom / zoom;
        setManualCameraPosition({
          x: mouseX - (mouseX - panOffset.x) * zoomRatio,
          y: mouseY - (mouseY - panOffset.y) * zoomRatio,
        });
      }

      setZoom(newZoom);
      setLastPinchDistance(distance);
    } else if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setManualCameraPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setLastPinchDistance(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setManualCameraPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    releaseTeacherFollow();

    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY * -0.003;
      const newZoom = Math.min(Math.max(0.1, zoom + delta), 5);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomRatio = newZoom / zoom;
      setManualCameraPosition({
        x: mouseX - (mouseX - panOffset.x) * zoomRatio,
        y: mouseY - (mouseY - panOffset.y) * zoomRatio,
      });

      setZoom(newZoom);
    } else {
      setManualCameraPosition({
        x: panOffset.x - e.deltaX,
        y: panOffset.y - e.deltaY,
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventBrowserZoomOnPinch = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
    };

    canvas.addEventListener('wheel', preventBrowserZoomOnPinch, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', preventBrowserZoomOnPinch);
    };
  }, []);

  const handleZoomIn = () => {
    releaseTeacherFollow();
    setZoom(prev => Math.min(prev + 0.2, 5));
  };

  const handleZoomOut = () => {
    releaseTeacherFollow();
    setZoom(prev => Math.max(prev - 0.2, 0.1));
  };

  const handleResetView = () => {
    setIsAutoFollowEnabled(true);
    setLastManualMoveAt(null);
    setZoom(1);
    moveCameraTo(DEFAULT_CAMERA);
  };

  const drawTeachingLine = (
    context: CanvasRenderingContext2D,
    line: string,
    x: number,
    y: number,
    isDark: boolean
  ) => {
    const baseColor = isDark ? '#f0f0f0' : '#2d2d2d';

    if (line.includes('=')) {
      const parts = line.split('=');
      context.fillStyle = baseColor;
      context.fillText(`${parts[0]} =`, x, y);
      context.fillStyle = isDark ? '#6b9bd1' : '#1e6bb8';
      context.fillText(parts.slice(1).join('='), x + context.measureText(`${parts[0]} = `).width, y);
      context.fillStyle = baseColor;
      return;
    }

    if (line.includes('→')) {
      context.fillStyle = isDark ? '#8bd18b' : '#2d8b2d';
      context.fillText(line, x, y);
      context.fillStyle = baseColor;
      return;
    }

    context.fillText(line, x, y);
  };

  const drawTeachingContent = (
    context: CanvasRenderingContext2D,
    step: string,
    width: number,
    height: number,
    annotations: CanvasAnnotationSpec[] = []
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();

    context.font = TEACHING_FONT;
    context.fillStyle = isDark ? '#f0f0f0' : '#2d2d2d';
    context.strokeStyle = isDark ? '#f0f0f0' : '#2d2d2d';
    context.lineWidth = 2;

    const maxWidth = width - TEXT_PADDING_X * 2;
    const blocks = parseTeachingBlocks(context, step, maxWidth);
    let y = TEXT_PADDING_TOP;
    const baseColor = isDark ? '#f0f0f0' : '#2d2d2d';
    const accentColor = isDark ? '#6b9bd1' : '#1e6bb8';

    const laidOutLines: Array<{ text: string; x: number; y: number; lineHeight: number }> = [];
    const gridAnnotations = annotations.filter(
      (annotation): annotation is GridCellAnnotation & { targetStepIndex?: number } =>
        annotation.kind === 'grid_cell',
    );
    const textMatchAnnotations = annotations.filter((annotation) => annotation.kind === 'text_match');

    blocks.forEach((block) => {
      if (block.kind === 'text') {
        block.lines.forEach((line) => {
          laidOutLines.push({ text: line, x: TEXT_PADDING_X, y, lineHeight: LINE_HEIGHT });
          drawTeachingLine(context, line, TEXT_PADDING_X, y, isDark);
          y += LINE_HEIGHT;
        });
        return;
      }

      drawMatrixBlock(context, TEXT_PADDING_X, y, block.matrix, {
        isDark,
        accentColor,
        baseColor,
        annotations: gridAnnotations,
      });
      y += measureMatrixBlock(context, block.matrix).height + 10;
    });

    // Phrase / term highlights (box, circle, underline) — after text is drawn
    textMatchAnnotations.forEach((annotation) => {
      if (annotation.kind !== 'text_match') return;
      const bounds = findTextMatchBounds(
        context,
        laidOutLines,
        annotation.match,
        annotation.occurrence ?? 1,
      );
      if (!bounds) return;
      drawHighlight(
        context,
        bounds,
        annotation.style ?? 'box',
        isDark,
        annotation.label,
      );
    });

    context.restore();
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    if (writingIntervalRef.current) {
      clearInterval(writingIntervalRef.current);
      writingIntervalRef.current = null;
    }
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setElements([]);
    elementsRef.current = [];
    lastStepRef.current = '';
    setIsAutoFollowEnabled(true);
    setLastManualMoveAt(null);
    setCameraPosition(DEFAULT_CAMERA);
    setZoom(1);
    if (onClear) onClear();
  };

  const drawProgressLine = (
    context: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    progress: number
  ) => {
    if (progress <= 0) return;
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(
      x1 + (x2 - x1) * clampedProgress,
      y1 + (y2 - y1) * clampedProgress
    );
    context.stroke();
  };

  const fitSquare = (
    bounds: { x: number; y: number; width: number; height: number },
    padding: number
  ) => {
    const size = Math.max(40, Math.min(bounds.width, bounds.height) - padding * 2);
    return {
      x: bounds.x + (bounds.width - size) / 2,
      y: bounds.y + (bounds.height - size) / 2,
      size,
    };
  };

  const drawLabel = (
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: { color?: string; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {}
  ) => {
    context.save();
    context.fillStyle = options.color ?? context.fillStyle;
    context.font = options.font ?? '22px Caveat, Kalam, cursive';
    context.textAlign = options.align ?? 'center';
    context.textBaseline = options.baseline ?? 'middle';
    context.fillText(text, x, y);
    context.restore();
  };

  const drawPolygonProgress = (
    context: CanvasRenderingContext2D,
    points: Point[],
    progress: number,
    closePath = true
  ) => {
    if (points.length < 2 || progress <= 0) return;
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const segments = closePath ? points.length : points.length - 1;
    const totalProgress = clampedProgress * segments;
    const fullSegments = Math.floor(totalProgress);
    const partialProgress = totalProgress - fullSegments;

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < fullSegments; i++) {
      const nextPoint = points[(i + 1) % points.length];
      context.lineTo(nextPoint.x, nextPoint.y);
    }

    if (fullSegments < segments) {
      const start = points[fullSegments % points.length];
      const end = points[(fullSegments + 1) % points.length];
      context.lineTo(
        start.x + (end.x - start.x) * partialProgress,
        start.y + (end.y - start.y) * partialProgress
      );
    }

    context.stroke();
  };

  const renderDiagram = (
    context: CanvasRenderingContext2D,
    diagram: DiagramSpec,
    displayTitle: string,
    width: number,
    height: number,
    progress: number
  ) => {
    const diagramId = DIAGRAM_ALIASES[String(diagram.diagramId).toLowerCase().replace(/\s+/g, '_')] ?? 'unknown';
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#f0f0f0' : '#2d2d2d';

    context.font = '30px Caveat, Kalam, cursive';
    context.fillStyle = textColor;
    if (displayTitle) {
      context.fillText(displayTitle, 40, 42);
    }

    const diagramYOffset = 42;

    switch (diagramId) {
      case 'right_triangle':
        drawRightTriangle(context, width, height, diagramYOffset, progress);
        break;
      case 'coordinate_grid':
        drawCoordinateSystem(context, width, height, diagramYOffset, progress);
        break;
      case 'unit_circle':
        drawUnitCircle(context, width, height, diagramYOffset, progress);
        break;
      case 'sine_wave':
        drawSineGraph(context, width, height, diagramYOffset, progress);
        break;
      case 'parabola':
        drawParabola(context, width, height, diagramYOffset, progress);
        break;
      case 'pythagorean_rearrangement_square':
        drawPythagoreanRearrangementSquare(context, width, height, diagram.labels ?? {}, progress);
        break;
      default:
        drawUnavailableDiagram(context, width, height, diagram.title || String(diagram.diagramId || 'unknown'));
        break;
    }
  };

  const drawUnavailableDiagram = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    requestedDiagram: string
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#a7b0c2' : '#717182';
    const strokeColor = isDark ? 'rgba(163,179,205,0.35)' : 'rgba(0,0,0,0.16)';
    const boxWidth = Math.min(width - 80, 360);
    const boxHeight = 92;
    const x = (width - boxWidth) / 2;
    const y = Math.max(78, (height - boxHeight) / 2);

    context.save();
    context.strokeStyle = strokeColor;
    context.setLineDash([8, 8]);
    context.lineWidth = 2;
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.setLineDash([]);
    drawLabel(context, 'Diagram unavailable', width / 2, y + 34, {
      color: textColor,
      font: '24px Caveat, Kalam, cursive',
    });
    drawLabel(context, requestedDiagram, width / 2, y + 64, {
      color: textColor,
      font: '18px Caveat, Kalam, cursive',
    });
    context.restore();
  };

  const drawPythagoreanRearrangementSquare = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    labels: Record<string, string>,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const lineColor = isDark ? '#f0f0f0' : '#2d2d2d';
    const triangleStroke = isDark ? '#6b9bd1' : '#1e6bb8';
    const triangleFill = isDark ? 'rgba(107,155,209,0.16)' : 'rgba(30,107,184,0.10)';
    const centerFill = isDark ? 'rgba(139,209,139,0.18)' : 'rgba(45,139,45,0.10)';
    const accentColor = isDark ? '#8bd18b' : '#2d8b2d';
    const labelColor = isDark ? '#f0f0f0' : '#2d2d2d';
    const labelA = labels.a ?? 'a';
    const labelB = labels.b ?? 'b';
    const labelC = labels.c ?? 'c';
    const outerLabel = labels.outer ?? 'a + b';
    const square = fitSquare({ x: 28, y: 66, width: width - 56, height: height - 82 }, 10);
    const x = square.x;
    const y = square.y;
    const size = square.size;
    const a = size * 0.38;
    const b = size - a;

    const p0 = { x, y };
    const p1 = { x: x + size, y };
    const p2 = { x: x + size, y: y + size };
    const p3 = { x, y: y + size };
    const i0 = { x: x + a, y };
    const i1 = { x: x + size, y: y + a };
    const i2 = { x: x + b, y: y + size };
    const i3 = { x, y: y + b };

    const outerProgress = Math.min(progress / 0.22, 1);
    const triangleProgress = Math.min(Math.max((progress - 0.18) / 0.42, 0), 1);
    const centerProgress = Math.min(Math.max((progress - 0.58) / 0.24, 0), 1);
    const labelProgress = Math.min(Math.max((progress - 0.8) / 0.2, 0), 1);
    const triangles = [
      [p0, i0, i3],
      [i0, p1, i1],
      [i1, p2, i2],
      [i3, i2, p3],
    ];

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.strokeStyle = lineColor;
    context.lineWidth = 3;
    drawPolygonProgress(context, [p0, p1, p2, p3], outerProgress);

    if (triangleProgress > 0) {
      context.strokeStyle = triangleStroke;
      context.fillStyle = triangleFill;
      context.lineWidth = 2.4;
      triangles.forEach((triangle) => {
        if (triangleProgress >= 1) {
          context.beginPath();
          context.moveTo(triangle[0].x, triangle[0].y);
          context.lineTo(triangle[1].x, triangle[1].y);
          context.lineTo(triangle[2].x, triangle[2].y);
          context.closePath();
          context.fill();
        }
        drawPolygonProgress(context, triangle, triangleProgress);
      });
    }

    if (centerProgress > 0) {
      if (centerProgress >= 1) {
        context.beginPath();
        context.moveTo(i0.x, i0.y);
        context.lineTo(i1.x, i1.y);
        context.lineTo(i2.x, i2.y);
        context.lineTo(i3.x, i3.y);
        context.closePath();
        context.fillStyle = centerFill;
        context.fill();
      }
      context.strokeStyle = accentColor;
      context.lineWidth = 3;
      drawPolygonProgress(context, [i0, i1, i2, i3], centerProgress);
    }

    if (labelProgress > 0) {
      context.globalAlpha = labelProgress;
      drawLabel(context, `(${outerLabel})`, x + size / 2, y - 18, {
        color: labelColor,
        font: '22px Caveat, Kalam, cursive',
      });
      drawLabel(context, labelA, x + a / 2, y + 20, { color: labelColor });
      drawLabel(context, labelB, x + 18, y + b / 2, { color: labelColor });
      drawLabel(context, labelA, x + size - 18, y + a / 2, { color: labelColor });
      drawLabel(context, labelB, x + a + b / 2, y + 20, { color: labelColor });
      drawLabel(context, labelC, (i0.x + i1.x) / 2 + 10, (i0.y + i1.y) / 2 - 4, {
        color: accentColor,
        font: '24px Caveat, Kalam, cursive',
      });
      drawLabel(context, labelC, (i1.x + i2.x) / 2 + 14, (i1.y + i2.y) / 2 + 4, {
        color: accentColor,
        font: '24px Caveat, Kalam, cursive',
      });
      drawLabel(context, labelC, (i2.x + i3.x) / 2 - 10, (i2.y + i3.y) / 2 + 14, {
        color: accentColor,
        font: '24px Caveat, Kalam, cursive',
      });
      drawLabel(context, labelC, (i3.x + i0.x) / 2 - 14, (i3.y + i0.y) / 2 - 2, {
        color: accentColor,
        font: '24px Caveat, Kalam, cursive',
      });
      context.globalAlpha = 1;
    }

    context.restore();
  };

  const drawSineGraph = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const centerX = width / 2;
    const centerY = Math.min(yOffset + 90, height - 56);
    const scale = 28;

    const axesProgress = Math.min(progress / 0.25, 1);
    const curveProgress = Math.min(Math.max((progress - 0.25) / 0.65, 0), 1);
    const labelProgress = Math.min(Math.max((progress - 0.9) / 0.1, 0), 1);

    context.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    context.lineWidth = 1;
    drawProgressLine(context, 24, centerY, width - 24, centerY, axesProgress);
    drawProgressLine(context, centerX, centerY - 68, centerX, centerY + 68, axesProgress);

    context.strokeStyle = isDark ? '#d16b6b' : '#b83b1e';
    context.lineWidth = 3;
    context.beginPath();

    const maxX = -Math.PI * 2 + Math.PI * 4 * curveProgress;
    for (let x = -Math.PI * 2; x <= maxX; x += 0.1) {
      const y = Math.sin(x);
      const canvasX = centerX + x * scale;
      const canvasY = centerY - y * scale;

      if (x === -Math.PI * 2) {
        context.moveTo(canvasX, canvasY);
      } else {
        context.lineTo(canvasX, canvasY);
      }
    }
    context.stroke();

    if (labelProgress > 0) {
      context.font = '24px Caveat';
      context.fillStyle = isDark ? '#f0f0f0' : '#2d2d2d';
      context.globalAlpha = labelProgress;
      context.fillText('sin(x)', width - 92, centerY - 48);
      context.globalAlpha = 1;
    }
  };

  const drawRightTriangle = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const startX = width / 2 - 100;
    const startY = Math.min(yOffset + 122, height - 34);
    const baseLength = 170;
    const heightLength = 112;

    context.strokeStyle = isDark ? '#6b9bd1' : '#1e6bb8';
    context.lineWidth = 3;

    const edge1 = Math.min(progress / 0.33, 1);
    const edge2 = Math.min(Math.max((progress - 0.33) / 0.33, 0), 1);
    const edge3 = Math.min(Math.max((progress - 0.66) / 0.2, 0), 1);
    const labelsProgress = Math.min(Math.max((progress - 0.86) / 0.14, 0), 1);
    drawProgressLine(context, startX, startY, startX + baseLength, startY, edge1);
    drawProgressLine(
      context,
      startX + baseLength,
      startY,
      startX + baseLength,
      startY - heightLength,
      edge2
    );
    drawProgressLine(
      context,
      startX + baseLength,
      startY - heightLength,
      startX,
      startY,
      edge3
    );

    context.fillStyle = isDark ? '#8bd18b' : '#2d8b2d';
    context.font = '28px Caveat';
    if (labelsProgress > 0) {
      context.globalAlpha = labelsProgress;
      context.fillText('a', startX + baseLength / 2, startY + 30);
      context.fillText('b', startX + baseLength + 20, startY - heightLength / 2);
      context.fillText('c', startX + baseLength / 2 - 30, startY - heightLength / 2);
      context.globalAlpha = 1;
    }

    const squareSize = 15;
    context.strokeStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
    context.lineWidth = 1;
    if (labelsProgress > 0.4) {
      context.globalAlpha = labelsProgress;
      context.strokeRect(startX + baseLength - squareSize, startY - squareSize, squareSize, squareSize);
      context.globalAlpha = 1;
    }
  };

  const drawUnitCircle = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const centerX = width / 2;
    const centerY = Math.min(yOffset + 96, height - 88);
    const radius = 78;

    const axesProgress = Math.min(progress / 0.25, 1);
    const circleProgress = Math.min(Math.max((progress - 0.25) / 0.3, 0), 1);
    const radiusProgress = Math.min(Math.max((progress - 0.55) / 0.25, 0), 1);
    const labelsProgress = Math.min(Math.max((progress - 0.8) / 0.2, 0), 1);

    context.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    context.lineWidth = 1;
    drawProgressLine(context, centerX - radius - 20, centerY, centerX + radius + 20, centerY, axesProgress);
    drawProgressLine(context, centerX, centerY - radius - 20, centerX, centerY + radius + 20, axesProgress);

    context.strokeStyle = isDark ? '#6b9bd1' : '#1e6bb8';
    context.lineWidth = 3;
    if (circleProgress > 0) {
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, 2 * Math.PI * circleProgress);
      context.stroke();
    }

    const angle = Math.PI / 4;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY - radius * Math.sin(angle);

    context.strokeStyle = isDark ? '#d16b6b' : '#b83b1e';
    drawProgressLine(context, centerX, centerY, x, y, radiusProgress);

    context.fillStyle = isDark ? '#d16b6b' : '#b83b1e';
    if (radiusProgress > 0.8) {
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);
      context.fill();
    }

    if (labelsProgress > 0) {
      context.font = '24px Caveat';
      context.fillStyle = isDark ? '#f0f0f0' : '#2d2d2d';
      context.globalAlpha = labelsProgress;
      context.fillText('θ', centerX + 20, centerY - 10);
      context.fillText('(cos θ, sin θ)', x + 10, y - 10);
      context.globalAlpha = 1;
    }
  };

  const drawParabola = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const centerX = width / 2;
    const centerY = yOffset + 96;
    const halfH = 82;
    const scale = 8;

    const axesProgress = Math.min(progress / 0.25, 1);
    const curveProgress = Math.min(Math.max((progress - 0.25) / 0.6, 0), 1);
    const marksProgress = Math.min(Math.max((progress - 0.85) / 0.15, 0), 1);

    context.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    context.lineWidth = 1;
    drawProgressLine(context, centerX - 140, centerY, centerX + 140, centerY, axesProgress);
    drawProgressLine(context, centerX, centerY - halfH, centerX, centerY + halfH, axesProgress);

    context.strokeStyle = isDark ? '#8bd18b' : '#2d8b2d';
    context.lineWidth = 3;
    context.beginPath();

    const maxX = -5 + 10 * curveProgress;
    for (let x = -5; x <= maxX; x += 0.1) {
      const y = x * x;
      const canvasX = centerX + x * scale;
      const canvasY = centerY - y * scale;

      if (x === -6) {
        context.moveTo(canvasX, canvasY);
      } else {
        context.lineTo(canvasX, canvasY);
      }
    }
    context.stroke();

    if (marksProgress > 0) {
      context.fillStyle = isDark ? '#d16b6b' : '#b83b1e';
      context.globalAlpha = marksProgress;
      context.beginPath();
      context.arc(centerX + 2 * scale, centerY - 4 * scale, 4, 0, 2 * Math.PI);
      context.fill();
      context.beginPath();
      context.arc(centerX + 3 * scale, centerY - 9 * scale, 4, 0, 2 * Math.PI);
      context.fill();
      context.font = '20px Caveat';
      context.fillStyle = isDark ? '#f0f0f0' : '#2d2d2d';
      context.fillText('y = x²', centerX + 60, centerY - halfH + 20);
      context.globalAlpha = 1;
    }
  };

  const drawCoordinateSystem = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    yOffset: number,
    progress: number
  ) => {
    const isDark = document.documentElement.classList.contains('dark');
    const gridWidth = Math.min(260, width - 56);
    const gridHeight = 150;
    const startX = (width - gridWidth) / 2;
    const startY = yOffset + 50;
    const centerX = startX + gridWidth / 2;
    const centerY = startY + gridHeight / 2;
    const gridSize = 26;

    const gridProgress = Math.min(progress / 0.55, 1);
    const axisProgress = Math.min(Math.max((progress - 0.55) / 0.3, 0), 1);
    const labelsProgress = Math.min(Math.max((progress - 0.85) / 0.15, 0), 1);
    const xSteps = Math.floor((gridWidth / gridSize + 1) * gridProgress);
    const ySteps = Math.floor((gridHeight / gridSize + 1) * gridProgress);

    context.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    context.lineWidth = 1;

    for (let i = 0; i < xSteps; i++) {
      const x = startX + i * gridSize;
      context.beginPath();
      context.moveTo(x, startY);
      context.lineTo(x, startY + gridHeight);
      context.stroke();
    }

    for (let i = 0; i < ySteps; i++) {
      const y = startY + i * gridSize;
      context.beginPath();
      context.moveTo(startX, y);
      context.lineTo(startX + gridWidth, y);
      context.stroke();
    }

    context.strokeStyle = isDark ? '#f0f0f0' : '#2d2d2d';
    context.lineWidth = 2;

    drawProgressLine(context, startX, centerY, startX + gridWidth, centerY, axisProgress);
    drawProgressLine(context, centerX, startY, centerX, startY + gridHeight, axisProgress);

    context.fillStyle = isDark ? '#f0f0f0' : '#2d2d2d';
    context.font = '24px Caveat';
    if (labelsProgress > 0) {
      context.globalAlpha = labelsProgress;
      context.fillText('x', startX + gridWidth - 20, centerY - 10);
      context.fillText('y', centerX + 10, startY + 20);
      context.fillText('0', centerX + 5, centerY + 25);
      context.globalAlpha = 1;
    }
  };

  const worldWidth =
    typeof window !== 'undefined' && canvasRef.current
      ? canvasRef.current.getBoundingClientRect().width / zoom
      : 800;
  const latexLayouts = getElementLayouts(elements, worldWidth);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          background: 'var(--canvas-bg)',
          backgroundImage: 'linear-gradient(var(--canvas-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--canvas-grid-line) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          cursor: isPanning ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* KaTeX board layer — real math typesetting, follows pan/zoom */}
      <div className="mathlon-latex-layer" aria-hidden>
        <div
          className="mathlon-latex-world"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            width: worldWidth,
          }}
        >
          {elements.map((element, index) => {
            if (element.kind !== 'text' || !containsLatex(element.content)) return null;
            const layout = latexLayouts[index];
            if (!layout) return null;
            const source = element.displayContent || element.content;
            if (!source) return null;
            return (
              <LatexStepOverlay
                key={`latex-${element.timestamp}-${index}`}
                stepKey={`${element.timestamp}-${index}-${(element.annotations ?? []).length}`}
                content={source}
                annotations={element.annotations}
                layout={layout}
              />
            );
          })}
        </div>
      </div>

      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs shadow-lg backdrop-blur-md transition-all duration-200 ${
            isAutoFollowEnabled
              ? 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
              : 'border-border bg-card/85 text-muted-foreground'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isTeaching && isAutoFollowEnabled ? 'animate-pulse' : ''}`} />
          <span>{isAutoFollowEnabled ? 'Following teacher' : 'Free canvas'}</span>
        </div>

        {!isAutoFollowEnabled && elements.length > 0 && (
          <button
            onClick={returnToTeacher}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-xl active:translate-y-0"
            title="Return to the active teaching step"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Back to teacher
          </button>
        )}
      </div>

      {/* Zoom bar */}
      <div className="absolute bottom-28 left-4 z-10 w-[54px] rounded-xl border border-[#e0ddd6] bg-white p-2 shadow-[0_4px_8px_#e8e8e8]">
        <button
          onClick={handleZoomIn}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f3f5] text-[#2d2d2d] transition-colors hover:bg-[#e9ebef]"
          title="Zoom In"
        >
          <span className="text-[18px] leading-[18px] font-medium text-[#2d2d2d]">+</span>
        </button>
        <button
          onClick={handleZoomOut}
          className="mt-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f3f5] text-[#2d2d2d] transition-colors hover:bg-[#e9ebef]"
          title="Zoom Out"
        >
          <span className="text-[18px] leading-[18px] font-medium text-[#2d2d2d]">−</span>
        </button>
        <button
          onClick={handleResetView}
          className="mt-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f3f5] transition-colors hover:bg-[#e9ebef]"
          title="Reset View"
        >
          <img src={zoomFitIcon.src} alt="Reset view" className="h-[18px] w-[18px] opacity-80 dark:invert" />
        </button>
        <div className="mt-2 text-center text-[11px] font-semibold leading-[1.2] text-[#717182] tabular-nums">
          {Math.round(zoom * 100)}%
        </div>
        {elements.length > 0 && (
          <>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="mt-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f3f5] text-[#2d2d2d] transition-colors hover:bg-destructive hover:text-destructive-foreground"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {elements.length > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-sm shadow-lg backdrop-blur-sm transition-all duration-200">
          <Move className={`w-4 h-4 ${isPanning || isCameraMoving ? 'text-primary' : 'text-muted-foreground'}`} />
          <span>
            {isPanning
              ? 'Panning...'
              : lastManualMoveAt
                ? 'Canvas unlocked - use Back to teacher when ready'
                : isCameraMoving
                  ? 'Gliding to the next step'
                  : 'Drag to pan - Ctrl + scroll to zoom - pinch to zoom'}
          </span>
        </div>
      )}

      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold">Clear canvas?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                All drawn content will be permanently removed. This can't be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearCanvas();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
