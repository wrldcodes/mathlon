export type SessionEntryMode = 'text-first' | 'mic-first';

export type SessionStatus = 'created' | 'active' | 'paused' | 'ended';

/** Board snapshot stored on the session document (JSON-safe). */
export type PersistedCanvasAnnotation = {
  kind: string;
  style?: string;
  label?: string;
  targetStepIndex?: number;
  match?: string;
  occurrence?: number;
  row?: number;
  column?: number;
  gridLabel?: string;
  [key: string]: unknown;
};

export type PersistedCanvasStep =
  | {
      kind: 'text';
      content: string;
      annotations?: PersistedCanvasAnnotation[];
    }
  | {
      kind: 'diagram';
      content: string;
      diagramId: string;
      title?: string;
      labels?: Record<string, string>;
      variant?: string;
      annotations?: PersistedCanvasAnnotation[];
    }
  | {
      kind: 'construction';
      content: string;
      title?: string;
      /** Full construction payload so the board can be restored. */
      construction: { title?: string; steps: unknown[] };
      annotations?: PersistedCanvasAnnotation[];
    };

export type PersistedCanvasState = {
  version: 1;
  camera?: {
    panOffset: { x: number; y: number };
    zoom: number;
  };
  steps: PersistedCanvasStep[];
  updatedAt?: string;
};

export type TeachingSession = {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  entryMode: SessionEntryMode;
  status: SessionStatus;
  demo: boolean;
  /** Wall-clock deadline for demo sessions, set once at creation.
   * The client derives its countdown from this instead of a local
   * timer, so the cap survives reloads, dropped `?demo=true` params,
   * and the device sleeping mid-session. Absent for non-demo sessions. */
  demoExpiresAt?: string;
  providerConversationId?: string;
  canvasState?: PersistedCanvasState;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};

export type CreateSessionInput = {
  title: string;
  prompt?: string;
  entryMode?: SessionEntryMode;
  demo?: boolean;
  userId?: string;
};

export type UpdateSessionInput = {
  status?: SessionStatus;
  title?: string;
  providerConversationId?: string;
  canvasState?: PersistedCanvasState | null;
};
