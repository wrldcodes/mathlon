'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleGenAI,
  Modality,
  type FunctionCall,
  type FunctionResponse,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import type { VoiceCallbacks, VoiceSession } from '../voice/types';
import { GeminiLiveAudio } from '../voice/providers/gemini/audio-session';
import {
  GEMINI_CANVAS_TOOLS,
  GEMINI_SYSTEM_INSTRUCTION,
} from '../voice/providers/gemini/canvas-tools';

const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

/** Gemini Live adapter — direct browser WebSocket with two-way canvas tool results. */
export function useGeminiVoice(callbacks: VoiceCallbacks): VoiceSession {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const model = process.env.NEXT_PUBLIC_GEMINI_LIVE_MODEL ?? DEFAULT_MODEL;

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const audioRef = useRef<GeminiLiveAudio | null>(null);
  const isSessionActiveRef = useRef(false);
  const submittedTranscriptsRef = useRef(new Set<string>());

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  const ai = useMemo(() => {
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
  }, [apiKey]);

  const setStatus = useCallback((text: string) => {
    setStatusText(text);
    callbacksRef.current.onStatusChange?.(text);
  }, []);

  const runToolCalls = useCallback(async (functionCalls: FunctionCall[], session: Session) => {
    if (!functionCalls.length) return;

    const responses: FunctionResponse[] = [];

    for (const call of functionCalls) {
      const name = call.name ?? '';
      const args = (call.args ?? {}) as Record<string, unknown>;
      if (!name) continue;

      console.log('[Gemini tool-call]', name, args);

      let result: unknown = { ok: true };
      let error: string | undefined;

      try {
        const toolResult = await callbacksRef.current.onToolCall?.({ name, arguments: args });
        if (toolResult) {
          result = toolResult.result;
          error = toolResult.error;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'Tool execution failed';
        result = { ok: false };
      }

      responses.push({
        id: call.id,
        name,
        response: error ? { ok: false, error } : { result },
      });
    }

    if (responses.length) {
      session.sendToolResponse({ functionResponses: responses });
    }
  }, []);

  const handleServerMessage = useCallback(
    async (message: LiveServerMessage) => {
      const session = sessionRef.current;
      const content = message.serverContent;

      if (content) {
        if (content.interrupted) {
          audioRef.current?.clearPlayback();
          callbacksRef.current.onTeachingStateChange?.(false);
        }

        const inputTx = content.inputTranscription;
        if (inputTx?.text && inputTx.finished) {
          const text = inputTx.text.trim();
          if (text && !submittedTranscriptsRef.current.has(text)) {
            submittedTranscriptsRef.current.add(text);
            callbacksRef.current.onUserTranscript(text);
          }
        }

        const outputTx = content.outputTranscription;
        if (outputTx?.text && outputTx.finished) {
          callbacksRef.current.onAssistantMessage?.(outputTx.text.trim());
        }

        const parts = content.modelTurn?.parts ?? [];
        let heardAudio = false;
        for (const part of parts) {
          if (part.inlineData?.data) {
            heardAudio = true;
            audioRef.current?.playModelAudio(part.inlineData.data);
          }
        }
        if (heardAudio) callbacksRef.current.onTeachingStateChange?.(true);
        if (content.turnComplete) callbacksRef.current.onTeachingStateChange?.(false);
      }

      if (message.toolCall && session) {
        await runToolCalls(message.toolCall.functionCalls ?? [], session);
      }
    },
    [runToolCalls],
  );

  const teardown = useCallback(async () => {
    audioRef.current?.stop();
    audioRef.current = null;
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    setIsConnecting(false);
    setIsSessionActive(false);
    setStatus('');
    callbacksRef.current.onTeachingStateChange?.(false);
    submittedTranscriptsRef.current.clear();
  }, [setStatus]);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const connectSession = useCallback(async (): Promise<Session | null> => {
    if (!ai) {
      setStatus('Missing Gemini API key — add NEXT_PUBLIC_GEMINI_API_KEY to .env.local');
      return null;
    }

    setStatus('Connecting to Gemini…');
    setIsConnecting(true);

    const session = await ai.live.connect({
      model,
      callbacks: {
        onopen: () => {
          setIsConnecting(false);
          setStatus('Session active — speak anytime');
        },
        onmessage: (message) => {
          void handleServerMessage(message);
        },
        onerror: (event) => {
          console.error('[Gemini Live error]', event);
          callbacksRef.current.onError?.(event);
          setStatus('Voice error — check mic permissions and Gemini key.');
        },
        onclose: (event) => {
          console.debug('[Gemini Live close]', event.reason);
          void teardown();
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        tools: GEMINI_CANVAS_TOOLS,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: {} },
      },
    });

    sessionRef.current = session;
    return session;
  }, [ai, handleServerMessage, model, setStatus, teardown]);

  const startMic = useCallback(async () => {
    const audio = new GeminiLiveAudio();
    audioRef.current = audio;
    await audio.start((pcm16) => {
      const session = sessionRef.current;
      if (!session || !isSessionActiveRef.current) return;
      const chunk = audio.sendChunkAsBase64(pcm16);
      session.sendRealtimeInput({ audio: chunk });
    });
  }, []);

  const startSession = useCallback(async (_options?: import('../voice/types').StartSessionOptions) => {
    if (!ai) {
      setStatus('Missing Gemini API key — add NEXT_PUBLIC_GEMINI_API_KEY to .env.local');
      return;
    }
    if (isSessionActiveRef.current) return;

    try {
      await connectSession();
      setIsSessionActive(true);
      await startMic();
    } catch (err) {
      console.error('[Gemini] start failed', err);
      callbacksRef.current.onError?.(err);
      setStatus('Could not start voice session');
      await teardown();
    }
  }, [ai, connectSession, setStatus, startMic, teardown]);

  const stopSession = useCallback(async () => {
    setIsPaused(false);
    setIsMicMuted(false);
    await teardown();
  }, [teardown]);

  const sendText = useCallback(
    async (text: string) => {
      if (!ai) {
        setStatus('Missing Gemini API key — add NEXT_PUBLIC_GEMINI_API_KEY to .env.local');
        return;
      }

      if (!isSessionActiveRef.current) {
        try {
          await connectSession();
          setIsSessionActive(true);
        } catch (err) {
          console.error('[Gemini] connect for text failed', err);
          setStatus('Could not start voice session');
          return;
        }
      }

      sessionRef.current?.sendRealtimeInput({ text });
    },
    [ai, connectSession, setStatus],
  );

  const pauseSession = useCallback(async () => {
    if (!isSessionActiveRef.current || isPaused) return;
    setIsPaused(true);
    callbacksRef.current.onTeachingStateChange?.(false);
    // Stop sending mic audio while paused
    try {
      audioRef.current?.stop();
    } catch {
      /* ignore */
    }
    setStatus('Session paused — nothing is listening or speaking');
  }, [isPaused, setStatus]);

  const resumeSession = useCallback(async () => {
    if (!isSessionActiveRef.current || !isPaused) return;
    setIsPaused(false);
    if (!isMicMuted) {
      try {
        await startMic();
      } catch {
        /* ignore */
      }
    }
    setStatus('Session active — speak anytime');
  }, [isPaused, isMicMuted, setStatus, startMic]);

  const setMicMuted = useCallback(
    (muted: boolean) => {
      setIsMicMuted(muted);
      if (isPaused) return;
      if (muted) {
        void audioRef.current?.stop();
      } else if (isSessionActiveRef.current) {
        void startMic();
      }
    },
    [isPaused, startMic],
  );

  return {
    isSessionActive,
    isPaused: isSessionActive && isPaused,
    isMicMuted,
    isConnecting,
    statusText,
    isConfigured: Boolean(apiKey),
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted,
    sendText,
  };
}
