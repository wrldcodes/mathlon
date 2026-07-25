/**
 * Construction-based canvas drawing.
 *
 * The LLM describes geometry as ordered construction steps (points, segments,
 * circles, labels, right-angle marks). Coordinates use a normalized 0–100
 * board space so the model does not need pixel math.
 */

export type ConstructionPoint = [number, number];

export type ConstructionStep =
  | {
      op: 'point';
      id: string;
      at: ConstructionPoint;
      label?: string;
    }
  | {
      op: 'segment';
      from: string;
      to: string;
      label?: string;
    }
  | {
      op: 'polyline';
      points: string[];
      closed?: boolean;
      label?: string;
    }
  | {
      op: 'circle';
      center: string;
      /** Absolute radius in 0–100 board units. Ignored if `through` is set. */
      radius?: number;
      /** Draw a circle centered at `center` that passes through this point id. */
      through?: string;
      label?: string;
    }
  | {
      op: 'right_angle';
      at: string;
      from: string;
      to: string;
    }
  | {
      op: 'label';
      text: string;
      /** Absolute position in 0–100 board space. */
      at?: ConstructionPoint;
      /** Place near an existing point id. */
      near?: string;
      /** Offset from `near` / `at`, in board units. */
      offset?: ConstructionPoint;
    }
  | {
      op: 'arrow';
      from: string;
      to: string;
      label?: string;
    };

export type ConstructionSpec = {
  title?: string;
  steps: ConstructionStep[];
};

type ResolvedPoint = { x: number; y: number };

const BOARD_MIN = 0;
const BOARD_MAX = 100;

function asPoint(value: unknown): ConstructionPoint | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

function clampBoard(n: number) {
  return Math.min(BOARD_MAX, Math.max(BOARD_MIN, n));
}

function midpoint(a: ResolvedPoint, b: ResolvedPoint): ResolvedPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: ResolvedPoint, b: ResolvedPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unitVector(from: ResolvedPoint, to: ResolvedPoint): ResolvedPoint {
  const d = distance(from, to) || 1;
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

function normalizeStep(raw: unknown): ConstructionStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const step = raw as Record<string, unknown>;
  const op = String(step.op ?? '').trim().toLowerCase();

  switch (op) {
    case 'point': {
      const id = String(step.id ?? '').trim();
      const at = asPoint(step.at);
      if (!id || !at) return null;
      const label = step.label != null ? String(step.label) : undefined;
      return { op: 'point', id, at, label };
    }
    case 'segment': {
      const from = String(step.from ?? '').trim();
      const to = String(step.to ?? '').trim();
      if (!from || !to) return null;
      const label = step.label != null ? String(step.label) : undefined;
      return { op: 'segment', from, to, label };
    }
    case 'polyline': {
      const points = Array.isArray(step.points)
        ? step.points.map((p) => String(p ?? '').trim()).filter(Boolean)
        : [];
      if (points.length < 2) return null;
      const label = step.label != null ? String(step.label) : undefined;
      return { op: 'polyline', points, closed: Boolean(step.closed), label };
    }
    case 'circle': {
      const center = String(step.center ?? '').trim();
      if (!center) return null;
      const through = step.through != null ? String(step.through).trim() : undefined;
      const radius = step.radius != null ? Number(step.radius) : undefined;
      const label = step.label != null ? String(step.label) : undefined;
      if (!through && !(typeof radius === 'number' && Number.isFinite(radius) && radius > 0)) {
        return null;
      }
      return {
        op: 'circle',
        center,
        through: through || undefined,
        radius: Number.isFinite(radius) ? radius : undefined,
        label,
      };
    }
    case 'right_angle': {
      const at = String(step.at ?? '').trim();
      const from = String(step.from ?? '').trim();
      const to = String(step.to ?? '').trim();
      if (!at || !from || !to) return null;
      return { op: 'right_angle', at, from, to };
    }
    case 'label': {
      const text = String(step.text ?? '').trim();
      if (!text) return null;
      const at = asPoint(step.at) ?? undefined;
      const near = step.near != null ? String(step.near).trim() : undefined;
      const offset = asPoint(step.offset) ?? undefined;
      if (!at && !near) return null;
      return { op: 'label', text, at, near: near || undefined, offset };
    }
    case 'arrow': {
      const from = String(step.from ?? '').trim();
      const to = String(step.to ?? '').trim();
      if (!from || !to) return null;
      const label = step.label != null ? String(step.label) : undefined;
      return { op: 'arrow', from, to, label };
    }
    default:
      return null;
  }
}

