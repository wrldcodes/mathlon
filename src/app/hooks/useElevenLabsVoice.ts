'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useConversation,
  useRawConversation,
  type ConversationStatus,
} from '@elevenlabs/react';
import type { SendTextOptions, StartSessionOptions, VoiceCallbacks, VoiceSession } from '../voice/types';
import {
  buildElevenLabsClientTools,
  ELEVENLABS_RESUME_BRIDGE_MESSAGE,
  ELEVENLABS_TEXT_FIRST_BRIDGE_MESSAGE,
} from '../voice/providers/elevenlabs/tools';
import { requestMicAccess } from '../voice/micAccess';
import { ConnectionAbortedError } from '../voice/connectionErrors';

/** ElevenLabs only pauses speech ~2s per user_activity — keep pinging while paused. */
const PAUSE_HOLD_MS = 1500;

type SessionWait = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  attempt: number;
};

type LaunchContext = {
  studentQuestion: string;
  textFirstLaunch: boolean;
  resumeBoardSummary?: string;
};

export function useElevenLabsVoice(callbacks: VoiceCallbacks): VoiceSession {
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  const [statusText, setStatusText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const submittedTranscriptsRef = useRef(new Set<string>());
  const isPausedRef = useRef(false);
  const isMicMutedRef = useRef(false);

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const clientTools = useMemo(
    () =>
      buildElevenLabsClientTools(() => ({
        ...callbacksRef.current,
        onToolCall: async (toolCall) => {
          if (isPausedRef.current) {
            return { result: { ok: false, reason: 'session_paused' } };
          }
          return callbacksRef.current.onToolCall?.(toolCall);
        },
      })),
    [],
  );

  const statusRef = useRef<ConversationStatus | 'disconnecting'>('disconnected');
  const pendingSessionRef = useRef<SessionWait | null>(null);
  const connectAttemptRef = useRef(0);
  const launchContextRef = useRef<LaunchContext>({ studentQuestion: '', textFirstLaunch: false });
  const bridgeGateRef = useRef<{ heardSpeaking: boolean; resolve: () => void } | null>(null);
  const isSessionActiveRef = useRef(false);
  const pauseHoldTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPendingSession = useCallback((rejectWith?: Error) => {
    const pending = pendingSessionRef.current;
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingSessionRef.current = null;
    if (rejectWith) pending.reject(rejectWith);
  }, []);

  const resolveSessionReady = useCallback(() => {
    const pending = pendingSessionRef.current;
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingSessionRef.current = null;
    pending.resolve();
  }, []);

  const rejectSessionReady = useCallback(
    (message: unknown) => {
      const error = message instanceof Error ? message : new Error(String(message));
      clearPendingSession(error);
    },
    [clearPendingSession],
  );

  const abortPendingConnection = useCallback(() => {
    connectAttemptRef.current += 1;
    clearPendingSession(new ConnectionAbortedError());
  }, [clearPendingSession]);

  const waitForSessionReady = useCallback((timeoutMs = 20000) => {
    if (statusRef.current === 'connected') return Promise.resolve();
    const attempt = connectAttemptRef.current;
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (connectAttemptRef.current !== attempt) return;
        pendingSessionRef.current = null;
        reject(new Error('ElevenLabs connection timeout'));
      }, timeoutMs);
      pendingSessionRef.current = {
        attempt,
        timeout,
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
      if (statusRef.current === 'connected') {
        clearTimeout(timeout);
        pendingSessionRef.current = null;
        resolve();
      }
    });
  }, []);

  const conversation = useConversation({
    clientTools,
    micMuted: isPaused || isMicMuted,
    volume: isPaused ? 0 : 1,
    onStatusChange: ({ status }) => {
      statusRef.current = status;
      if (status === 'disconnecting') return;

      if (status === 'connected' && isPausedRef.current) {
        const text = 'Session paused — nothing is listening or speaking';
        setStatusText(text);
        callbacksRef.current.onStatusChange?.(text);
      } else {
        const text =
          status === 'connecting'
            ? 'Connecting to Mathlon…'
            : status === 'connected'
              ? 'Session active — speak anytime'
              : '';
        setStatusText(text);
        callbacksRef.current.onStatusChange?.(text);
      }

      if (status === 'connected') resolveSessionReady();
      if (status === 'disconnected') {
        isMicMutedRef.current = false;
        setIsMicMuted(false);
      }
    },
    onDisconnect: () => {
      callbacksRef.current.onTeachingStateChange?.(false);
      submittedTranscriptsRef.current.clear();
    },
    onModeChange: ({ mode }) => {
      if (isPausedRef.current) {
        callbacksRef.current.onTeachingStateChange?.(false);
        return;
      }
      callbacksRef.current.onTeachingStateChange?.(mode === 'speaking');

      const gate = bridgeGateRef.current;
      if (!gate) return;
      if (mode === 'speaking') gate.heardSpeaking = true;
      if (gate.heardSpeaking && mode === 'listening') {
        bridgeGateRef.current = null;
        window.setTimeout(() => gate.resolve(), 1000);
      }
    },
    onMessage: ({ message, source }) => {
      if (isPausedRef.current) return;
      const text = message.trim();
      if (!text) return;
      if (source === 'user') {
        if (submittedTranscriptsRef.current.has(text)) return;
        submittedTranscriptsRef.current.add(text);
        callbacksRef.current.onUserTranscript(text);
      } else {
        callbacksRef.current.onAssistantMessage?.(text);
      }
    },
    onError: (message, context) => {
      console.error('[ElevenLabs error]', message, context);
      rejectSessionReady(message);
      callbacksRef.current.onError?.(message);
      const errorText =
        typeof message === 'string' ? message : 'Voice error — check mic permissions and the agent ID.';
      setStatusText(errorText);
      callbacksRef.current.onStatusChange?.(errorText);
    },
  });

  const {
    status,
    startSession: startConversation,
    endSession,
    sendUserMessage,
    sendUserActivity,
    sendContextualUpdate,
    setMuted,
    setVolume,
  } = conversation;

  // Active conversation instance (null when disconnected) — used to force-stop local playback.
  const rawConversation = useRawConversation();

  const clearPauseHold = useCallback(() => {
    if (pauseHoldTimerRef.current != null) {
      clearInterval(pauseHoldTimerRef.current);
      pauseHoldTimerRef.current = null;
    }
  }, []);

  const startPauseHold = useCallback(() => {
    clearPauseHold();
    // Keep telling the agent the user is "active" so it stops / stays silent (~2s per ping).
    try {
      sendUserActivity();
    } catch {
      /* no active session yet */
    }
    pauseHoldTimerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        clearPauseHold();
        return;
      }
      try {
        sendUserActivity();
      } catch {
        /* ignore */
      }
      try {
        setVolume({ volume: 0 });
      } catch {
        /* ignore */
      }
    }, PAUSE_HOLD_MS);
  }, [clearPauseHold, sendUserActivity, setVolume]);

  useEffect(() => {
    return () => clearPauseHold();
  }, [clearPauseHold]);

  useEffect(() => {
    statusRef.current = status;
    isSessionActiveRef.current = status === 'connected' || status === 'connecting';
    if (status === 'disconnected') {
      clearPauseHold();
    }
  }, [status, clearPauseHold]);

  const buildSessionOptions = useCallback(() => {
    const launch = launchContextRef.current;
    const options: {
      agentId: string;
      dynamicVariables: Record<string, string>;
      overrides?: { agent: { firstMessage: string } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onConnect: (payload: any) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onConversationCreated: (conversation: any) => void;
      onError: (message: string) => void;
    } = {
      agentId: agentId!,
      dynamicVariables: {
        user_name: (() => {
          try {
            if (typeof window !== 'undefined') {
              const stored = window.localStorage.getItem('mathlon.displayName')?.trim();
              if (stored) return stored;
            }
          } catch {
            // ignore
          }
          return process.env.NEXT_PUBLIC_USER_NAME?.trim() || 'there';
        })(),
        teaching_pace: 'normal',
        student_question: launch.studentQuestion,
      },
      onConnect: ({ conversationId }: { conversationId?: string }) => {
        console.info('[ElevenLabs] Session connected. Conversation ID:', conversationId);
        if (conversationId) {
          callbacksRef.current.onSessionMeta?.({ provider: 'elevenlabs', conversationId });
        }
        resolveSessionReady();
      },
      onConversationCreated: (conversation) => {
        const conversationId =
          (conversation as { conversationId?: string } | null | undefined)?.conversationId;
        if (conversationId) {
          console.info('[ElevenLabs] Conversation created. Conversation ID:', conversationId);
          callbacksRef.current.onSessionMeta?.({ provider: 'elevenlabs', conversationId });
        } else {
          console.info('[ElevenLabs] Conversation created.');
        }
        resolveSessionReady();
      },
      onError: (message: string) => {
        rejectSessionReady(message);
        setStatusText(message || 'Could not start voice session.');
      },
    };

    if (launch.textFirstLaunch) {
      options.overrides = { agent: { firstMessage: ELEVENLABS_TEXT_FIRST_BRIDGE_MESSAGE } };
    } else if (launch.resumeBoardSummary) {
      options.overrides = { agent: { firstMessage: ELEVENLABS_RESUME_BRIDGE_MESSAGE } };
    }

    return options;
  }, [agentId, rejectSessionReady, resolveSessionReady]);

  const waitForBridgeMessage = useCallback((timeoutMs = 16000) => {
    return new Promise<void>((resolve) => {
      const finish = () => {
        bridgeGateRef.current = null;
        resolve();
      };
      const timeout = window.setTimeout(finish, timeoutMs);
      const noSpeechFallback = window.setTimeout(() => {
        const gate = bridgeGateRef.current;
        if (gate && !gate.heardSpeaking) {
          window.clearTimeout(timeout);
          finish();
        }
      }, 3500);
      bridgeGateRef.current = {
        heardSpeaking: false,
        resolve: () => {
          window.clearTimeout(timeout);
          window.clearTimeout(noSpeechFallback);
          finish();
        },
      };
    });
  }, []);

  const ensureMicThenConnect = useCallback(
    async (launch: LaunchContext) => {
      const mic = await requestMicAccess();
      if (!mic.ok) {
        throw new Error(
          mic.state === 'denied'
            ? 'Microphone access is blocked in your browser settings.'
            : 'Microphone access is required for voice tutoring.',
        );
      }
      launchContextRef.current = launch;
      isPausedRef.current = false;
      setIsPaused(false);
      isMicMutedRef.current = false;
      setIsMicMuted(false);
      const readyPromise = waitForSessionReady();
      startConversation(buildSessionOptions());
      await readyPromise;
      try {
        setVolume({ volume: 1 });
        setMuted(false);
      } catch {
        /* settling */
      }
    },
    [buildSessionOptions, setMuted, setVolume, startConversation, waitForSessionReady],
  );

  const pauseSession = useCallback(async () => {
    if (statusRef.current !== 'connected' || isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
    callbacksRef.current.onTeachingStateChange?.(false);

    // 1) Cut what the student hears immediately
    try {
      setVolume({ volume: 0 });
    } catch (err) {
      console.warn('[ElevenLabs] setVolume on pause failed', err);
    }
    // 2) Stop listening so the agent does not treat silence/noise as a turn
    try {
      setMuted(true);
    } catch (err) {
      console.warn('[ElevenLabs] setMuted on pause failed', err);
    }
    // 3) Ask the agent to stop speaking (user_activity holds speech ~2s each)
    //    and keep holding for the whole pause so it does not continue "silently"
    startPauseHold();

    // 4) Best-effort: force local output interrupt if the runtime exposes it
    try {
      const conv = rawConversation as
        | { output?: { interrupt?: (ms?: number) => void }; setVolume?: (o: { volume: number }) => void }
        | null;
      conv?.output?.interrupt?.(0);
      conv?.setVolume?.({ volume: 0 });
    } catch {
      /* not all conversation types expose output */
    }

    // 5) Silent context for the model (does not speak a reply)
    try {
      sendContextualUpdate(
        'The student paused the tutoring session. Stop speaking and stop advancing the lesson. Wait until they resume. Do not continue teaching while paused.',
      );
    } catch {
      /* ignore */
    }

    const text = 'Session paused — nothing is listening or speaking';
    setStatusText(text);
    callbacksRef.current.onStatusChange?.(text);
  }, [rawConversation, sendContextualUpdate, setMuted, setVolume, startPauseHold]);

  const resumeSession = useCallback(async () => {
    if (statusRef.current !== 'connected' || !isPausedRef.current) return;

    clearPauseHold();
    isPausedRef.current = false;
    setIsPaused(false);

    try {
      setVolume({ volume: 1 });
    } catch (err) {
      console.warn('[ElevenLabs] setVolume on resume failed', err);
    }
    try {
      setMuted(isMicMutedRef.current);
    } catch (err) {
      console.warn('[ElevenLabs] setMuted on resume failed', err);
    }

    // Tell the agent to pick up from the board — not from where it silently continued.
    try {
      sendContextualUpdate(
        'The student has resumed. Continue teaching from the current canvas / last idea you wrote on the board. Do not restart the lesson from the beginning. Briefly acknowledge resume and continue the next step.',
      );
    } catch {
      /* ignore */
    }
    try {
      // Triggers a real agent turn so teaching continues from the pause point.
      const resumeCue = 'Please continue from where we left off on the board.';
      submittedTranscriptsRef.current.add(resumeCue);
      sendUserMessage(resumeCue);
    } catch (err) {
      console.warn('[ElevenLabs] resume continue message failed', err);
    }

    const text = 'Session active — speak anytime';
    setStatusText(text);
    callbacksRef.current.onStatusChange?.(text);
  }, [clearPauseHold, sendContextualUpdate, sendUserMessage, setMuted, setVolume]);

  const startSession = useCallback(async (options?: StartSessionOptions) => {
    if (!agentId) {
      setStatusText('Missing ElevenLabs agent — add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to .env.local');
      return;
    }
    if (isSessionActiveRef.current) {
      if (isPausedRef.current) await resumeSession();
      return;
    }
    try {
      const resumeBoardSummary = options?.resumeBoardSummary?.trim() || undefined;
      await ensureMicThenConnect({
        studentQuestion: '',
        textFirstLaunch: false,
        resumeBoardSummary,
      });
      if (resumeBoardSummary) {
        try {
          sendContextualUpdate(
            [
              'The student refreshed and rejoined an existing Mathlon teaching session.',
              'Do NOT give a fresh "what would you like to learn" greeting.',
              'The teaching board already has content. Here is the current board inventory:',
              resumeBoardSummary,
              'Continue from this board. Prefer canvas_annotate / canvas_navigate_to_step / canvas_get_board over rewriting existing steps.',
            ].join('\n'),
          );
        } catch (err) {
          console.warn('[ElevenLabs] resume board context failed', err);
        }
      }
    } catch (err) {
      if (err instanceof ConnectionAbortedError) return;
      console.error('[ElevenLabs] start failed', err);
      callbacksRef.current.onError?.(err);
      setStatusText('Could not start voice session — check mic permissions.');
    }
  }, [agentId, ensureMicThenConnect, resumeSession, sendContextualUpdate]);

  const stopSession = useCallback(async () => {
    abortPendingConnection();
    clearPauseHold();
    isPausedRef.current = false;
    setIsPaused(false);
    isMicMutedRef.current = false;
    setIsMicMuted(false);
    try {
      setVolume({ volume: 1 });
      setMuted(false);
    } catch {
      /* ignore */
    }
    try {
      await endSession();
    } catch (err) {
      console.error('[ElevenLabs] stop failed', err);
    }
    callbacksRef.current.onTeachingStateChange?.(false);
    setStatusText('');
  }, [abortPendingConnection, clearPauseHold, endSession, setMuted, setVolume]);

  const setMicMutedFn = useCallback(
    (muted: boolean) => {
      isMicMutedRef.current = muted;
      setIsMicMuted(muted);
      if (isPausedRef.current) return;
      try {
        setMuted(muted);
      } catch (err) {
        console.warn('[ElevenLabs] setMicMuted failed', err);
      }
    },
    [setMuted],
  );

  const sendText = useCallback(
    async (text: string, options?: SendTextOptions) => {
      if (!agentId) {
        setStatusText('Missing ElevenLabs agent — add NEXT_PUBLIC_ELEVENLABS_AGENT_ID to .env.local');
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      const isNewConnection = statusRef.current !== 'connected';
      const textFirstLaunch = options?.textFirstLaunch ?? (isNewConnection && Boolean(trimmed));

      try {
        if (statusRef.current !== 'connected') {
          if (statusRef.current !== 'connecting') {
            await ensureMicThenConnect({
              studentQuestion: textFirstLaunch ? trimmed : '',
              textFirstLaunch,
            });
          } else {
            await waitForSessionReady();
          }
        }

        if (isPausedRef.current) {
          await resumeSession();
        }

        if (textFirstLaunch) {
          await waitForBridgeMessage();
        }

        submittedTranscriptsRef.current.add(trimmed);
        sendUserMessage(trimmed);
      } catch (err) {
        if (err instanceof ConnectionAbortedError) return;
        console.error('[ElevenLabs] send failed', err);
        callbacksRef.current.onError?.(err);
        setStatusText(err instanceof Error ? err.message : 'Could not send message to assistant');
        throw err;
      }
    },
    [agentId, ensureMicThenConnect, resumeSession, sendUserMessage, waitForBridgeMessage, waitForSessionReady],
  );

  return {
    isSessionActive: status === 'connected',
    isPaused: status === 'connected' && isPaused,
    isMicMuted,
    isConnecting: status === 'connecting',
    statusText,
    isConfigured: Boolean(agentId),
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted: setMicMutedFn,
    sendText,
  };
}
