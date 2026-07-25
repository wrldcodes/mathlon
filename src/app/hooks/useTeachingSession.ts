'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Message } from '../components/ChatInterface';
import { type CanvasAnnotationSpec, type TeachingCanvasHandle } from '../components/TeachingCanvas';
import { normalizeConstructionSpec } from '../canvas/construction';
import { dedupeKey, sanitizeCanvasText } from '../canvas/sanitize';
import { useDemoMode } from '../hooks/useDemoMode';
import { useVoice, type CanvasToolCall } from '../voice/useVoice';
import { isConnectionAborted } from '../voice/connectionErrors';
import { SessionRecorder } from '../monitoring/sessionRecorder';
import { updateTeachingSession } from '../lib/sessionsApi';
import {
  queryMicAccessState,
  requestMicAccess,
  type MicAccessState,
} from '../voice/micAccess';
import type { SessionPreparePhase } from '../components/SessionPreparingScreen';

export type SessionBootstrap = {
  content: string;
  title: string;
  phase: SessionPreparePhase;
  errorMessage?: string;
  /** Compact board inventory when rejoining a session with saved canvas state. */
  resumeBoardSummary?: string;
};

const CANVAS_PERSIST_DEBOUNCE_MS = 700;

/** Snapshot after React paints the canvas mutation (avoids one-step-behind logs). */
function snapshotAfterPaint(
  recorder: SessionRecorder,
  canvasRef: RefObject<TeachingCanvasHandle | null>,
  onReady?: () => void,
) {
  if (typeof requestAnimationFrame === 'undefined') {
    recorder.snapshotCanvas(canvasRef.current);
    onReady?.();
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      recorder.snapshotCanvas(canvasRef.current);
      onReady?.();
    });
  });
}