/** Parse/normalize a tool payload into a safe ConstructionSpec. */
export function normalizeConstructionSpec(input: unknown): ConstructionSpec | null {
  if (!input) return null;

  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  const title = obj.title != null ? String(obj.title).trim() : undefined;
  const stepsRaw = Array.isArray(obj.steps)
    ? obj.steps
    : Array.isArray(obj.construction)
      ? obj.construction
      : null;
  if (!stepsRaw) return null;

  const steps = stepsRaw.map(normalizeStep).filter((s): s is ConstructionStep => Boolean(s));
  if (steps.length === 0) return null;

  return { title: title || undefined, steps };
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontPx = 24,
) {
  context.save();
  context.fillStyle = color;
  context.font = `${fontPx}px Caveat, Kalam, cursive`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, x, y);
  context.restore();
}

/** Board-space points the model placed (for auto-fit framing). */
function collectBoardPoints(steps: ConstructionStep[]): ConstructionPoint[] {
  const pts: ConstructionPoint[] = [];
  for (const step of steps) {
    if (step.op === 'point') pts.push(step.at);
    if (step.op === 'label' && step.at) pts.push(step.at);
  }
  return pts;
}

/**
 * Map 0–100 board coords into the diagram band, zooming to the figure's
 * bounding box so small agent layouts don't render as a tiny cramped sketch.
 */
