// Provider-agnostic voice contract (the "port").
//
// Every voice backend (Vapi today; Gemini Live + LiveKit next; ElevenLabs
// later) implements this same shape as a React hook. The rest of the app only
// ever talks to this contract, so swapping providers never touches the canvas
// or any UI component.

/** A voice provider identifier. Add new ones here as adapters are built. */
export type VoiceProviderId = 'vapi' | 'gemini' | 'elevenlabs';

/** A tool the AI asks the client to run against the teaching canvas. */
export interface CanvasToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * The result of running a tool, sent back to the model.
 *
 * This is the fix for the "27 failed tool-calls per session" problem: providers
 * that support two-way tools (Gemini Live, ElevenLabs) can return this so the
 * model knows the canvas action succeeded. One-way providers (Vapi) simply
 * ignore the return value, so adding it is backwards-compatible.
 */
export interface ToolResult {
  result: unknown;
  error?: string;
}

/** Callbacks the app hands to a voice provider. */
export interface VoiceCallbacks {
  /** Final user speech transcript. */
  onUserTranscript: (text: string) => void;
  /** Assistant text (transcript of what it spoke). */
  onAssistantMessage?: (text: string) => void;
  /** Fires when the assistant starts/stops actively teaching. */
  onTeachingStateChange?: (isTeaching: boolean) => void;
  /**
   * The AI wants to act on the canvas. Return a ToolResult to report the
   * outcome back to the model (providers that don't support it ignore it).
   */
  onToolCall?: (
    toolCall: CanvasToolCall,
  ) => void | ToolResult | Promise<void | ToolResult>;
  /** Human-readable status changes (connecting, listening, speaking, ...). */
  onStatusChange?: (status: string) => void;
  /** Any provider-level error. */
  onError?: (error: unknown) => void;
  /** Provider session metadata (e.g. ElevenLabs conversationId). */
  onSessionMeta?: (meta: { provider: VoiceProviderId; conversationId: string }) => void;
}

export type SendTextOptions = {
  /**
   * Text-first session launch: the student typed a question before connecting.
   * Uses a contextual bridge first message instead of the dashboard greeting.
   */
  textFirstLaunch?: boolean;
};

export type StartSessionOptions = {
  /**
   * Reconnecting to a Mathlon session that already has board content.
   * Compact board inventory for the agent (indexes + previews).
   */
  resumeBoardSummary?: string;
};

/** The live session handle a provider returns. */
export interface VoiceSession {
  isSessionActive: boolean;
  /** True when the session is connected but teaching is frozen (no agent speech, no listen). */
  isPaused: boolean;
  /** Student microphone muted (independent of pause). */
  isMicMuted: boolean;
  statusText: string;
  isConfigured: boolean;
  isConnecting: boolean;
  startSession: (options?: StartSessionOptions) => Promise<void>;
  /** End the session completely. */
  stopSession: () => Promise<void>;
  /** Freeze teaching: agent must not talk; student mic is muted. Session stays connected when possible. */
  pauseSession: () => Promise<void>;
  /** Resume after pause. */
  resumeSession: () => Promise<void>;
  /** Mute/unmute student mic only (does not end or pause the session). */
  setMicMuted: (muted: boolean) => void;
  sendText: (text: string, options?: SendTextOptions) => Promise<void>;
}

/** Every provider is a hook with this signature. */
export type VoiceProviderHook = (callbacks: VoiceCallbacks) => VoiceSession;