export function useTeachingSession(
  canvasRef: RefObject<TeachingCanvasHandle | null>,
  options?: { sessionId?: string; demoExpiresAt?: string | null },
) {
  const sessionId = options?.sessionId;
  const demoExpiresAt = options?.demoExpiresAt ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTeaching, setIsTeaching] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string | null>(null);
  const [sessionBootstrap, setSessionBootstrap] = useState<SessionBootstrap | null>(null);
  const [micAccessState, setMicAccessState] = useState<MicAccessState>('unknown');
  const sessionStartedRef = useRef(false);
  const launchInFlightRef = useRef(false);
  const recorderRef = useRef<SessionRecorder | null>(null);
  if (!recorderRef.current) recorderRef.current = new SessionRecorder();
  const recorder = recorderRef.current;
  const entryModeRef = useRef<'text-first' | 'mic-first'>('mic-first');
  const providerRef = useRef<string>(
    (process.env.NEXT_PUBLIC_VOICE_PROVIDER as string | undefined) ?? 'unknown',
  );
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Normalized text of the most recent writes, to reject duplicate re-writes. */
  const recentWriteKeysRef = useRef<string[]>([]);

  const persistCanvasNow = useCallback(() => {
    if (!sessionId || !canvasRef.current) return;
    try {
      const canvasState = canvasRef.current.getSnapshot();
      void updateTeachingSession(sessionId, { canvasState }).catch(() => {
        /* non-blocking */
      });
    } catch {
      /* ignore snapshot failures */
    }
  }, [canvasRef, sessionId]);

  const scheduleCanvasPersist = useCallback(() => {
    if (!sessionId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistCanvasNow();
    }, CANVAS_PERSIST_DEBOUNCE_MS);
  }, [persistCanvasNow, sessionId]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const handleToolCall = useCallback(
    (toolCall: CanvasToolCall) => {
      const canvas = canvasRef.current;
      if (!canvas) return { result: { ok: false, reason: 'canvas_not_ready' } };

      const withBoard = <T extends Record<string, unknown>>(result: T) => ({
        ...result,
        board: canvas.getBoardSummary(),
      });

      switch (toolCall.name) {
        case 'canvas_get_board': {
          const board = canvas.getBoardSummary();
          const result = { ok: true, board };
          recorder.push({
            type: 'tool_call',
            name: 'canvas_get_board',
            args: toolCall.arguments,
            result,
          });
          return { result };
        }
        case 'canvas_write_text': {
          const text = sanitizeCanvasText(String(toolCall.arguments.text ?? '').trim());
          if (!text) {
            const result = { ok: false, reason: 'empty_text' };
            recorder.push({
              type: 'tool_call',
              name: 'canvas_write_text',
              args: toolCall.arguments,
              result,
            });
            return { result };
          }
          const key = dedupeKey(text);
          if (recentWriteKeysRef.current.includes(key)) {
            const result = withBoard({ ok: false, reason: 'duplicate_text' });
            recorder.push({
              type: 'tool_call',
              name: 'canvas_write_text',
              args: toolCall.arguments,
              result,
            });
            return { result };
          }
          recentWriteKeysRef.current = [key, ...recentWriteKeysRef.current].slice(0, 8);
          const written = canvas.addTextStep(text);
          const result = withBoard({ ok: true, stepIndex: written.stepIndex });
          recorder.push({
            type: 'tool_call',
            name: 'canvas_write_text',
            args: toolCall.arguments,
            result,
          });
          snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        case 'canvas_draw_diagram': {
          const labels =
            toolCall.arguments.labels && typeof toolCall.arguments.labels === 'object'
              ? (toolCall.arguments.labels as Record<string, string>)
              : undefined;
          const diagramId = String(toolCall.arguments.diagramId ?? toolCall.arguments.type ?? '').trim();
          const title = String(toolCall.arguments.title ?? toolCall.arguments.label ?? '').trim();
          const variant = String(toolCall.arguments.variant ?? '').trim();
          if (!diagramId) {
            const result = { ok: false, reason: 'missing_diagram_id' };
            recorder.push({
              type: 'tool_call',
              name: 'canvas_draw_diagram',
              args: toolCall.arguments,
              result,
            });
            return { result };
          }
          const drawn = canvas.addDiagramStep({
            diagramId,
            title: title || undefined,
            labels,
            variant: variant || undefined,
          });
          const result = withBoard({
            ok: true,
            stepIndex: drawn.stepIndex,
            diagramId: drawn.diagramId ?? diagramId,
          });
          recorder.push({
            type: 'tool_call',
            name: 'canvas_draw_diagram',
            args: toolCall.arguments,
            result,
          });
          snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        case 'canvas_draw_construction': {
          const title = String(toolCall.arguments.title ?? '').trim();
          let stepsArg: unknown = toolCall.arguments.steps;
          if (typeof stepsArg === 'string') {
            try {
              stepsArg = JSON.parse(stepsArg);
            } catch {
              /* keep */
            }
          }
          const payload =
            stepsArg != null
              ? { title: title || undefined, steps: stepsArg }
              : toolCall.arguments.construction ?? toolCall.arguments;
          const spec = normalizeConstructionSpec(payload);
          if (!spec) {
            const result = { ok: false, reason: 'invalid_construction' };
            recorder.push({
              type: 'tool_call',
              name: 'canvas_draw_construction',
              args: toolCall.arguments,
              result,
            });
            return { result };
          }
          const drawn = canvas.addConstructionStep(spec, title || spec.title);
          const result = drawn.ok
            ? withBoard({ ok: true, stepIndex: drawn.stepIndex, steps: spec.steps.length })
            : { ok: false, reason: drawn.reason ?? 'invalid_construction' };
          recorder.push({
            type: 'tool_call',
            name: 'canvas_draw_construction',
            args: toolCall.arguments,
            result,
          });
          if (drawn.ok) snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        case 'canvas_annotate': {
          const kindRaw = String(toolCall.arguments.kind ?? 'text_match').trim();
          const styleArg = String(toolCall.arguments.style ?? 'box').trim();
          const label = String(toolCall.arguments.label ?? '').trim();
          const targetStepIndex =
            toolCall.arguments.targetStepIndex == null
              ? undefined
              : Number(toolCall.arguments.targetStepIndex);
          const style =
            styleArg === 'circle' ? 'circle' : styleArg === 'underline' ? 'underline' : 'box';

          // If the agent passes row+column, treat as grid_cell even when kind is wrong/missing.
          const hasRowCol =
            toolCall.arguments.row != null &&
            toolCall.arguments.column != null &&
            Number.isFinite(Number(toolCall.arguments.row)) &&
            Number.isFinite(Number(toolCall.arguments.column));

          let annotation: CanvasAnnotationSpec;
          if (kindRaw === 'grid_cell' || kindRaw === 'matrix_cell' || (hasRowCol && kindRaw !== 'text_match' && kindRaw !== 'step')) {
            annotation = {
              kind: 'grid_cell',
              gridLabel:
                String(
                  toolCall.arguments.gridLabel ?? toolCall.arguments.matrixLabel ?? '',
                ).trim() || undefined,
              row: Number(toolCall.arguments.row),
              column: Number(toolCall.arguments.column),
              style: style === 'underline' ? 'box' : style,
              label: label || undefined,
              targetStepIndex: Number.isFinite(targetStepIndex) ? targetStepIndex : undefined,
            };
          } else if (kindRaw === 'step') {
            annotation = {
              kind: 'step',
              style: style === 'underline' ? 'box' : style,
              label: label || undefined,
              targetStepIndex: Number.isFinite(targetStepIndex) ? targetStepIndex : undefined,
            };
          } else if (hasRowCol && (kindRaw === 'text_match' || !kindRaw)) {
            annotation = {
              kind: 'grid_cell',
              gridLabel:
                String(
                  toolCall.arguments.gridLabel ?? toolCall.arguments.matrixLabel ?? '',
                ).trim() || undefined,
              row: Number(toolCall.arguments.row),
              column: Number(toolCall.arguments.column),
              style: style === 'underline' ? 'box' : style,
              label: label || undefined,
              targetStepIndex: Number.isFinite(targetStepIndex) ? targetStepIndex : undefined,
            };
          } else {
            annotation = {
              kind: 'text_match',
              match: String(
                toolCall.arguments.match ?? toolCall.arguments.text ?? toolCall.arguments.phrase ?? '',
              ).trim(),
              occurrence:
                toolCall.arguments.occurrence == null
                  ? undefined
                  : Number(toolCall.arguments.occurrence),
              style,
              label: label || undefined,
              targetStepIndex: Number.isFinite(targetStepIndex) ? targetStepIndex : undefined,
            };
          }

          const annotated = canvas.addAnnotation(annotation);
          const result = annotated.ok ? withBoard({ ...annotated }) : annotated;
          recorder.push({
            type: 'tool_call',
            name: 'canvas_annotate',
            args: toolCall.arguments,
            result,
          });
          snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        case 'canvas_navigate_to_step': {
          const stepIndex = Number(toolCall.arguments.stepIndex ?? 0);
          const navigated = canvas.navigateToStep(stepIndex);
          const result = withBoard({ ok: true, stepIndex: navigated.stepIndex });
          recorder.push({
            type: 'tool_call',
            name: 'canvas_navigate_to_step',
            args: toolCall.arguments,
            result,
          });
          scheduleCanvasPersist();
          return { result };
        }
        case 'canvas_replace_step': {
          const stepIndex = Number(toolCall.arguments.stepIndex);
          const text = sanitizeCanvasText(String(toolCall.arguments.text ?? '').trim());
          const replaced = canvas.replaceTextStep(stepIndex, text);
          if (replaced.ok) recentWriteKeysRef.current = [];
          const result = replaced.ok ? withBoard({ ...replaced }) : replaced;
          recorder.push({
            type: 'tool_call',
            name: 'canvas_replace_step',
            args: toolCall.arguments,
            result,
          });
          if (replaced.ok) snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        case 'canvas_delete_step': {
          const stepIndex = Number(toolCall.arguments.stepIndex);
          const deleted = canvas.deleteStep(stepIndex);
          if (deleted.ok) recentWriteKeysRef.current = [];
          const result = deleted.ok ? withBoard({ ...deleted }) : deleted;
          recorder.push({
            type: 'tool_call',
            name: 'canvas_delete_step',
            args: toolCall.arguments,
            result,
          });
          if (deleted.ok) snapshotAfterPaint(recorder, canvasRef, scheduleCanvasPersist);
          return { result };
        }
        default:
          recorder.push({
            type: 'tool_call',
            name: toolCall.name,
            args: toolCall.arguments,
            result: { ok: false, reason: 'unknown_tool' },
          });
          return { result: { ok: false, reason: 'unknown_tool' } };
      }
    },
    [canvasRef, recorder, scheduleCanvasPersist],
  );

  const {
    isSessionActive,
    isPaused,
    isMicMuted,
    isConnecting,
    statusText,
    isConfigured,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted,
    sendText,
  } = useVoice({
      onUserTranscript: useCallback((text: string) => {
        recorder.push({ type: 'user_message', text });
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() },
        ]);
      }, []),
      onAssistantMessage: useCallback((text: string) => {
        recorder.push({ type: 'assistant_message', text });
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: text,
            timestamp: new Date(),
          },
        ]);
      }, []),
      onTeachingStateChange: setIsTeaching,
      onToolCall: handleToolCall,
      onStatusChange: useCallback((text: string) => {
        recorder.push({ type: 'status', text });
      }, []),
      onError: useCallback((err: unknown) => {
        recorder.push({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      }, []),
      onSessionMeta: useCallback(
        (meta: { provider: string; conversationId: string }) => {
          providerRef.current = meta.provider;
          recorder.setConversationId(meta.conversationId);
          if (sessionId) {
            void updateTeachingSession(sessionId, {
              providerConversationId: meta.conversationId,
            }).catch(() => {
              /* non-blocking */
            });
          }
        },
        [sessionId],
      ),
    });

  const demo = useDemoMode(useCallback(() => void stopSession(), [stopSession]), demoExpiresAt);

  useEffect(() => {
    return () => {
      recorder.end('unmount');
      void stopSession();
    };
  }, [stopSession]);

  const cancelSessionBootstrap = useCallback(() => {
    setSessionBootstrap(null);
    launchInFlightRef.current = false;
    sessionStartedRef.current = false;
    setCurrentSessionTitle(null);
    recorder.end('cancel_bootstrap');
    void stopSession();
  }, [stopSession]);

  const continueSessionLaunch = useCallback(
    async (payload: SessionBootstrap) => {
      if (launchInFlightRef.current) return;
      launchInFlightRef.current = true;
      setSessionBootstrap({ ...payload, phase: 'connecting', errorMessage: undefined });

      const mic = await requestMicAccess();
      if (!mic.ok) {
        setMicAccessState(mic.state);
        setSessionBootstrap({
          ...payload,
          phase: 'error',
          errorMessage:
            mic.state === 'denied'
              ? 'Microphone access is blocked in your browser settings.'
              : 'Microphone access is required for voice tutoring.',
        });
        launchInFlightRef.current = false;
        return;
      }

      setMicAccessState('granted');
      sessionStartedRef.current = true;
      setCurrentSessionTitle(payload.title);
      entryModeRef.current = payload.content.trim() ? 'text-first' : 'mic-first';
      recorder.start(entryModeRef.current, providerRef.current);
      recorder.snapshotCanvas(canvasRef.current);

      try {
        if (payload.content.trim()) {
          await sendText(payload.content, { textFirstLaunch: true });
        } else {
          await startSession(
            payload.resumeBoardSummary
              ? { resumeBoardSummary: payload.resumeBoardSummary }
              : undefined,
          );
        }
      } catch (err) {
        if (isConnectionAborted(err)) {
          launchInFlightRef.current = false;
          return;
        }
        setSessionBootstrap({
          ...payload,
          phase: 'error',
          errorMessage: err instanceof Error ? err.message : 'Could not connect to your tutor.',
        });
        sessionStartedRef.current = false;
        setCurrentSessionTitle(null);
        launchInFlightRef.current = false;
        recorder.end('connect_error');
        return;
      }

      launchInFlightRef.current = false;
    },
    [sendText, startSession],
  );

  const beginSessionLaunch = useCallback(
    async (
      content: string,
      title: string,
      options?: { resumeBoardSummary?: string },
    ) => {
      if (sessionBootstrap || launchInFlightRef.current) return;
      const payload: SessionBootstrap = {
        content,
        title,
        phase: 'permission',
        resumeBoardSummary: options?.resumeBoardSummary,
      };
      setCurrentSessionTitle(title);
      setSessionBootstrap(payload);
      const micState = await queryMicAccessState();
      setMicAccessState(micState);
      if (micState === 'granted') {
        await continueSessionLaunch(payload);
      }
    },
    [continueSessionLaunch, sessionBootstrap],
  );

  const handleAllowMic = useCallback(async () => {
    if (!sessionBootstrap) return;
    const mic = await requestMicAccess();
    setMicAccessState(mic.state);
    if (!mic.ok) {
      setSessionBootstrap({
        ...sessionBootstrap,
        phase: 'error',
        errorMessage:
          mic.state === 'denied'
            ? 'Microphone access is blocked in your browser settings.'
            : 'Microphone access is required for voice tutoring.',
      });
      return;
    }
    await continueSessionLaunch(sessionBootstrap);
  }, [continueSessionLaunch, sessionBootstrap]);

  useEffect(() => {
    if (!isSessionActive || !sessionBootstrap) return;
    if (sessionBootstrap.content.trim()) {
      setMessages((prev) => {
        if (prev.some((m) => m.content === sessionBootstrap.content)) return prev;
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'user',
            content: sessionBootstrap.content,
            timestamp: new Date(),
          },
        ];
      });
    }
    setSessionBootstrap(null);
    launchInFlightRef.current = false;
  }, [isSessionActive, sessionBootstrap]);

  const handleTextSubmit = useCallback(
    async (content: string) => {
      recorder.push({ type: 'user_message', text: content });
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content, timestamp: new Date() },
      ]);
      await sendText(content);
    },
    [recorder, sendText],
  );

  const resetSession = useCallback(async () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistCanvasNow();
    recentWriteKeysRef.current = [];
    await stopSession();
    recorder.end('reset');
    setIsTeaching(false);
    setMessages([]);
    setOverlayDismissed(false);
    setCurrentSessionTitle(null);
    setSessionBootstrap(null);
    launchInFlightRef.current = false;
    sessionStartedRef.current = false;
  }, [persistCanvasNow, recorder, stopSession]);

  const vapiControls = {
    isSessionActive,
    isPaused,
    isMicMuted,
    isConnecting,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted,
    statusText,
    isConfigured,
    hideConnectionStatus: true,
  };

  return {
    messages,
    isTeaching,
    overlayDismissed,
    setOverlayDismissed,
    currentSessionTitle,
    sessionBootstrap,
    micAccessState,
    isSessionActive,
    isConnecting,
    demo,
    beginSessionLaunch,
    handleAllowMic,
    cancelSessionBootstrap,
    handleTextSubmit,
    resetSession,
    vapiControls,
    exportSessionLog: () => {
      recorder.end('export');
      recorder.export();
    },
    persistCanvasNow,
  };
}