function createBoardMapper(
  steps: ConstructionStep[],
  width: number,
  height: number,
  titleReserve: number,
) {
  const padX = 56;
  const padY = 44;
  const drawLeft = padX;
  const drawTop = titleReserve + padY * 0.35;
  const drawW = Math.max(120, width - padX * 2);
  const drawH = Math.max(120, height - titleReserve - padY);

  const pts = collectBoardPoints(steps);
  let minX = 0;
  let minY = 0;
  let maxX = 100;
  let maxY = 100;
  if (pts.length >= 2) {
    minX = Math.min(...pts.map((p) => p[0]));
    minY = Math.min(...pts.map((p) => p[1]));
    maxX = Math.max(...pts.map((p) => p[0]));
    maxY = Math.max(...pts.map((p) => p[1]));
    // Keep a little board-space breathing room around the figure for labels
    const spanX = Math.max(12, maxX - minX);
    const spanY = Math.max(12, maxY - minY);
    const growX = spanX * 0.22;
    const growY = spanY * 0.28;
    minX = clampBoard(minX - growX);
    maxX = clampBoard(maxX + growX);
    minY = clampBoard(minY - growY);
    maxY = clampBoard(maxY + growY);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(drawW / spanX, drawH / spanY) * 100;
  // Center the fitted figure in the draw rect
  const usedW = (spanX / 100) * scale;
  const usedH = (spanY / 100) * scale;
  const originX = drawLeft + (drawW - usedW) / 2 - (minX / 100) * scale;
  const originY = drawTop + (drawH - usedH) / 2 - (minY / 100) * scale;

  const map = (at: ConstructionPoint): ResolvedPoint => ({
    x: originX + (clampBoard(at[0]) / 100) * scale,
    y: originY + (clampBoard(at[1]) / 100) * scale,
  });

  // Stroke / label sizes scale gently with figure size (readable, not huge)
  const unit = scale / 100;
  const labelFont = Math.round(Math.min(30, Math.max(22, unit * 5.5)));
  const pointRadius = Math.min(7, Math.max(4.5, unit * 1.1));
  const rightAngleSize = Math.min(22, Math.max(14, unit * 3.2));
  const labelNudge = Math.min(28, Math.max(16, unit * 4));

  return { map, scale, labelFont, pointRadius, rightAngleSize, labelNudge };
}

function drawLineProgress(
  context: CanvasRenderingContext2D,
  from: ResolvedPoint,
  to: ResolvedPoint,
  progress: number,
) {
  if (progress <= 0) return;
  const t = Math.min(1, Math.max(0, progress));
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  context.stroke();
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  from: ResolvedPoint,
  to: ResolvedPoint,
  size = 10,
) {
  const u = unitVector(from, to);
  const left = { x: -u.y, y: u.x };
  const tip = to;
  const base = { x: to.x - u.x * size, y: to.y - u.y * size };
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(base.x + left.x * size * 0.55, base.y + left.y * size * 0.55);
  context.lineTo(base.x - left.x * size * 0.55, base.y - left.y * size * 0.55);
  context.closePath();
  context.fill();
}

/**
 * Render a construction into a diagram band.
 * `progress` 0–1 reveals steps in order (tutor stroke feel).
 *
 * Figures auto-fit their bounding box into the band so agent layouts that only
 * use a corner of 0–100 space still read large and airy (not a tiny sketch).
 */
export function renderConstruction(
  context: CanvasRenderingContext2D,
  construction: ConstructionSpec,
  displayTitle: string,
  width: number,
  height: number,
  progress: number,
) {
  const isDark = document.documentElement.classList.contains('dark');
  const lineColor = isDark ? '#f0f0f0' : '#2d2d2d';
  const accentColor = isDark ? '#6b9bd1' : '#1e6bb8';
  const mutedColor = isDark ? '#a7b0c2' : '#717182';

  context.save();
  const titleFont = Math.round(Math.min(34, Math.max(28, width * 0.028)));
  context.font = `${titleFont}px Caveat, Kalam, cursive`;
  context.fillStyle = lineColor;
  const titleReserve = displayTitle ? titleFont + 18 : 12;
  if (displayTitle) {
    context.fillText(displayTitle, 40, titleFont + 8);
  }

  const { map, scale, labelFont, pointRadius, rightAngleSize, labelNudge } = createBoardMapper(
    construction.steps,
    width,
    height,
    titleReserve,
  );

  const points = new Map<string, ResolvedPoint>();
  const visibleCount = Math.max(1, Math.ceil(construction.steps.length * Math.min(1, Math.max(0, progress))));

  context.lineWidth = Math.min(3.2, Math.max(2.4, scale / 100));
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = lineColor;
  context.fillStyle = lineColor;

  for (let i = 0; i < visibleCount; i++) {
    const step = construction.steps[i];
    const stepProgress =
      i < visibleCount - 1 ? 1 : Math.min(1, Math.max(0.15, construction.steps.length * progress - i));

    switch (step.op) {
      case 'point': {
        const p = map(step.at);
        points.set(step.id, p);
        context.beginPath();
        context.fillStyle = accentColor;
        context.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = lineColor;
        if (step.label) {
          drawLabel(
            context,
            step.label,
            p.x + labelNudge * 0.7,
            p.y - labelNudge * 0.7,
            lineColor,
            labelFont,
          );
        }
        break;
      }
      case 'segment': {
        const from = points.get(step.from);
        const to = points.get(step.to);
        if (!from || !to) break;
        context.strokeStyle = lineColor;
        drawLineProgress(context, from, to, stepProgress);
        if (step.label && stepProgress > 0.7) {
          const mid = midpoint(from, to);
          const u = unitVector(from, to);
          drawLabel(
            context,
            step.label,
            mid.x - u.y * labelNudge,
            mid.y + u.x * labelNudge,
            mutedColor,
            labelFont,
          );
        }
        break;
      }
      case 'polyline': {
        const pts = step.points.map((id) => points.get(id)).filter(Boolean) as ResolvedPoint[];
        if (pts.length < 2) break;
        context.strokeStyle = lineColor;
        const segmentCount = step.closed ? pts.length : pts.length - 1;
        const total = stepProgress * segmentCount;
        const full = Math.floor(total);
        const partial = total - full;
        context.beginPath();
        context.moveTo(pts[0].x, pts[0].y);
        for (let s = 0; s < full; s++) {
          const next = pts[(s + 1) % pts.length];
          context.lineTo(next.x, next.y);
        }
        if (full < segmentCount) {
          const a = pts[full % pts.length];
          const b = pts[(full + 1) % pts.length];
          context.lineTo(a.x + (b.x - a.x) * partial, a.y + (b.y - a.y) * partial);
        }
        context.stroke();
        if (step.label && stepProgress > 0.7) {
          const mid = midpoint(pts[0], pts[1]);
          drawLabel(context, step.label, mid.x, mid.y - labelNudge, mutedColor, labelFont);
        }
        break;
      }
      case 'circle': {
        const center = points.get(step.center);
        if (!center) break;
        let radiusPx = 0;
        if (step.through) {
          const through = points.get(step.through);
          if (!through) break;
          radiusPx = distance(center, through);
        } else if (typeof step.radius === 'number') {
          radiusPx = (clampBoard(step.radius) / 100) * scale;
        }
        if (radiusPx <= 0) break;
        context.strokeStyle = accentColor;
        context.beginPath();
        context.arc(center.x, center.y, radiusPx, 0, Math.PI * 2 * stepProgress);
        context.stroke();
        context.strokeStyle = lineColor;
        if (step.label && stepProgress > 0.7) {
          drawLabel(
            context,
            step.label,
            center.x,
            center.y - radiusPx - labelNudge,
            mutedColor,
            labelFont,
          );
        }
        break;
      }
      case 'right_angle': {
        const at = points.get(step.at);
        const from = points.get(step.from);
        const to = points.get(step.to);
        if (!at || !from || !to) break;
        const u1 = unitVector(at, from);
        const u2 = unitVector(at, to);
        const size = rightAngleSize;
        const a = { x: at.x + u1.x * size, y: at.y + u1.y * size };
        const c = { x: at.x + u2.x * size, y: at.y + u2.y * size };
        const b = { x: a.x + u2.x * size, y: a.y + u2.y * size };
        context.strokeStyle = accentColor;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.lineTo(c.x, c.y);
        context.stroke();
        context.strokeStyle = lineColor;
        break;
      }
      case 'label': {
        let base: ResolvedPoint | null = null;
        if (step.at) base = map(step.at);
        else if (step.near) base = points.get(step.near) ?? null;
        if (!base) break;
        // Default offset pushes labels outward so they don't sit on vertices
        const ox = step.offset ? (step.offset[0] / 100) * scale : 0;
        const oy = step.offset ? (step.offset[1] / 100) * scale : -labelNudge;
        drawLabel(context, step.text, base.x + ox, base.y + oy, lineColor, labelFont);
        break;
      }
      case 'arrow': {
        const from = points.get(step.from);
        const to = points.get(step.to);
        if (!from || !to) break;
        context.strokeStyle = accentColor;
        context.fillStyle = accentColor;
        drawLineProgress(context, from, to, stepProgress);
        if (stepProgress > 0.85) drawArrowHead(context, from, to, Math.max(10, labelNudge * 0.55));
        context.strokeStyle = lineColor;
        context.fillStyle = lineColor;
        if (step.label && stepProgress > 0.7) {
          const mid = midpoint(from, to);
          drawLabel(context, step.label, mid.x, mid.y - labelNudge, mutedColor, labelFont);
        }
        break;
      }
    }
  }

  context.restore();
}
