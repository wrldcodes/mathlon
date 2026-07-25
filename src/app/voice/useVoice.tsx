'use client';

import type { ReactNode } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import { useVapiVoice } from '../hooks/useVapiVoice';
import { useGeminiVoice } from '../hooks/useGeminiVoice';
import { useElevenLabsVoice } from '../hooks/useElevenLabsVoice';
import type {
  VoiceCallbacks,
  VoiceProviderHook,
  VoiceProviderId,
  VoiceSession,
} from './types';

// Re-export the port types so consumers import everything voice-related from
// one place.
export type {
  VoiceCallbacks,
  VoiceSession,
  VoiceProviderId,
  CanvasToolCall,
  ToolResult,
} from './types';

/**
 * Provider registry. New adapters register here without any consumer changing.
 */
const PROVIDERS: Partial<Record<VoiceProviderId, VoiceProviderHook>> = {
  vapi: useVapiVoice,
  gemini: useGeminiVoice,
  elevenlabs: useElevenLabsVoice,
};

// The provider is fixed per deployment via env, so the same hook runs on every
// render (this keeps the rules of hooks satisfied). Defaults to Vapi so nothing
// changes until a new provider is explicitly turned on.
const SELECTED =
  (process.env.NEXT_PUBLIC_VOICE_PROVIDER as VoiceProviderId | undefined) ?? 'vapi';

const activeProvider: VoiceProviderHook = PROVIDERS[SELECTED] ?? useVapiVoice;

if (!PROVIDERS[SELECTED] && typeof window !== 'undefined') {
  console.warn(
    `[voice] Provider "${SELECTED}" is not registered yet; falling back to "vapi".`,
  );
}

/**
 * Provider-agnostic voice hook — the only voice entry point the app imports.
 * Switch providers with NEXT_PUBLIC_VOICE_PROVIDER=vapi|gemini|elevenlabs.
 */
export function useVoice(callbacks: VoiceCallbacks): VoiceSession {
  return activeProvider(callbacks);
}

/**
 * Wrap the app in this once, near the root. Only the ElevenLabs adapter needs
 * a context provider (`useConversation` requires a `ConversationProvider`
 * ancestor); Vapi and Gemini talk to their SDKs directly, so this is a no-op
 * passthrough for those providers and adds no bundle weight when unused.
 */
export function VoiceProviderRoot({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>;
}
