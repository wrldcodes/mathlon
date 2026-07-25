import type { PersistedCanvasState } from '@/lib/sessions/types';

const PREVIEW_MAX = 140;

export type BoardStepSummary = {
  index: number;
  kind: 'text' | 'diagram' | 'construction';
  preview: string;
  annotationCount: number;
};

export type BoardSummary = {
  stepCount: number;
  steps: BoardStepSummary[];
};

function truncate(text: string, max = PREVIEW_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Compact board inventory for the tutor model (indexes + short previews). */
export function summarizeBoard(snapshot: Pick<PersistedCanvasState, 'steps'>): BoardSummary {
  const steps = (snapshot.steps ?? []).map((step, index) => {
    let preview = '';
    if (step.kind === 'text') {
      preview = truncate(step.content);
    } else if (step.kind === 'diagram') {
      preview = truncate(
        `[diagram:${step.diagramId}] ${step.title || step.content || ''}`.trim(),
      );
    } else {
      const n = Array.isArray(step.construction?.steps) ? step.construction.steps.length : 0;
      preview = truncate(`[construction:${n} ops] ${step.title || step.content || ''}`.trim());
    }
    return {
      index,
      kind: step.kind,
      preview,
      annotationCount: Array.isArray(step.annotations) ? step.annotations.length : 0,
    };
  });

  return { stepCount: steps.length, steps };
}
