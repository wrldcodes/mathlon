import type { TeachingCanvasHandle } from '../components/TeachingCanvas';

export type SessionEntryMode = 'text-first' | 'mic-first';

export type SessionEvent =
  | { t: number; type: 'session_start'; entryMode: SessionEntryMode; provider: string; conversationId?: string }
  | { t: number; type: 'session_end'; reason?: string }
  | { t: number; type: 'status'; text: string }
  | { t: number; type: 'error'; error: string }
  | { t: number; type: 'user_message'; text: string }
  | { t: number; type: 'assistant_message'; text: string }
  | { t: number; type: 'tool_call'; name: string; args: Record<string, unknown>; result?: unknown; error?: string }
  | { t: number; type: 'canvas_snapshot'; snapshot: ReturnType<TeachingCanvasHandle['getSnapshot']> };

export type SessionBundle = {
  version: 1;
  startedAtIso: string;
  endedAtIso?: string;
  provider: string;
  entryMode: SessionEntryMode;
  conversationId?: string;
  events: SessionEvent[];
};

function nowIso() {
  return new Date().toISOString();
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export class SessionRecorder {
  private startMs: number | null = null;
  private bundle: SessionBundle | null = null;

  start(entryMode: SessionEntryMode, provider: string, conversationId?: string) {
    const startedAtIso = nowIso();
    this.startMs = performance.now();
    this.bundle = {
      version: 1,
      startedAtIso,
      provider,
      entryMode,
      conversationId,
      events: [],
    };
    this.push({ type: 'session_start', entryMode, provider, conversationId });
  }

  setConversationId(conversationId: string) {
    if (!this.bundle) return;
    this.bundle.conversationId = conversationId;
    // Also log as a status line for easy scanning
    this.push({ type: 'status', text: `Conversation ID: ${conversationId}` });
  }

  end(reason?: string) {
    if (!this.bundle || this.bundle.endedAtIso) return;
    this.push({ type: 'session_end', reason });
    this.bundle.endedAtIso = nowIso();
  }

  // Intentionally permissive: we want logging to never block the teaching flow.
  // The exported JSON remains structured via the SessionEvent union above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push(event: any) {
    if (!this.bundle || this.startMs == null) return;
    const t = Math.max(0, Math.round(performance.now() - this.startMs));
    this.bundle.events.push({ ...event, t } as SessionEvent);
  }

  snapshotCanvas(canvas: TeachingCanvasHandle | null) {
    if (!canvas) return;
    try {
      this.push({ type: 'canvas_snapshot', snapshot: canvas.getSnapshot() });
    } catch (err) {
      this.push({
        type: 'error',
        error: err instanceof Error ? err.message : 'Failed to snapshot canvas',
      });
    }
  }

  export(filenamePrefix = 'mathlon-session') {
    if (!this.bundle) return;
    const safeStart = this.bundle.startedAtIso.replace(/[:.]/g, '-');
    downloadJson(`${filenamePrefix}-${safeStart}.json`, this.bundle);
  }
}

