'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Vapi from '@vapi-ai/web';
import type { VoiceCallbacks, VoiceSession } from '../voice/types';

// Re-export so any legacy importers keep working; the canonical definition now
// lives in the provider-agnostic port at ../voice/types.
export type { CanvasToolCall } from '../voice/types';

// Vapi sends tool-call items in multiple shapes depending on model/SDK version.
// We handle all known variants defensively.
type VapiToolCallItem = {
  id?: string;
  type?: string;
  // Client-side SDK format (most common in @vapi-ai/web)
  functionName?: string;
  parameters?: Record<string, unknown>;
  // Server-event / Anthropic format
  name?: string;
  arguments?: Record<string, unknown> | string;
  // OpenAI-compatible format
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

type VapiMessage = {
  type?: string;
  role?: string;
  transcript?: string;
  text?: string;
  final?: boolean;
  toolCallList?: VapiToolCallItem[];
  // Older single-call format
  functionCall?: {
    id?: string;
    name?: string;
    functionName?: string;
    parameters?: Record<string, unknown>;
    arguments?: Record<string, unknown>;
  };
};

// The Vapi adapter implements the shared VoiceProvider port. Vapi is one-way
// on tool calls, so any ToolResult returned by onToolCall is simply ignored
// here (see ../voice/types) — providers that support two-way tools will use it.
export function useVapiVoice({
  onUserTranscript,
  onAssistantMessage,
  onTeachingStateChange,
  onToolCall,
}: VoiceCallbacks): VoiceSession {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isSessionActiveRef = useRef(false);
  const submittedTranscriptsRef = useRef(new Set<string>());

  const vapi = useMemo(() => {
    if (!publicKey) return null;
    return new Vapi(publicKey);
  }, [publicKey]);

  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setIsConnecting(false);
      setIsSessionActive(true);
      setStatusText('Session active — speak anytime');
    };
    const onCallEnd = () => {
      setIsConnecting(false);
      setIsSessionActive(false);
      setStatusText('');
      onTeachingStateChange?.(false);
      submittedTranscriptsRef.current.clear();
    };
    const onSpeechStart = () => onTeachingStateChange?.(true);
    const onSpeechEnd = () => onTeachingStateChange?.(false);

    const onError = (err: unknown) => {
      console.error('[Vapi error]', err);
      setStatusText('Voice error — check mic permissions and Vapi keys.');
    };

    const onMessage = (message: VapiMessage) => {
      if (!message) return;
      console.debug('[Vapi message]', message.type, message);

      // ── tool-calls ───────────────────────────────────────────────────────
      // Client-side tools are one-way — no result sent back to the model.
      if (message.type === 'tool-calls') {
        const list = message.toolCallList ?? [];
        for (const call of list) {
          const toolName =
            call.functionName ??         // @vapi-ai/web client format
            call.name ??                 // server-event / Anthropic format
            call.function?.name ??       // OpenAI format
            '';

          // Arguments may be an object or a JSON string — normalise to object
          let args: Record<string, unknown> = {};
          const rawArgs = call.parameters ?? call.arguments ?? call.function?.arguments;
          if (rawArgs) {
            if (typeof rawArgs === 'string') {
              try { args = JSON.parse(rawArgs); } catch { /* skip */ }
            } else {
              args = rawArgs as Record<string, unknown>;
            }
          }

          if (toolName) {
            console.log('[Vapi tool-call]', toolName, args);
            onToolCall?.({ name: toolName, arguments: args });
          }
        }
        return;
      }

      // ── function-call (older single-call format) ─────────────────────────
      if (message.type === 'function-call' && message.functionCall) {
        const fc = message.functionCall;
        const toolName = fc.functionName ?? fc.name ?? '';
        const args = fc.parameters ?? fc.arguments ?? {};
        if (toolName) {
          console.log('[Vapi function-call]', toolName, args);
          onToolCall?.({ name: toolName, arguments: args as Record<string, unknown> });
        }
        return;
      }

      if (message.type !== 'transcript') return;
      const content = (message.transcript || message.text || '').trim();
      if (!content || message.final === false) return;

      if (message.role === 'user') {
        if (submittedTranscriptsRef.current.has(content)) return;
        submittedTranscriptsRef.current.add(content);
        onUserTranscript(content);
      }

      if (message.role === 'assistant') {
        onAssistantMessage?.(content);
      }
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('message', onMessage);
    vapi.on('error', onError);

    return () => {
      vapi.off('call-start', onCallStart);
      vapi.off('call-end', onCallEnd);
      vapi.off('speech-start', onSpeechStart);
      vapi.off('speech-end', onSpeechEnd);
      vapi.off('message', onMessage);
      vapi.off('error', onError);
    };
  }, [onUserTranscript, onAssistantMessage, onTeachingStateChange, onToolCall, vapi]);

  /**
   * Overrides passed to every vapi.start() call.
   * clientMessages subscribes the browser to tool-call and transcript events.
   * Tools are defined in the Vapi dashboard (no server URL = client-side).
   * We do NOT override model here — partial model overrides cause a 400.
   */
  const buildOverrides = (extraOverrides?: Record<string, unknown>) => ({
    clientMessages: [
      'tool-calls',
      'transcript',
      'speech-update',
    ],
    ...extraOverrides,
  });

  /** Start a Vapi session (idempotent — no-ops if already active). */
  const startSession = useCallback(async (_options?: import('../voice/types').StartSessionOptions) => {
    if (!vapi || !assistantId) {
      setStatusText('Missing Vapi env vars — check .env.local');
      return;
    }
    if (isSessionActiveRef.current) return;
    try {
      setIsConnecting(true);
      setStatusText('Connecting to Mathlon…');
      await vapi.start(assistantId, buildOverrides() as never);
    } catch (err) {
      console.error('[Vapi] start failed', err);
      setIsConnecting(false);
      setStatusText('Could not start voice session');
    }
  }, [assistantId, vapi]); // eslint-disable-line react-hooks/exhaustive-deps

  /** End the current session. */
  const stopSession = useCallback(async () => {
    if (!vapi) return;
    setIsPaused(false);
    setIsMicMuted(false);
    try {
      await vapi.stop();
    } catch (err) {
      console.error('[Vapi] stop failed', err);
    }
  }, [vapi]);

  /**
   * Inject a text message into the active session so the assistant responds.
   * Starts a session automatically if one is not already running.
   * When starting a new session for text mode, the firstMessage is suppressed
   * so the assistant immediately responds to the injected message instead of
   * greeting first.
   */
  const sendText = useCallback(async (text: string) => {
    if (!vapi || !assistantId) {
      setStatusText('Missing Vapi env vars — check .env.local');
      return;
    }
    if (!isSessionActiveRef.current) {
      try {
        setIsConnecting(true);
        setStatusText('Connecting to Mathlon…');
        await vapi.start(assistantId, buildOverrides({ firstMessage: '' }) as never);
      } catch {
        setIsConnecting(false);
        setStatusText('Could not start voice session');
        return;
      }
      // Wait for session to be fully established
      await new Promise((r) => setTimeout(r, 700));
    }
    try {
      vapi.send({
        type: 'add-message',
        message: { role: 'user', content: text },
      });
    } catch (err) {
      console.error('[Vapi] send failed', err);
      setStatusText('Could not send message to assistant');
    }
  }, [assistantId, vapi]);

  const pauseSession = useCallback(async () => {
    if (!isSessionActiveRef.current || isPaused) return;
    setIsPaused(true);
    // Vapi has no true pause — mute is best-effort; keep session for resume UX.
    try {
      (vapi as { setMuted?: (m: boolean) => void } | null)?.setMuted?.(true);
    } catch {
      /* ignore */
    }
    setStatusText('Session paused — nothing is listening or speaking');
  }, [isPaused, vapi]);

  const resumeSession = useCallback(async () => {
    if (!isSessionActiveRef.current || !isPaused) return;
    setIsPaused(false);
    try {
      (vapi as { setMuted?: (m: boolean) => void } | null)?.setMuted?.(isMicMuted);
    } catch {
      /* ignore */
    }
    setStatusText('Session active — speak anytime');
  }, [isPaused, isMicMuted, vapi]);

  const setMicMuted = useCallback(
    (muted: boolean) => {
      setIsMicMuted(muted);
      if (isPaused) return;
      try {
        (vapi as { setMuted?: (m: boolean) => void } | null)?.setMuted?.(muted);
      } catch {
        /* ignore */
      }
    },
    [isPaused, vapi],
  );

  return {
    isSessionActive,
    isPaused: isSessionActive && isPaused,
    isMicMuted,
    isConnecting,
    statusText,
    isConfigured: Boolean(publicKey && assistantId),
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted,
    sendText,
  };
}
